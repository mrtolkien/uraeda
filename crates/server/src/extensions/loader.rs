//! The loader: the state of every extension in the server, and the one thread that changes it.
//!
//! It reads the extensions of the config folder through the core, and no other path: never a
//! repository's files. For each of the owner's it builds and signs the page, compiles the server
//! entry's files, stops the VM of the version before, and starts the new one. A version that
//! does not compile leaves the one before it running, and a page that does not build the page
//! before it. Built-in extensions are listed and never loaded here: their server parts are
//! Uraeda's own code.
//!
//! The thread is told what to do through [`Wake`]: to read the extensions again, when the
//! watcher saw a change or an action wrote the settings, and that a VM ended by itself. It
//! does one thing at a time, so a load never meets another load.

use std::collections::{BTreeSet, HashMap};
use std::path::{Path, PathBuf};
use std::sync::mpsc::{Receiver, SyncSender};

use axum::body::Bytes;
use uraeda_core::extensions::{self, EXTENSION_API, Extension};
use uraeda_protocol::{ExtensionRecord, ExtensionState, Extensions as ExtensionsRecord};

use super::api::ServerHost;
use super::graph::{self, Problem};
use super::pages::{self, Outcome};
use super::vm::{End, Thrown, Vm};
use super::watch::Watches;
use super::{Extensions, events, status};
use crate::live::Bus;
use crate::runtimes::Runtimes;
use crate::shared::Shared;

/// What the loader's thread is told.
pub(super) enum Wake {
    /// Read the extensions again: one whose manifest, settings, or repositories changed loads
    /// again, and `force` does whatever changed. `done` is dropped once it is read.
    Scan {
        force: Option<String>,
        done: Option<SyncSender<()>>,
    },
    /// The VM of this version of an extension ended by itself, with what it threw.
    Ended {
        name: String,
        version: u64,
        thrown: Thrown,
    },
    /// The server stops: every VM stops, and the thread ends.
    Stop,
}

/// What the server knows of its extensions.
#[derive(Default)]
pub(super) struct State {
    /// The owner's extensions folder, as messages show it.
    pub folder: String,
    /// Every extension as the core last read it, the built-in ones first.
    pub listed: Vec<Extension>,
    /// The owner's extensions, by name, as the loader holds each.
    pub entries: HashMap<String, Entry>,
    /// The sessions at work on each extension's runtime, the oldest first: its reload waits.
    pub holds: HashMap<String, Vec<(u64, String)>>,
    pub next_hold: u64,
}

/// One of the owner's extensions, as the loader holds it.
pub(super) struct Entry {
    /// What it was loaded from: its manifest, where it is on, and its settings. A change of it
    /// loads it again.
    print: String,
    pub state: ExtensionState,
    pub waiting_for: Option<String>,
    pub problems: Vec<Problem>,
    /// How many versions were started, the last the one running when it is on.
    pub version: u64,
    pub vm: Option<Vm>,
    /// The files of the last version that compiled, from its folder.
    files: Vec<String>,
    /// Its running page, the last that built; why the build after it failed; and what clients
    /// reported of it.
    pub page: Option<Page>,
    pub page_failure: Vec<Problem>,
    pub page_problems: Vec<Problem>,
}

/// An extension's running page: built and signed by [`pages::build`].
pub(super) struct Page {
    /// Its build's number, which only grows, across restarts too.
    pub version: u64,
    /// The page's entry, from the extension's folder.
    pub entry: String,
    /// The page as a signed NSH package.
    pub package: Bytes,
    /// What it was built from, as one text: built again from the same, it stays.
    pub print: String,
}

impl Entry {
    fn new() -> Entry {
        Entry {
            print: String::new(),
            state: ExtensionState::Off,
            waiting_for: None,
            problems: Vec::new(),
            version: 0,
            vm: None,
            files: Vec::new(),
            page: None,
            page_failure: Vec::new(),
            page_problems: Vec::new(),
        }
    }
}

/// The loader, on its thread.
struct Loader {
    shared: Shared,
    extensions: Extensions,
    watches: Watches,
    tasks: tokio::runtime::Handle,
    /// The extensions whose records must be read again.
    changed: BTreeSet<String>,
}

