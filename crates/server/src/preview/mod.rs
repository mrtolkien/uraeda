//! Previews: the preview command of a project's checkout, as its preview decision names it, run
//! by the server and shown in a sandboxed frame or a web view.
//!
//! - **A read starts it.** Reading the record `Preview` or `Story` of a checkout is a view: its
//!   command starts in a process group of its own, on a free port, and is ready once its index
//!   answers. See [`runner`].
//! - **It stops by itself**: 30 minutes after its last view, when its checkout is removed, and
//!   with the server, which waits for every command it started. A server that is killed leaves
//!   a record its next start stops them from.
//! - **Its address carries the frame secret**: `/r/<name>/preview/<secret>/<folder>/`. A
//!   sandboxed frame sends no cookie, so the secret is what opens the path. Only a signed-in
//!   client gets it, in a record, and it changes whenever a session or a device ends: the
//!   previews then start again under their new address, for the records somebody holds.
//! - **The proxy** forwards reads and WebSockets under that address, without Uraeda's
//!   credentials, and sandboxes every answer. See [`proxy`].
//!
//! The records and the action are in `records/previews.rs`.

mod ahead;
pub(crate) mod checkout;
mod command;
mod entry;
mod frames;
mod groups;
pub(crate) mod index;
mod ports;
pub(crate) mod proxy;
pub(crate) mod runner;
mod upstream;
mod warm;

use std::collections::{BTreeSet, HashMap, HashSet};
use std::sync::{Arc, Mutex, MutexGuard, PoisonError};
use std::time::Duration;

use percent_encoding::percent_decode_str;
use tokio::sync::Notify;
use uraeda_protocol::{Mockup, Preview, PreviewArgs, Story, StoryArgs};

use crate::Failure;
use crate::http::{Routes, segment};
use crate::live::Bus;
use crate::shared::Shared;
use crate::sign_in;
use frames::Frames;
use runner::{Checkout, Runner, State};

/// How often the previews nobody views are stopped.
const SWEEP: Duration = Duration::from_secs(60);

/// Who reads a checkout's preview: the records to read again when it changes.
#[derive(Clone, Debug)]
pub(crate) struct Reader {
    /// The repository's name in the list.
    pub repository: String,
    /// The feature's folder, or `main`.
    pub folder: String,
    /// The story's id, for a `Story`: none for the `Preview`.
    pub story: Option<String>,
}

/// The records read for one base: its `Preview`, and its stories' ids.
#[derive(Clone, Debug)]
struct Readers {
    repository: String,
    folder: String,
    stories: BTreeSet<String>,
}

impl Readers {
    /// Says the base's records changed: the ones somebody holds are read again.
    fn tell(&self, bus: &Bus) {
        let (repo, folder) = (self.repository.clone(), self.folder.clone());
        bus.changed::<Preview>(&PreviewArgs { repo, folder });
        for id in &self.stories {
            let (repo, id) = (self.repository.clone(), id.clone());
            bus.changed::<Story>(&StoryArgs { repo, id });
        }
    }
}

/// The records read for each base.
type Watched = Mutex<HashMap<String, Readers>>;

/// The server's previews: the frame secret, the runner, and who reads each preview.
pub(crate) struct Previews {
    pub(crate) frames: Frames,
    pub(crate) runner: Runner,
    watched: Arc<Watched>,
    bus: Bus,
    /// Told when the frame secret was replaced: the previews start again under their new base.
    renew: Notify,
}

