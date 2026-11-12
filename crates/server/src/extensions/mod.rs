//! Extensions' server parts: the owner's own code, run inside the server, each in a VM of its
//! own, as the [extensions](/specs/decisions/extensions.md) decision asks.
//!
//! - **They load only from the config folder**, `<config>/extensions/<name>/`, never from a
//!   repository: the [`loader`] reads them through the core, and reads no other path.
//! - **A broken extension stops alone.** Each runs in a [`vm`] on a thread of its own, with a
//!   limit on its memory and on the time its code runs. One that throws as it loads, runs over
//!   its time, or fails later is `broken`, with its problem in the record `Extensions`, until
//!   its files or its settings change.
//! - **A VM owns what it starts**: its timers, its child processes, its `fetch`es, its
//!   runtime, and its runtime's processes. They are released when it unloads, when it fails,
//!   and when the server stops.
//! - **An extension reloads on save**, with no restart: the watcher wakes the loader, which
//!   stops the running version and starts the new one.
//!
//! # What the rest of the server uses
//!
//! - [`skills`]: the skill folders a session's agent gets in a repository,
//!   `Options::skills` of a runtime's `open`.
//! - [`emit`]: an event the extensions listen to. The repositories' `step-reached` and
//!   `commit-landed` come from the one file watcher; the sessions say `turn-ended` and
//!   `session-started`.
//! - [`hold`]: a session at work on an extension's runtime, whose reload waits for it.
//! - [`settings`] and [`is_on`]: an extension's settings and where it is on, a built-in one's
//!   too.
//!
//! The server API an extension's `server.ts` gets is declared in `api/server.d.ts`, built in
//! `api/prelude.js`, and served by `api.rs`.
//!
//! An extension's page is built, signed, and served by [`pages`], with the keys of
//! [`signing`]: a client runs it only when it is signed under the key this server gave it. It
//! is built with the app's [`modules`], which the server writes to the data folder as it starts.

mod accounts;
mod api;
mod builds;
mod events;
mod fetch;
mod fs;
mod graph;
mod loader;
mod modules;
mod pages;
mod process;
mod routes;
mod runtime;
mod signing;
mod status;
mod vm;
mod watch;

use std::path::PathBuf;
use std::sync::mpsc::{self, Sender};
use std::sync::{Arc, Mutex, MutexGuard};

use axum::body::Bytes;
use serde_json::{Value, json};
use uraeda_core::extensions::{self as core, EXTENSION_API, Extension};
use uraeda_protocol::{ExtensionRecord, ExtensionRecordArgs, ExtensionState};

pub use self::events::Happened;
pub(crate) use self::events::{files_changed, repository_left};
pub(crate) use self::graph::Problem;
use self::loader::{State, Wake};
use self::signing::Signer;
use self::vm::{CALL, Vm};
use crate::http::Routes;
use crate::live::{Fault, locked};
use crate::runtimes::Runtimes;
use crate::shared::Shared;
use crate::{Failure, live};

/// The built-in extensions whose server part is a runtime: one that registered none is off.
const BUILT_IN_RUNTIMES: [&str; 3] = ["claude", "codex", "fake"];

/// The most problems kept for one version of a page.
const MOST_PAGE_PROBLEMS: usize = 10;

/// The longest message kept of a page's problem, in characters.
const LONGEST_MESSAGE: usize = 1000;

struct Inner {
    state: Mutex<State>,
    wake: Sender<Wake>,
    steps: events::Steps,
    signer: Signer,
}

/// The server's extensions: `shared.get::<Extensions>()`. A handle, cheap to clone.
#[derive(Clone)]
pub(crate) struct Extensions(Arc<Inner>);

/// An extension as the server shows it: as the core read it, and what the loader made of it.
pub(crate) struct Shown {
    pub extension: Extension,
    pub state: ExtensionState,
    pub waiting_for: Option<String>,
    pub page_version: Option<u64>,
    /// Its manifest's and its settings' problems, then its code's, then its page's: why it did
    /// not build, then what clients reported of it.
    pub problems: Vec<Problem>,
}

/// Provides the [`Extensions`], mounts their routes, and starts the loader, which loads the
/// owner's extensions without holding the server's start. `Server::stop` stops every VM.
///
/// # Errors
///
/// When the key that signs the pages cannot be read or made in the data folder.
pub(crate) fn mount(shared: &Shared, routes: &mut Routes) -> Result<(), Failure> {
    let (wake, wakes) = mpsc::channel();
    let extensions = Extensions(Arc::new(Inner {
        state: Mutex::default(),
        wake,
        steps: events::Steps::default(),
        signer: Signer::open(shared.data_dir())?,
    }));
    shared.provide(extensions.clone());
    routes::mount(routes);
    pages::mount(routes);
    // The app's modules a page is built with, before the loader builds the first page.
    let written = modules::write(&shared.data_dir().join("extensions").join("modules"));
    if let Err(error) = written {
        say_err!("uraeda: the app's modules for extension pages were not written: {error}");
    }
    let (loading, loaded) = (shared.clone(), extensions.clone());
    let tasks = tokio::runtime::Handle::current();
    let loader = std::thread::Builder::new()
        .name("extensions".to_owned())
        .spawn(move || loader::run(loading, loaded, &wakes, tasks))?;
    extensions.wake(None);
    let stopping = shared.clone();
    shared.on_stop("extensions", async move {
        let _ = extensions.0.wake.send(Wake::Stop);
        if tokio::task::spawn_blocking(|| loader.join()).await.is_err() {
            say_err!("uraeda: the extensions' loader did not stop");
        }
        status::remove(stopping.data_dir());
    });
    Ok(())
}