/// Runs the loader until the server stops.
pub(super) fn run(
    shared: Shared,
    extensions: Extensions,
    wakes: &Receiver<Wake>,
    tasks: tokio::runtime::Handle,
) {
    let _tokio = tasks.enter();
    let watches = Watches::start(&shared, extensions.waker());
    let mut loader = Loader {
        shared,
        extensions,
        watches,
        tasks: tasks.clone(),
        changed: BTreeSet::new(),
    };
    while let Ok(first) = wakes.recv() {
        let mut force = BTreeSet::new();
        let (mut scan, mut waiting) = (false, Vec::new());
        for wake in std::iter::once(first).chain(wakes.try_iter()) {
            match wake {
                Wake::Stop => return loader.stop(),
                Wake::Ended {
                    name,
                    version,
                    thrown,
                } => loader.ended(&name, version, &thrown),
                Wake::Scan { force: name, done } => {
                    scan = true;
                    force.extend(name);
                    waiting.extend(done);
                }
            }
        }
        if scan {
            loader.scan(&force);
        }
        loader.announce();
        drop(waiting);
    }
}

impl Loader {
    /// Reads the extensions: a new one, or one whose manifest, settings, or repositories
    /// changed, loads, as does each of `force`; one gone from the folder unloads.
    fn scan(&mut self, force: &BTreeSet<String>) {
        let config = self.shared.config_dir().to_owned();
        let read = extensions::read(&config);
        let on = |listed: &[Extension]| -> Vec<(String, bool, Vec<String>)> {
            let rows = listed.iter();
            rows.map(|one| (one.name.clone(), one.on_all, one.on.clone()))
                .collect()
        };
        let moved = {
            let mut state = self.extensions.state();
            let moved = on(&state.listed) != on(&read.extensions);
            state.folder = read.folder;
            state.listed.clone_from(&read.extensions);
            moved
        };
        let yours: Vec<&Extension> = read
            .extensions
            .iter()
            .filter(|one| !one.is_built_in)
            .collect();
        for extension in &yours {
            let print = print_of(&config, extension);
            let same = {
                let state = self.extensions.state();
                let known = state.entries.get(&extension.name);
                known.is_some_and(|entry| entry.print == print)
            };
            if !same || force.contains(&extension.name) {
                self.load(extension, print);
                self.changed.insert(extension.name.clone());
            }
        }
        let gone: Vec<String> = {
            let state = self.extensions.state();
            let names = state.entries.keys();
            names
                .filter(|name| !yours.iter().any(|one| &one.name == *name))
                .cloned()
                .collect()
        };
        for name in gone {
            let entry = self.extensions.state().entries.remove(&name);
            stop(entry.and_then(|entry| entry.vm));
            self.watches.forget(&name);
            pages::forget(&self.shared, &name);
            self.changed.insert(name);
        }
        if moved {
            // Where a runtime is on is where its extension is.
            self.shared.get::<Runtimes>().changed();
        }
    }

