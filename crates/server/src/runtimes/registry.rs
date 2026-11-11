//! The runtimes sessions run on, by the names they are registered as, in the order each name
//! was first registered, the settings' default agent first where it is on.
//!
//! A session stores the name of the runtime it was made with, and runs on that runtime only: one
//! removed, or off in its repository, leaves it read-only until it returns. A runtime's name is
//! its extension's, a built-in's as `claude` or one of the owner's, so where it is on is where
//! its extension is on.

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use tokio::time::Instant;
use uraeda_core::extensions::{self, Extension};
use uraeda_protocol::ModelList;

use super::{Runtime, RuntimeError};
use crate::live::{locked, wait};

/// A runtime's model list is asked for at most once in this time.
pub const MODELS_REFRESH: Duration = Duration::from_secs(60);

/// A model list asked for longer than this is given up on: the runtime keeps its last one.
pub const MODELS_REFRESH_TIMEOUT: Duration = Duration::from_secs(15);

/// Whether a runtime worked at its last check, and its version: unchecked, it is not available.
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct Status {
    pub available: bool,
    pub version: Option<String>,
}

/// What a check found: whether any runtime's status changed, and whether one that changed is
/// available again.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct Checked {
    pub changed: bool,
    pub back: bool,
}

/// A registered runtime, with what was last learned of it.
struct Entry {
    /// What tells this registration from a later one of its name.
    id: u64,
    name: String,
    runtime: Arc<dyn Runtime>,
    status: Status,
    models: Option<ModelList>,
    /// One ask of its models at a time, and when the last one began.
    listing: Arc<Mutex<Option<Instant>>>,
}

#[derive(Default)]
struct State {
    entries: Vec<Entry>,
    /// Every name ever registered, in the order of its first registration: a runtime
    /// registered again, as a built-in whose settings changed, keeps its place.
    order: Vec<String>,
    /// Each name's status when it was removed, which a registration under it starts from.
    last: HashMap<String, Status>,
    next: u64,
}

struct Inner {
    config_dir: PathBuf,
    state: Mutex<State>,
    listeners: Mutex<Vec<Listener>>,
}

type Listener = Arc<dyn Fn() + Send + Sync>;

/// The server's runtimes: `shared.get::<Runtimes>()`. A handle, cheap to clone.
///
/// What only reads what is kept returns at once, from any thread. [`Runtimes::check`] and
/// [`Runtimes::refresh_models`] ask the runtimes, so they run on a blocking thread, as a
/// handler's.
#[derive(Clone)]
pub struct Runtimes(Arc<Inner>);

impl Runtimes {
    /// The runtimes of a server whose config folder says where each extension is on.
    pub(super) fn new(config_dir: PathBuf) -> Runtimes {
        Runtimes(Arc::new(Inner {
            config_dir,
            state: Mutex::default(),
            listeners: Mutex::default(),
        }))
    }

    /// Registers a runtime under a name, its extension's: what removes it again. It starts from
    /// the status the last runtime of that name had, unchecked for a new name, so a runtime
    /// that reloads is not refused as unavailable until its next check. Its models are asked
    /// for at once, without waiting for them.
    ///
    /// # Errors
    ///
    /// [`RuntimeError::Taken`] when a runtime has that name already.
    pub fn register(
        &self,
        name: &str,
        runtime: Arc<dyn Runtime>,
    ) -> Result<Registered, RuntimeError> {
        let id = {
            let mut state = locked(&self.0.state);
            if state.entries.iter().any(|entry| entry.name == name) {
                return Err(RuntimeError::Taken(name.to_owned()));
            }
            state.next += 1;
            let entry = Entry {
                id: state.next,
                name: name.to_owned(),
                runtime,
                status: state.last.get(name).cloned().unwrap_or_default(),
                models: None,
                listing: Arc::default(),
            };
            state.entries.push(entry);
            if !state.order.iter().any(|known| known == name) {
                state.order.push(name.to_owned());
            }
            state.next
        };
        self.changed();
        if let Ok(tasks) = tokio::runtime::Handle::try_current() {
            let (runtimes, name) = (self.clone(), name.to_owned());
            tasks.spawn_blocking(move || runtimes.refresh_models(&[&name]));
        }
        Ok(Registered {
            runtimes: self.clone(),
            id,
        })
    }

