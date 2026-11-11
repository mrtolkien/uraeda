//! The write queue, for the whole server: every write to a repository goes through [`write`],
//! which gives it its turn, and lands the commits it deferred behind it, in order. The record
//! `WriteQueue` shows them, and `writes.dismiss` takes a refused one out.
//!
//! ```ignore
//! // A save: it commits nothing, and waits for its turn only.
//! write(call.shared(), &input.repo, Write::saving(), |repo| {
//!     Ok(api::save_text(repo, &input.path, &input.text, &input.hash)?)
//! })
//! // A commit of a feature's file, named in the record as the client asked.
//! let write = Write::of_feature(&input.folder).file(&input.file).named(input.write);
//! write(call.shared(), &input.repo, write, |repo| {
//!     Ok(api::retry_commit(repo, &input.folder, &input.file)?)
//! })
//! ```
//!
//! The core defers the commits of a repository whose queue is open: a committing call writes
//! its files and returns, so its action answers at once, and the commit runs here, with the
//! hooks. A hook's refusal puts the files back, and stays in the record until dismissed.

mod repository;
#[cfg(test)]
mod tests;

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::mpsc::{Receiver, sync_channel};
use std::sync::{Arc, Mutex, PoisonError};
use std::thread::JoinHandle;

use uraeda_core::api;
use uraeda_protocol::{QueuedWrite, StartStep, WriteName, WriteQueue, WriteState, WritesDismiss};

pub(crate) use repository::Landing;
use repository::{Landed, Queue};

use crate::live::{Bus, Fault, Registry};
use crate::records::repositories;
use crate::runner::{Runner, refusals};
use crate::shared::Shared;

/// What a committing write commits, which the next commit of the same waits for.
#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) enum Key {
    /// A feature's or a change's files, by its folder.
    Feature(String),
    /// The default branch's lists: the inbox, the priorities, their rounds, and the proposal
    /// files, whose commits take each other's files along.
    Lists,
    /// The main checkout's git state: its branch, its index, a pull or a merge under way.
    Main,
}

/// A write to a repository, as the queue takes it: what it commits, and how the record names
/// it, or the commits it defers.
#[derive(Clone)]
pub(crate) struct Write {
    keys: Vec<Key>,
    name: Option<WriteName>,
    /// What names it when the client gave no name: a write of its own has one.
    label: Option<String>,
    /// The page it opens when the client gave no name.
    href: &'static str,
    folder: Option<String>,
    file: Option<String>,
    /// Whether the record shows it: the server's own fetch lands unseen.
    seen: bool,
    /// For a start, its steps as it is queued.
    steps: Option<Vec<StartStep>>,
    /// The features whose files it writes, by their folders: refused while an agent works on
    /// one of them.
    guarded: Vec<String>,
}

impl Default for Write {
    fn default() -> Write {
        Write {
            keys: Vec::new(),
            name: None,
            label: None,
            href: "",
            folder: None,
            file: None,
            seen: true,
            steps: None,
            guarded: Vec::new(),
        }
    }
}

impl Write {
    /// A write that saves files and commits nothing: it waits for its turn only.
    pub(crate) fn saving() -> Write {
        Write::default()
    }

    /// A write that commits files of a feature or a change: it waits for that folder's queued
    /// commits first.
    pub(crate) fn of_feature(folder: &str) -> Write {
        Write {
            keys: vec![Key::Feature(folder.to_owned())],
            folder: Some(folder.to_owned()),
            guarded: vec![folder.to_owned()],
            ..Write::default()
        }
    }

    /// The write saves files of a feature or a change, by its folder: it is refused while an
    /// agent works on it.
    pub(crate) fn on_feature(mut self, folder: &str) -> Write {
        self.guarded.push(folder.to_owned());
        self
    }

    /// The write saves the file at a path from the top level: a feature's when it is under
    /// `specs/<folder>/`, a change's under `specs/changes/<folder>/`, refused while an agent
    /// works on it.
    pub(crate) fn on_path(mut self, path: &str) -> Write {
        let folder = uraeda_core::workspace::path_folder(path);
        self.guarded
            .extend(folder.map(|(_, folder, _)| folder.to_owned()));
        self
    }

    /// A write that commits files of the default branch's lists: it waits for their queued
    /// commits first.
    pub(crate) fn of_lists() -> Write {
        Write {
            keys: vec![Key::Lists],
            ..Write::default()
        }
    }

    /// A write of the main checkout by git, as a pull, a merge, or a commit of its index: the
    /// lists' commits wait for it, and it for them, since it may write their files.
    pub(crate) fn of_main() -> Write {
        Write {
            keys: vec![Key::Main, Key::Lists],
            ..Write::default()
        }
    }

    /// A write the record never shows, which waits for no queued commit and none for it: the
    /// server's own fetch.
    pub(crate) fn unseen() -> Write {
        Write {
            seen: false,
            ..Write::default()
        }
    }