    /// Loads one version of an extension: off or broken by its manifest; else its page built,
    /// its server's files compiled, and on a problem the running version kept; else the running
    /// version stopped, then the new one started, and broken when its activation throws or runs
    /// over its time.
    fn load(&mut self, extension: &Extension, print: String) {
        let name = extension.name.as_str();
        let (running, version, files, held, paged) = {
            let mut state = self.extensions.state();
            let held = state.holds.get(name).and_then(|holds| holds.first());
            let held = held.map(|(_, title)| title.clone());
            let entry = state
                .entries
                .entry(name.to_owned())
                .or_insert_with(Entry::new);
            let paged = entry.page.as_ref().map(|page| page.print.clone());
            (
                entry.vm.clone(),
                entry.version,
                entry.files.clone(),
                held,
                paged,
            )
        };
        if let (Some(title), Some(_)) = (held, &running) {
            // A session works on its runtime: the load is asked again as the session's hold
            // goes, and the print stays the old one until then.
            return self.set(name, |entry| {
                entry.state = ExtensionState::Waiting;
                entry.waiting_for = Some(title);
            });
        }
        let mut problems: Vec<Problem> = extension.problems.iter().map(problem_of).collect();
        let folder = PathBuf::from(&extension.folder);
        let fatal = extension.problems.iter().any(|problem| problem.is_fatal);
        let other_api = extension.api != EXTENSION_API;
        let off = !extension.on_all && extension.on.is_empty();
        if fatal || other_api || off {
            // Its folder stays watched: a fixed manifest is seen. No page of it is served.
            self.watches.follow(extension, &files, &[]);
            self.set(name, |entry| {
                entry.page = None;
                entry.page_failure.clear();
            });
            stop(running);
            if other_api && !fatal {
                let (built, runs) = (extension.api, EXTENSION_API);
                let why = format!("built for extension API {built}, and Uraeda runs API {runs}");
                problems.push(Problem::of("extension.toml", why));
            }
            let state = if fatal {
                ExtensionState::Broken
            } else {
                ExtensionState::Off
            };
            return self.replace(name, print, state, problems, None, version);
        }
        let page = self.page(extension, paged.as_deref());
        let server = extension.server.as_deref().map(Path::new);
        let graph = match server
            .map(|entry| graph::compile(&folder, entry))
            .transpose()
        {
            Ok(graph) => graph,
            Err(failure) => {
                // The working version's files, the files at fault, and those imports looked
                // for: a fix loads it again.
                let faulty = failure.problems.iter().map(|problem| problem.file.clone());
                let mut watched = files;
                watched.extend(faulty.chain(failure.missing));
                self.watches.follow(extension, &watched, &page);
                problems.extend(failure.problems);
                return self.set(name, |entry| {
                    entry.print = print;
                    entry.waiting_for = None;
                    entry.state = match entry.vm {
                        Some(_) => ExtensionState::On,
                        None => ExtensionState::Broken,
                    };
                    entry.problems = problems;
                });
            }
        };
        let files: Vec<String> = graph
            .iter()
            .flat_map(graph::Graph::files)
            .map(str::to_owned)
            .collect();
        self.watches.follow(extension, &files, &page);
        stop(running);
        let version = version + 1;
        let vm = match graph.map(|graph| self.start(name, &folder, version, &graph)) {
            Some(Err(problem)) => {
                problems.push(problem);
                return self.replace(name, print, ExtensionState::Broken, problems, None, version);
            }
            Some(Ok(vm)) => Some(vm),
            None => None,
        };
        self.replace(name, print, ExtensionState::On, problems, vm, version);
        self.set(name, |entry| entry.files = files);
        // One that listens to a step or a commit is told what moves from where things are now.
        events::seed(&self.shared);
    }

    /// Builds and signs the extension's page, beside its server's files: a new version replaces
    /// the running one, and one that does not build keeps it, with why. The folders of the
    /// page's files, from the extension's folder, are what a save builds it again from.
    fn page(&self, extension: &Extension, running: Option<&str>) -> Vec<PathBuf> {
        let name = extension.name.as_str();
        let Some(entry) = extension.page.as_deref() else {
            self.set(name, |entry| {
                entry.page = None;
                entry.page_failure.clear();
            });
            return Vec::new();
        };
        let built = pages::build(&self.shared, extension, Path::new(entry), running);
        self.set(name, |entry| match built.outcome {
            Outcome::Built(page) => {
                entry.page = Some(page);
                entry.page_failure.clear();
                // A new page starts without the problems of the one before.
                entry.page_problems.clear();
            }
            Outcome::Same => entry.page_failure.clear(),
            Outcome::Failed(problems) => entry.page_failure = problems,
        });
        built.folders
    }

    /// Starts the VM of one version, which tells the loader if it ends by itself.
    fn start(
        &self,
        name: &str,
        folder: &Path,
        version: u64,
        graph: &graph::Graph,
    ) -> Result<Vm, Problem> {
        let host = Box::new(ServerHost::new(&self.shared, folder.to_owned()));
        let (waker, ended) = (self.extensions.waker(), name.to_owned());
        let on_end = move |end| {
            if let End::Failed(thrown) = end {
                let name = ended;
                let _ = waker.send(Wake::Ended {
                    name,
                    version,
                    thrown,
                });
            }
        };
        let started = Vm::start(name, graph.to_json(), host, self.tasks.clone(), on_end);
        started.map_err(|thrown| failure(&thrown, name, graph.entry()))
    }