impl Previews {
    fn watched(&self) -> MutexGuard<'_, HashMap<String, Readers>> {
        self.watched.lock().unwrap_or_else(PoisonError::into_inner)
    }

    /// A view of the checkout by a record: its state, its command started when none runs. The
    /// record is read again at each change of the preview, until the preview stops.
    pub(crate) fn view(&self, shared: &Shared, checkout: &Checkout, reader: Reader) -> State {
        self.watch(&checkout.base, reader);
        self.runner.view(shared, checkout)
    }

    /// Stops the checkout's command, if one runs, and starts it again, for the record that asks
    /// and for the ones read before.
    pub(crate) fn restart(&self, shared: &Shared, checkout: &Checkout, reader: Reader) -> State {
        self.watch(&checkout.base, reader);
        let readers = self.watched().get(&checkout.base).cloned();
        let state = self.runner.restart(shared, checkout);
        // The stop forgot who reads the base: they read the start that follows too.
        if let Some(readers) = readers {
            self.watched()
                .insert(checkout.base.clone(), readers.clone());
            readers.tell(&self.bus);
        }
        state
    }

    /// Records that a record read the base's preview.
    fn watch(&self, base: &str, reader: Reader) {
        let mut watched = self.watched();
        let readers = watched.entry(base.to_owned()).or_insert_with(|| Readers {
            repository: reader.repository.clone(),
            folder: reader.folder.clone(),
            stories: BTreeSet::new(),
        });
        readers.stories.extend(reader.story);
    }

    /// Starts the previews again as the frame secret is replaced: the records read for every
    /// base are taken, every command is stopped, and the records are read again under the new
    /// base, which starts their previews. A preview nobody holds a record of stays stopped.
    fn renew(&self) {
        let readers: Vec<Readers> = self.watched().drain().map(|(_, readers)| readers).collect();
        self.runner.stop_under("");
        readers.iter().for_each(|readers| readers.tell(&self.bus));
        // A mockup's address carries the secret too.
        self.bus.changed_all::<Mockup>();
    }

    /// A frame asked for the page of a preview that does not run: one stopped after 30 minutes
    /// without a view, as a client that held its records all along shows it again. The records
    /// of its checkout somebody holds are read again, which is a view, and starts it: the frame
    /// gets 503 until it is ready, and its records say so. Nobody holding them, nothing starts.
    pub(crate) fn wake(&self, base: &str) {
        let parts: Vec<String> = base
            .trim_matches('/')
            .split('/')
            .map(|part| percent_decode_str(part).decode_utf8_lossy().into_owned())
            .collect();
        let [_, repo, _, _, folder] = parts.as_slice() else {
            return;
        };
        let (repo, folder) = (repo.clone(), folder.clone());
        let ours = format!("{folder}:");
        self.bus
            .changed_where::<Story>(|args| args.repo == repo && args.id.starts_with(&ours));
        self.bus.changed::<Preview>(&PreviewArgs { repo, folder });
    }
}

/// What the runner's change of a base tells: its records are read again while a preview lives
/// under it. A stopped preview's records are forgotten without a word: a read is a view, which
/// would start it again.
fn changed(watched: &Watched, bus: &Bus, base: &str, running: bool) {
    let mut watched = watched.lock().unwrap_or_else(PoisonError::into_inner);
    if !running {
        watched.remove(base);
    } else if let Some(readers) = watched.get(base) {
        readers.tell(bus);
    }
}

/// Starts the runner, provides the previews, and mounts the proxy. The frame secret is replaced
/// whenever a session or a device ends, and every command stops with the server.
pub(crate) fn mount(shared: &Shared, routes: &mut Routes) -> Result<(), Failure> {
    let bus = Bus::clone(&shared.get::<Bus>());
    let watched = Arc::new(Watched::default());
    let (read, told) = (watched.clone(), bus.clone());
    let runner = Runner::new(shared, move |base, running| {
        changed(&read, &told, base, running)
    });
    shared.provide(Previews {
        frames: Frames::new(),
        runner: runner.clone(),
        watched,
        bus,
        renew: Notify::new(),
    });
    proxy::mount(routes);
    let previews = shared.get::<Previews>();
    let ended = previews.clone();
    sign_in::on_ended(shared, move |_| {
        // At once: the old secret opens nothing from here on.
        ended.frames.replace();
        ended.renew.notify_one();
    });
    tokio::spawn(follow(shared.clone(), previews));
    ahead::mount(shared);
    shared.on_stop("previews", async move { runner.close().await });
    Ok(())
}