    /// The write also commits, or writes over, files of a feature or a change: it waits for that
    /// folder's queued commits too, as a drop does, which takes a feature's line out of the
    /// priorities.
    pub(crate) fn and_feature(mut self, folder: &str) -> Write {
        self.keys.push(Key::Feature(folder.to_owned()));
        self.folder.get_or_insert_with(|| folder.to_owned());
        self
    }

    /// The file the write concerns, as the record shows it.
    pub(crate) fn file(mut self, file: &str) -> Write {
        self.file = Some(file.to_owned());
        self
    }

    /// What the client names the write with: without it, each commit shows its subject, and a
    /// write of its own what [`Write::or_named`] says.
    pub(crate) fn named(mut self, name: Option<WriteName>) -> Write {
        self.name = name;
        self
    }

    /// What names a write of its own when the client gave no name: its running text, and the
    /// page it opens.
    pub(crate) fn or_named(mut self, label: impl Into<String>, href: &'static str) -> Write {
        self.label = Some(label.into());
        self.href = href;
        self
    }

    /// The steps of a start, which its write shows from the moment it is queued: its landing
    /// moves them with [`Landing::steps`].
    pub(crate) fn steps(mut self, steps: Vec<StartStep>) -> Write {
        self.steps = Some(steps);
        self
    }

    /// The write, or one of its commits, as the record shows it, waiting: `subject` names it
    /// when the client did not.
    fn queued(&self, id: String, subject: String) -> QueuedWrite {
        let (label, href) = match &self.name {
            Some(name) => (name.label.clone(), name.href.clone()),
            None => (subject, self.href.to_owned()),
        };
        QueuedWrite {
            id,
            label,
            href,
            folder: self.folder.clone(),
            file: self.file.clone(),
            state: WriteState::Waiting,
            failure: None,
            output: None,
            steps: None,
        }
    }
}

/// Runs a write to the repository listed as `repository`, in its turn: after the writes that
/// reached the queue before it, and after the queued commits of what it commits. `run` is given
/// the repository's main checkout, and calls the core. The commits it deferred land behind it,
/// one after another, even when it fails after deferring one: `write` answers once the files
/// are written.
///
/// Once `run` ended, and again once each commit it deferred landed or was refused, every record
/// of the repository somebody holds is read again: see [`crate::records::written`]. A domain's
/// action says nothing more on the bus for what it wrote there.
///
/// # Errors
///
/// `refused` for a repository the list does not hold, for a write of a feature's files while
/// its agent works on it, as it arrives or once its turn came, once the server stops, and
/// whatever `run` fails with.
pub(crate) fn write<T>(
    shared: &Shared,
    repository: &str,
    write: Write,
    run: impl FnOnce(&Path) -> Result<T, Fault>,
) -> Result<T, Fault> {
    let path = repositories::path(shared, repository)?;
    // Before the wait, so a write that would be refused is refused at once, and again once its
    // turn came: an agent may have started meanwhile.
    working(shared, &path, &write.guarded)?;
    let guarded = write.guarded.clone();
    let queue = shared.get::<Queues>().open(shared, &path)?;
    let _turn = queue.turn(repository, write)?;
    working(shared, &path, &guarded)?;
    run(&path)
}

/// Refuses a write of the files of one of `folders` while an agent works on it: a session of
/// that change or feature has a turn running, starting, or queued.
///
/// # Errors
///
/// `refused`, in the words every such write is refused with.
pub(crate) fn working(shared: &Shared, root: &Path, folders: &[String]) -> Result<(), Fault> {
    let Some(runner) = Runner::find(shared).filter(|_| !folders.is_empty()) else {
        return Ok(());
    };
    let working = runner.working(&root.to_string_lossy());
    match folders.iter().any(|folder| working.contains(folder)) {
        true => Err(Fault::refused(refusals::WORKING)),
        false => Ok(()),
    }
}

/// Queues a write of its own to the repository listed as `repository`: `land` runs on the
/// queue's thread, after the writes queued before it, with the repository's turn, and is given
/// the main checkout and the write as it lands, for what git prints. The record shows it under
/// the client's name, or [`Write::or_named`]'s, until it landed. The commits `land` defers land
/// behind it, under its name. `land` answers once queued: [`Queued`] waits for the landing.
///
/// # Errors
///
/// `refused` for a repository the list does not hold, and once the server stops.
pub(crate) fn land<T: Send + 'static>(
    shared: &Shared,
    repository: &str,
    write: Write,
    land: impl FnOnce(&Path, &Landing<'_>) -> Result<T, Fault> + Send + 'static,
) -> Result<Queued<T>, Fault> {
    let path = repositories::path(shared, repository)?;
    let queue = shared.get::<Queues>().open(shared, &path)?;
    let (answer, answered) = sync_channel(1);
    let land = move |landing: &Landing<'_>| {
        let landed = land(landing.path(), landing);
        let refusal = landed.as_ref().err().cloned();
        // Nobody waits for the answer of a write queued and left to land.
        let answer = Box::new(move || drop(answer.send(landed)));
        Landed { refusal, answer }
    };
    let id = queue.add(repository, write, Box::new(land))?;
    Ok(Queued {
        queue,
        id,
        answered,
    })
}