/// The skill folders a session's agent gets in a repository, beside Uraeda's own: the
/// `skills/` folder of each of the owner's extensions on there, loadable on this API, as
/// `<extensions folder>/<name>/skills`, whose last folders name it. The built-in ones ship
/// none.
pub fn skills(shared: &Shared, repository: &str) -> Vec<PathBuf> {
    let folder = core::extensions_dir(shared.config_dir());
    let listed = core::read(shared.config_dir()).extensions.into_iter();
    let given = listed.filter(|extension| {
        !extension.is_built_in
            && extension.api == EXTENSION_API
            && !extension.problems.iter().any(|problem| problem.is_fatal)
            && core::is_on(extension, Some(repository))
            && PathBuf::from(&extension.folder).join("skills").is_dir()
    });
    given
        .map(|extension| folder.join(extension.name).join("skills"))
        .collect()
}

/// Sends an event to the extensions that listen to it and are on in its repository.
pub fn emit(shared: &Shared, happened: &Happened) {
    if let Some(extensions) = shared.find::<Extensions>() {
        events::emit(shared, &extensions, happened);
    }
}

/// Whether the extension of a name is on in a repository, by its name in the list, as the
/// loader last read it: a name that is no extension's is not.
pub fn is_on(shared: &Shared, name: &str, repository: &str) -> bool {
    let extensions = shared.find::<Extensions>();
    extensions.is_some_and(|extensions| extensions.on_in(name, repository))
}

/// An extension's settings, a built-in one's too, as an object, defaults filled in: in a
/// repository, `{}` where it is off; for every repository with none.
pub fn settings(shared: &Shared, name: &str, repository: Option<&str>) -> Value {
    if repository.is_some_and(|repository| !is_on(shared, name, repository)) {
        return json!({});
    }
    let text = core::settings_json(shared.config_dir(), name, repository);
    serde_json::from_str(&text).unwrap_or_else(|_| json!({}))
}

/// Holds an extension's reloads while a session works on its runtime: until the hold is
/// dropped, the extension is `waiting`, for the session of this title, and keeps running the
/// version the session's process lives in.
pub fn hold(shared: &Shared, name: &str, title: &str) -> Hold {
    let extensions = shared.get::<Extensions>();
    let id = {
        let mut state = extensions.state();
        state.next_hold += 1;
        let id = state.next_hold;
        let holds = state.holds.entry(name.to_owned()).or_default();
        holds.push((id, title.to_owned()));
        id
    };
    Hold {
        extensions: Extensions::clone(&extensions),
        name: name.to_owned(),
        id,
    }
}

/// A session at work on an extension's runtime: see [`hold`].
pub struct Hold {
    extensions: Extensions,
    name: String,
    id: u64,
}

impl Drop for Hold {
    fn drop(&mut self) {
        let waiting = {
            let mut state = self.extensions.state();
            if let Some(holds) = state.holds.get_mut(&self.name) {
                holds.retain(|(id, _)| *id != self.id);
            }
            let entry = state.entries.get(&self.name);
            entry.is_some_and(|entry| entry.state == ExtensionState::Waiting)
        };
        if waiting {
            // The reload that waited is asked again: it goes on once the last hold is gone, and
            // shows the next session's title until then.
            self.extensions.wake(Some(self.name.clone()));
        }
    }
}