    /// The runtime of a name, whether or not it is on or available.
    pub fn get(&self, name: &str) -> Option<Arc<dyn Runtime>> {
        let state = locked(&self.0.state);
        let entry = state.entries.iter().find(|entry| entry.name == name)?;
        Some(entry.runtime.clone())
    }

    /// The names registered, in the order each was first registered.
    pub fn names(&self) -> Vec<String> {
        let state = locked(&self.0.state);
        let registered = |name: &&String| state.entries.iter().any(|entry| &entry.name == *name);
        state.order.iter().filter(registered).cloned().collect()
    }

    /// The names registered, the default agent first while it is registered and on in the
    /// repository, then in the order each was first registered: the order every list of the
    /// runtimes shows them in.
    pub fn ordered(&self, repository: Option<&str>) -> Vec<String> {
        let mut names = self.names();
        let listed = self.extensions();
        let default = self.default_agent();
        let first = default.filter(|name| on(&listed, name, repository));
        if let Some(at) = first.and_then(|name| names.iter().position(|known| *known == name)) {
            let name = names.remove(at);
            names.insert(0, name);
        }
        names
    }

    /// The settings' `runs.default_agent`, as the config folder's file says now: none when
    /// unset, or the file cannot be read.
    fn default_agent(&self) -> Option<String> {
        let settings = uraeda_core::settings::read(&self.0.config_dir).ok()?;
        settings.runs.default_agent
    }

    /// Whether the runtime of a name is on in a repository, by its name in the list, or in
    /// every repository for none: where the owner left its extension on. A name that is no
    /// extension's is on everywhere.
    pub fn is_on(&self, name: &str, repository: Option<&str>) -> bool {
        on(&self.extensions(), name, repository)
    }

    /// The names of the runtimes on in a repository, the default agent first: the first is the
    /// one a new session runs on until another is picked.
    pub fn on_in(&self, repository: Option<&str>) -> Vec<String> {
        let listed = self.extensions();
        let names = self.ordered(repository).into_iter();
        names.filter(|name| on(&listed, name, repository)).collect()
    }

    /// A runtime's name for people in a refusal, registered or not: its extension's title, else
    /// the name itself.
    pub fn title(&self, name: &str) -> String {
        let mut listed = self.extensions().into_iter();
        let extension = listed.find(|extension| extension.name == name);
        extension.map_or_else(|| name.to_owned(), |extension| extension.title)
    }

    /// The extensions, the built-in ones and the owner's, with where each is on, as the config
    /// folder says now.
    fn extensions(&self) -> Vec<Extension> {
        extensions::read(&self.0.config_dir).extensions
    }

    /// The runtime's status at its last check: unchecked for a name that is not registered.
    pub fn status(&self, name: &str) -> Status {
        let state = locked(&self.0.state);
        let entry = state.entries.iter().find(|entry| entry.name == name);
        entry.map(|entry| entry.status.clone()).unwrap_or_default()
    }

    /// The runtime's last model list: none before one, nor for a runtime that lists none.
    pub fn models(&self, name: &str) -> Option<ModelList> {
        let state = locked(&self.0.state);
        let entry = state.entries.iter().find(|entry| entry.name == name)?;
        entry.models.clone()
    }