    /// A VM ended by itself: its extension is broken, with what it threw, until its files or
    /// its settings change.
    fn ended(&mut self, name: &str, version: u64, thrown: &Thrown) {
        let ended = {
            let mut state = self.extensions.state();
            let entry = state.entries.get_mut(name);
            let entry = entry.filter(|entry| entry.version == version && entry.vm.is_some());
            entry.map(|entry| {
                let file = entry.files.first().cloned().unwrap_or_default();
                entry.problems.push(failure(thrown, name, &file));
                entry.state = ExtensionState::Broken;
                entry.vm.take()
            })
        };
        if let Some(vm) = ended {
            eprintln!("uraeda: {name}: {}", thrown.message);
            stop(vm);
            self.changed.insert(name.to_owned());
        }
    }

    /// Replaces what an entry holds, after a load.
    fn replace(
        &self,
        name: &str,
        print: String,
        state: ExtensionState,
        problems: Vec<Problem>,
        vm: Option<Vm>,
        version: u64,
    ) {
        self.set(name, |entry| {
            entry.print = print;
            entry.state = state;
            entry.waiting_for = None;
            entry.problems = problems;
            entry.vm = vm;
            entry.version = version;
        });
    }

    fn set(&self, name: &str, change: impl FnOnce(&mut Entry)) {
        if let Some(entry) = self.extensions.state().entries.get_mut(name) {
            change(entry);
        }
    }

    /// Says what changed: the `Extensions` record, the records of the extensions that loaded
    /// or went, and the status file `ura extension list` reads.
    fn announce(&mut self) {
        let bus = self.shared.get::<Bus>();
        bus.changed_all::<ExtensionsRecord>();
        let changed = std::mem::take(&mut self.changed);
        if !changed.is_empty() {
            bus.changed_where::<ExtensionRecord>(|args| changed.contains(&args.extension));
        }
        status::write(&self.shared, &self.extensions);
    }

    /// Stops every VM, and the watches, as the server stops.
    fn stop(mut self) {
        self.watches.close();
        let running: Vec<Vm> = {
            let mut state = self.extensions.state();
            let entries = state.entries.values_mut();
            entries.filter_map(|entry| entry.vm.take()).collect()
        };
        // Each is told first, so they end together.
        running.iter().for_each(Vm::halt);
        running.into_iter().for_each(|vm| stop(Some(vm)));
    }
}

/// Stops a VM, and waits for it: everything it started is released.
fn stop(vm: Option<Vm>) {
    if let Some(vm) = vm {
        vm.stop();
    }
}

/// What an extension is loaded from, as one text: its manifest, where it is on, its settings
/// for every repository, and the values set for one.
fn print_of(config: &Path, extension: &Extension) -> String {
    let name = &extension.name;
    let all = extensions::settings_json(config, name, None);
    let own = extensions::repository_settings_json(config, name);
    format!("{extension:?}\n{all}\n{own}")
}

/// The core's problem as the loader shows it.
pub(super) fn problem_of(problem: &extensions::ExtensionProblem) -> Problem {
    Problem {
        file: problem.file.clone(),
        line: problem.line,
        message: problem.message.clone(),
    }
}

/// The problem a throw is: in the file of the extension its stack names first, else in
/// `entry`. No line: the compiled code's lines are not the source's.
fn failure(thrown: &Thrown, name: &str, entry: &str) -> Problem {
    let prefix = format!("{name}/");
    let named = thrown.stack.split_once(&prefix).map(|(_, rest)| {
        let end = rest.find(|c: char| c == ':' || c == ')' || c.is_whitespace());
        &rest[..end.unwrap_or(rest.len())]
    });
    let file = named.filter(|file| !file.is_empty()).unwrap_or(entry);
    Problem::of(file, thrown.message.clone())
}