impl Extensions {
    fn state(&self) -> MutexGuard<'_, State> {
        locked(&self.0.state)
    }

    /// What signs the pages.
    fn signer(&self) -> &Signer {
        &self.0.signer
    }

    /// The running page of an extension: its version, and its signed package.
    fn page(&self, name: &str) -> Option<(u64, Bytes)> {
        let state = self.state();
        let page = state.entries.get(name)?.page.as_ref()?;
        Some((page.version, page.package.clone()))
    }

    /// What wakes the loader.
    fn waker(&self) -> Sender<Wake> {
        self.0.wake.clone()
    }

    /// Asks the loader to read the extensions again, without waiting: `force` loads that one
    /// again whatever changed.
    pub(crate) fn wake(&self, force: Option<String>) {
        let done = None;
        let _ = self.0.wake.send(Wake::Scan { force, done });
    }

    /// Reads the extensions again, and waits until they are: what an action that wrote the
    /// settings calls before it answers, so that a read after its answer shows what it changed.
    /// Call it from a blocking thread, as a handler's.
    pub(crate) fn refresh(&self) {
        let (done, read) = mpsc::sync_channel(1);
        let (force, done) = (None, Some(done));
        if self.0.wake.send(Wake::Scan { force, done }).is_ok() {
            // It ends when the loader drops its end, once it read them.
            let _ = read.recv();
        }
    }

    /// Whether an extension is on in a repository.
    fn on_in(&self, name: &str, repository: &str) -> bool {
        let state = self.state();
        let extension = state.listed.iter().find(|extension| extension.name == name);
        extension.is_some_and(|extension| core::is_on(extension, Some(repository)))
    }

    /// The running VM of an extension.
    fn vm(&self, name: &str) -> Option<Vm> {
        self.state().entries.get(name)?.vm.clone()
    }

    /// The running VMs whose extension listens to an event.
    fn listening(&self, event: &str) -> Vec<Vm> {
        let state = self.state();
        let running = state.entries.values().filter_map(|entry| entry.vm.clone());
        running.filter(|vm| vm.listens(event)).collect()
    }

    /// The owner's extensions folder as messages show it, and every extension, the built-in
    /// ones first, each with what the loader made of it.
    pub(crate) fn shown(&self, shared: &Shared) -> (String, Vec<Shown>) {
        let runtimes = shared.get::<Runtimes>();
        let state = self.state();
        let shown = state.listed.iter().map(|extension| {
            let own = extension.problems.iter().map(loader::problem_of);
            let off = !extension.on_all && extension.on.is_empty();
            let on_or_off = |off: bool| match off {
                true => ExtensionState::Off,
                false => ExtensionState::On,
            };
            let mut shown = Shown {
                extension: extension.clone(),
                state: on_or_off(off),
                waiting_for: None,
                page_version: None,
                problems: own.collect(),
            };
            let name = extension.name.as_str();
            if extension.is_built_in {
                let unregistered =
                    BUILT_IN_RUNTIMES.contains(&name) && runtimes.get(name).is_none();
                shown.state = on_or_off(off || unregistered);
            } else if let Some(entry) = state.entries.get(name) {
                shown.state = entry.state;
                shown.waiting_for.clone_from(&entry.waiting_for);
                shown.page_version = entry.page.as_ref().map(|page| page.version);
                shown.problems.clone_from(&entry.problems);
                shown.problems.extend(entry.page_failure.iter().cloned());
                shown.problems.extend(entry.page_problems.iter().cloned());
            }
            shown
        });
        (state.folder.clone(), shown.collect())
    }

    /// Reads a record of an extension for a repository: its value, or why there is none.
    pub(crate) fn read_record(&self, args: &ExtensionRecordArgs) -> ExtensionRecord {
        let ExtensionRecordArgs {
            repo,
            extension,
            name,
        } = args;
        let asked = || {
            if !self.on_in(extension, repo) {
                return Err(format!("{extension} is off in {repo}"));
            }
            let vm = self.vm(extension);
            let vm = vm.ok_or_else(|| format!("{extension} has no record {name}"))?;
            let call = json!({ "what": "record", "name": name, "repository": repo });
            vm.call(call, CALL).map_err(|error| match error {
                // What it threw is its own words: the rest is said of it.
                vm::CallError::Threw(message) => message,
                other => format!("{extension}: {}", runtime::words(&other)),
            })
        };
        match asked() {
            Ok(value) => ExtensionRecord { value, error: None },
            Err(error) => {
                let (value, error) = (Value::Null, Some(error));
                ExtensionRecord { value, error }
            }
        }
    }

    /// Runs an action of an extension in a repository: refused where it is off, when it
    /// throws, and when it does not answer in time.
    pub(crate) fn act(
        &self,
        repo: &str,
        extension: &str,
        name: &str,
        input: &Value,
    ) -> Result<Value, Fault> {
        if !self.on_in(extension, repo) {
            return Err(Fault::refused(format!("{extension} is off in {repo}")));
        }
        let vm = self.vm(extension);
        let vm = vm.ok_or_else(|| Fault::refused(format!("{extension} is not loaded")))?;
        // It may take its 10 seconds: the connection's next call does not wait for it.
        live::placed();
        let call = json!({ "what": "action", "name": name, "input": input, "repository": repo });
        let refused = |error| Fault::refused(format!("{extension}: {}", runtime::words(&error)));
        vm.call(call, CALL).map_err(refused)
    }

    /// Keeps a problem an extension's page met in a client, for the page's version that runs:
    /// whether it was new. A report for another version is dropped: it comes from a client
    /// that has not loaded the new page yet.
    pub(crate) fn report_page_problem(&self, name: &str, version: u64, message: &str) -> bool {
        let mut state = self.state();
        let Some(entry) = state.entries.get_mut(name) else {
            return false;
        };
        let Some(page) = entry.page.as_ref().filter(|page| page.version == version) else {
            return false;
        };
        let message: String = message.chars().take(LONGEST_MESSAGE).collect();
        let known = entry.page_problems.iter().any(|one| one.message == message);
        if known || entry.page_problems.len() >= MOST_PAGE_PROBLEMS {
            return false;
        }
        let problem = Problem::of(&page.entry, message);
        entry.page_problems.push(problem);
        true
    }
}