    /// Asks each runtime for its version, all at once, and keeps what they answer. It waits
    /// for them: call it from a blocking thread.
    pub fn check(&self) -> Checked {
        let asked: Vec<(u64, Arc<dyn Runtime>)> = {
            let state = locked(&self.0.state);
            let entries = state.entries.iter();
            entries
                .map(|entry| (entry.id, entry.runtime.clone()))
                .collect()
        };
        let asks = asked.into_iter().map(|(id, runtime)| {
            let version = tokio::task::spawn_blocking(move || runtime.version());
            async move { (id, version.await.ok().flatten()) }
        });
        let answers = wait(futures_util::future::join_all(asks));
        let mut found = Checked::default();
        let mut state = locked(&self.0.state);
        for (id, version) in answers {
            let Some(entry) = state.entries.iter_mut().find(|entry| entry.id == id) else {
                continue;
            };
            let status = Status {
                available: version.is_some(),
                version,
            };
            if status != entry.status {
                found.changed = true;
                found.back |= status.available;
                entry.status = status;
            }
        }
        found
    }

    /// Asks the runtimes of these names for their model lists, each at most once a minute: one
    /// asked for less than a minute ago waits for that ask, and asks nothing. A list that
    /// cannot be read, or not within 15 seconds, keeps the last one. Each list that changed
    /// tells the listeners. It waits for them: call it from a blocking thread.
    pub fn refresh_models(&self, names: &[&str]) {
        for name in names {
            let found = {
                let state = locked(&self.0.state);
                let entry = state.entries.iter().find(|entry| entry.name == *name);
                entry.map(|entry| (entry.id, entry.runtime.clone(), entry.listing.clone()))
            };
            let Some((id, runtime, listing)) = found else {
                continue;
            };
            let mut listed_at = locked(&listing);
            if listed_at.is_some_and(|at| at.elapsed() < MODELS_REFRESH) {
                continue;
            }
            *listed_at = Some(Instant::now());
            let ask = tokio::task::spawn_blocking(move || runtime.models());
            let answer = wait(tokio::time::timeout(MODELS_REFRESH_TIMEOUT, ask));
            if let Ok(Ok(Ok(Some(list)))) = answer {
                self.listed(id, list);
            }
        }
    }

    /// Keeps a runtime's list, if it is still registered, and tells the listeners when it
    /// changed.
    fn listed(&self, id: u64, list: ModelList) {
        let changed = {
            let mut state = locked(&self.0.state);
            let entry = state.entries.iter_mut().find(|entry| entry.id == id);
            entry.is_some_and(|entry| {
                let changed = entry.models.as_ref() != Some(&list);
                entry.models = Some(list);
                changed
            })
        };
        if changed {
            self.changed();
        }
    }

    /// Calls `listener` at each registration, each removal, and each [`Runtimes::changed`].
    pub fn on_change(&self, listener: impl Fn() + Send + Sync + 'static) {
        locked(&self.0.listeners).push(Arc::new(listener));
    }

    /// Tells the listeners that the runtimes, or where they are on, changed.
    pub fn changed(&self) {
        let listeners = locked(&self.0.listeners).clone();
        for listener in listeners {
            listener();
        }
    }

    /// Removes one registration, keeping its status for the next runtime of its name.
    fn remove(&self, id: u64) {
        let removed = {
            let mut state = locked(&self.0.state);
            let at = state.entries.iter().position(|entry| entry.id == id);
            at.map(|at| {
                let entry = state.entries.remove(at);
                state.last.insert(entry.name, entry.status);
            })
        };
        if removed.is_some() {
            self.changed();
        }
    }
}

/// Whether the extension of a name is on in a repository: one that is not listed is.
fn on(listed: &[Extension], name: &str, repository: Option<&str>) -> bool {
    let extension = listed.iter().find(|extension| extension.name == name);
    extension.is_none_or(|extension| extensions::is_on(extension, repository))
}

/// A runtime's registration: [`Registered::remove`] ends it. Dropping it leaves the runtime
/// registered, as a built-in's is for as long as the server runs.
pub struct Registered {
    runtimes: Runtimes,
    id: u64,
}

impl Registered {
    /// Removes the runtime: its name is free again, and its sessions are read-only until a
    /// runtime of that name returns. Its open processes are whoever opened them's to close.
    pub fn remove(self) {
        self.runtimes.remove(self.id);
    }
}