/// Until the server stops: starts the previews again after each replacement of the frame
/// secret, once for the ones made together, and stops the ones nobody views, every minute.
async fn follow(shared: Shared, previews: Arc<Previews>) {
    loop {
        tokio::select! {
            () = previews.renew.notified() => previews.renew(),
            () = tokio::time::sleep(SWEEP) => {
                let shared = shared.clone();
                let _ = tokio::task::spawn_blocking(move || sweep(&shared)).await;
            }
            () = shared.stopping() => return,
        }
    }
}

/// The current frame secret, which a preview's and a mockup's path carry: only for an address
/// given to a signed-in client.
pub fn frame_secret(shared: &Shared) -> String {
    shared.get::<Previews>().frames.current()
}

/// Whether `path` is a preview's or a mockup's path with the current frame secret: what opens
/// it to a sandboxed frame, which sends no cookie.
pub fn is_frame(shared: &Shared, path: &str) -> bool {
    let previews = shared.find::<Previews>();
    previews.is_some_and(|previews| previews.frames.allows(path))
}

/// Stops each preview whose checkout was removed, and each nobody viewed for 30 minutes. One
/// whose folder's file waits for the human, and embeds a story, counts as viewed now: it stops
/// 30 minutes after it no longer waits. The server does it every minute. It reads files: call
/// it from a blocking thread.
pub fn sweep(shared: &Shared) {
    let previews = shared.get::<Previews>();
    let read: Vec<(String, Readers)> = {
        let watched = previews.watched();
        let read = watched.iter();
        read.map(|(base, readers)| (base.clone(), readers.clone()))
            .collect()
    };
    let waits = |readers: &Readers| {
        checkout::waits_with_a_story(shared, &readers.repository, &readers.folder)
    };
    let kept = read.into_iter().filter(|(_, readers)| waits(readers));
    let kept: HashSet<String> = kept.map(|(base, _)| base).collect();
    previews.runner.sweep(shared, &kept);
}

/// Starts a folder's preview ahead of any page, as its feature's turn ends done, when its file
/// then waits for the human and embeds a story, and compiles those stories: see [`ahead`].
pub(crate) fn warm_waiting(shared: &Shared, repository: &str, folder: &str) {
    ahead::ask(shared, repository, Some(folder));
}

/// Starts the previews of a repository's folders that wait for the human with a story, one after
/// the other, as it joins the list: see [`ahead`].
pub(crate) fn warm_repository(shared: &Shared, repository: &str) {
    ahead::ask(shared, repository, None);
}

/// Starts the previews of every listed repository's folders that wait for the human with a
/// story, as the server starts, one after the other: see [`ahead`].
pub(crate) fn warm_all_waiting(shared: &Shared) {
    let listed = crate::records::repositories::all(shared);
    for repository in listed.into_iter().filter(|repository| !repository.missing) {
        warm_repository(shared, &repository.name);
    }
}

/// A repository's files or commits changed: the records of its running previews are read again,
/// which starts one again when its checkout's code version moved.
pub fn files_changed(shared: &Shared, repository: &str) {
    // The watcher starts before the previews mount: nothing runs yet.
    let Some(previews) = shared.find::<Previews>() else {
        return;
    };
    let prefix = format!("/r/{}/preview/", segment(repository));
    let watched = previews.watched();
    let readers = watched.iter().filter(|(base, _)| base.starts_with(&prefix));
    readers.for_each(|(_, readers)| readers.tell(&previews.bus));
}

/// A repository left the list: its previews stop.
pub fn repository_removed(shared: &Shared, name: &str) {
    let Some(previews) = shared.find::<Previews>() else {
        return;
    };
    previews
        .runner
        .stop_under(&format!("/r/{}/preview/", segment(name)));
}