/// Waits until the commits queued for a feature's files landed, those queued meanwhile too: a
/// message to its agent waits for them, and a review's findings answer once committed.
///
/// # Errors
///
/// `hook`, with what it printed, when one of them was refused meanwhile: the core put its files
/// back.
pub(crate) fn settled(shared: &Shared, repository: &str, folder: &str) -> Result<(), Fault> {
    let path = repositories::path(shared, repository)?;
    let Some(queue) = shared.get::<Queues>().found(&path) else {
        return Ok(());
    };
    // It may wait as long as the hooks run: its connection's next call need not.
    crate::live::placed();
    match queue.settled(&[Key::Feature(folder.to_owned())]) {
        None => Ok(()),
        Some(output) => Err(Fault::new(uraeda_protocol::ErrorCode::Hook, output)),
    }
}

/// A write of its own, queued: what waits for its landing.
pub(crate) struct Queued<T> {
    queue: Arc<Queue>,
    id: String,
    answered: Receiver<Result<T, Fault>>,
}

impl<T> Queued<T> {
    /// Waits until the write landed, and gives what it gave. A refusal stays in the record until
    /// dismissed, and is the answer too.
    ///
    /// # Errors
    ///
    /// The refusal, or `refused` when the server stopped before the write landed, or failed as
    /// it landed.
    pub(crate) fn landed(self) -> Result<T, Fault> {
        let unanswered = || Fault::refused("This did not land: the server stopped, or failed.");
        self.answered.recv().unwrap_or_else(|_| Err(unanswered()))
    }

    /// [`Queued::landed`], for a write whose refusal is its call's alone: it leaves the record.
    ///
    /// # Errors
    ///
    /// As [`Queued::landed`].
    pub(crate) fn answered(self) -> Result<T, Fault> {
        let (queue, id) = (self.queue.clone(), self.id.clone());
        let landed = self.landed();
        if landed.is_err() {
            queue.dismiss(&id);
        }
        landed
    }
}

/// The queue of each repository written to since the server started, by its main checkout, none
/// once the server stops: no queue opens then.
struct Queues(Mutex<Option<HashMap<PathBuf, Open>>>);

impl Default for Queues {
    fn default() -> Queues {
        Queues(Mutex::new(Some(HashMap::new())))
    }
}

/// An open queue, and the thread that lands its commits.
struct Open {
    queue: Arc<Queue>,
    landing: JoinHandle<()>,
}

impl Queues {
    /// A repository's queue, opened at its first write: the core defers its commits from then
    /// on, and a thread of the queue's own lands them.
    fn open(&self, shared: &Shared, path: &Path) -> Result<Arc<Queue>, Fault> {
        let mut queues = self.0.lock().unwrap_or_else(PoisonError::into_inner);
        let queues = queues.as_mut().ok_or_else(repository::stopped)?;
        if let Some(open) = queues.get(path) {
            return Ok(open.queue.clone());
        }
        let queue = Arc::new(Queue::new(path, Bus::clone(&shared.get::<Bus>())));
        api::defer_commits(path, true);
        let lander = queue.clone();
        let landing = std::thread::spawn(move || lander.land());
        let open = Open {
            queue: queue.clone(),
            landing,
        };
        queues.insert(path.to_owned(), open);
        Ok(queue)
    }

    /// A repository's queue, when a write opened it.
    fn found(&self, path: &Path) -> Option<Arc<Queue>> {
        let queues = self.0.lock().unwrap_or_else(PoisonError::into_inner);
        let open = queues.as_ref()?.get(path)?;
        Some(open.queue.clone())
    }

    /// Stops every queue as the server stops: the commit that runs ends, the core defers no
    /// commit any more, and a write from then on is refused. The ones not landed are forgotten,
    /// their files left written.
    fn close(&self) {
        let queues = self.0.lock().unwrap_or_else(PoisonError::into_inner).take();
        for Open { queue, landing } in queues.into_iter().flat_map(HashMap::into_values) {
            queue.close();
            let _ = landing.join();
            api::defer_commits(queue.path(), false);
        }
    }
}

/// Provides the queues, stops them with the server, and registers the record `WriteQueue` and
/// the action `writes.dismiss`.
pub(super) fn register(shared: &Shared, registry: &Registry) {
    shared.provide(Queues::default());
    let stopping = shared.clone();
    shared.on_stop("write queues", async move {
        let closing = tokio::task::spawn_blocking(move || stopping.get::<Queues>().close());
        let _ = closing.await;
    });
    registry.record::<WriteQueue>(|shared, args| {
        let path = repositories::path(shared, &args.repo)?;
        let queue = shared.get::<Queues>().found(&path);
        Ok(queue.map(|queue| queue.writes()).unwrap_or_default())
    });
    registry.action::<WritesDismiss>(|call, input| {
        let path = repositories::path(call.shared(), &input.repo)?;
        if let Some(queue) = call.shared().get::<Queues>().found(&path) {
            queue.dismiss(&input.id);
        }
        Ok(())
    });
}
