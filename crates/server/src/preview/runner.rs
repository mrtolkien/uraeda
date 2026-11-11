//! The preview runner: the only code that starts, watches, and stops preview commands, one per
//! checkout's base path, `/r/<name>/preview/<secret>/<folder>/`.
//!
//! - A view starts the checkout's command, which is ready once its index answers.
//! - A view after the checkout's code version moved, a commit outside `specs/`, or after its
//!   preview command changed, starts it again.
//! - It stops 30 minutes after its last view, when its checkout or its repository is removed,
//!   and with the server.

use std::collections::{HashMap, HashSet};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex, MutexGuard, PoisonError, Weak};
use std::time::{Duration, SystemTime};

use tokio::sync::watch;

use super::command::{Run, Start};
use super::groups::Groups;
use super::index::{self, NoIndex, StoryIndex};
use super::ports::{free_port, port_taken};
use super::warm::Compiles;
use crate::shared::Shared;

/// How often a starting preview's index is read.
const POLL: Duration = Duration::from_millis(250);
/// How long a preview may take to start.
const START: Duration = Duration::from_secs(120);
/// How long a preview runs without a view.
const IDLE: Duration = Duration::from_secs(30 * 60);
/// How long a preview's index may take to answer.
const INDEX: Duration = Duration::from_secs(5);

const TIMED_OUT: &str = "Storybook did not start within 2 minutes.";
const NO_PORT: &str = "No free port for Storybook.";
/// What a preview that does not run answers, and the state a stopped runner gives every view.
pub(crate) const NOT_RUNNING: &str = "Storybook is not running for this branch.";

/// A checkout's preview: starting, ready on its port, or failed, with the sentence to show.
#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) enum State {
    Starting,
    Ready { port: u16 },
    Failed { error: String },
}

/// A checkout to run a preview in.
#[derive(Clone, Debug)]
pub(crate) struct Checkout {
    /// The path it is served under, `/r/<name>/preview/<secret>/<folder>/`.
    pub base: String,
    /// Its preview decision's `preview-command`.
    pub command: String,
    /// The checkout's folder.
    pub dir: PathBuf,
    /// Its preview decision's `preview-folder`, from the checkout's top level.
    pub folder: String,
    /// The stamp [`Runner::read`] gave before the version was read.
    pub read: u64,
    /// The code version it has checked out, its last commit's tree outside `specs/`: none when
    /// it could not be read.
    pub version: Option<String>,
}

/// One checkout's preview, from its first view until it is stopped.
struct Entry {
    checkout: Checkout,
    /// The `read` stamp it started at: only a version read after it can move it.
    stamp: u64,
    /// When it started: the 2 minutes count from it, across the port's retry.
    started: SystemTime,
    live: Mutex<Live>,
    /// Told once the entry is stopped: its task ends.
    stopped: watch::Sender<bool>,
}

/// What changes while an entry lives.
struct Live {
    state: State,
    last_view: SystemTime,
    run: Option<Arc<Run>>,
    /// Its stories' compiles, once it is ready.
    compiles: Option<Arc<Compiles>>,
}

impl Entry {
    fn live(&self) -> MutexGuard<'_, Live> {
        self.live.lock().unwrap_or_else(PoisonError::into_inner)
    }

    /// Whether the entry's preview is at another code version than `now`'s, or runs another
    /// preview command or folder, which its decision under `specs/` sets without moving the
    /// version. One whose first version read failed is at an unknown version, which any known
    /// one is another than. A read begun before the preview started cannot say it moved: it may
    /// be the older of two views racing a move.
    fn moved(&self, now: &Checkout) -> bool {
        let Checkout {
            command,
            folder,
            version,
            ..
        } = &self.checkout;
        let other = (now.version.is_some() && now.version != *version)
            || now.command != *command
            || now.folder != *folder;
        other && now.read > self.stamp
    }
}

/// How a run of an entry's command ended.
enum Outcome {
    /// The entry failed, with the sentence to show.
    Failed(String),
    /// The command ended while it started, and another program holds its port now.
    PortTaken,
    /// The entry was stopped as its command started.
    Stopped,
}

/// What is told a base whose state changed, and whether a preview still lives under it.
type Changed = Box<dyn Fn(&str, bool) + Send + Sync>;

/// The preview commands of the server's checkouts, by base path.
#[derive(Clone)]
pub(crate) struct Runner(Arc<Inner>);

struct Inner {
    entries: Mutex<HashMap<String, Arc<Entry>>>,
    reads: AtomicU64,
    /// Set as the server stops: nothing starts again.
    closed: AtomicBool,
    /// Every command started and not known to have ended: what the server stops as it stops,
    /// whatever became of its entry.
    runs: Mutex<Vec<Arc<Run>>>,
    groups: Arc<Groups>,
    /// Called with a base whose state changed, and whether a preview still lives under it.
    on_change: Changed,
}

impl Runner {
    /// A runner that tells `on_change` each base whose state changed, and whether a preview
    /// still lives under it. It is called under the runner's own lock: it must not ask the
    /// runner.
    pub(super) fn new(
        shared: &Shared,
        on_change: impl Fn(&str, bool) + Send + Sync + 'static,
    ) -> Runner {
        Runner(Arc::new(Inner {
            entries: Mutex::default(),
            reads: AtomicU64::new(0),
            closed: AtomicBool::new(false),
            runs: Mutex::default(),
            groups: Arc::new(Groups::open(shared)),
            on_change: Box::new(on_change),
        }))
    }

    /// The checkout's state, its preview started when none runs, and the view recorded. A
    /// preview under the same base in another folder, a removed repository's whose name another
    /// one took, is stopped, and one started in the checkout. One started at another code
    /// version is started again. Once the runner is closed, failed with [`NOT_RUNNING`].
    pub(crate) fn view(&self, shared: &Shared, checkout: &Checkout) -> State {
        if self.0.closed.load(Ordering::Acquire) {
            let error = NOT_RUNNING.to_owned();
            return State::Failed { error };
        }
        let mut entries = self.0.entries();
        let current = entries.get(&checkout.base).cloned();
        let entry = match current {
            Some(entry) if entry.checkout.dir == checkout.dir && !entry.moved(checkout) => entry,
            current => {
                // Started before the other stops, so the base never goes without a state.
                let started = self.0.start(shared, &mut entries, checkout);
                if let Some(other) = current {
                    self.0.halt(&mut entries, &other);
                }
                started
            }
        };
        let mut live = entry.live();
        live.last_view = shared.now();
        live.state.clone()
    }

    /// A stamp for a code version read, taken before the read begins: the previews started
    /// since have a greater one, and a version read earlier does not move them.
    pub(crate) fn read(&self) -> u64 {
        self.0.reads.fetch_add(1, Ordering::AcqRel) + 1
    }

    /// The state of the preview under `base`: none when none was started, or it stopped.
    pub(crate) fn state(&self, base: &str) -> Option<State> {
        let entry = self.0.entries().get(base).cloned()?;
        let state = entry.live().state.clone();
        Some(state)
    }

    /// Records a view of the preview under `base`, if one lives: a frame's request for it.
    pub(crate) fn seen(&self, shared: &Shared, base: &str) {
        if let Some(entry) = self.0.entries().get(base).cloned() {
            entry.live().last_view = shared.now();
        }
    }

    /// Stops the checkout's preview, if one runs, and starts it again: a view too.
    pub(crate) fn restart(&self, shared: &Shared, checkout: &Checkout) -> State {
        {
            let mut entries = self.0.entries();
            if let Some(entry) = entries.get(&checkout.base).cloned() {
                self.0.halt(&mut entries, &entry);
            }
        }
        self.view(shared, checkout)
    }

    /// The index of the ready preview under `base`: none when none is ready, or it fails or does
    /// not answer in time.
    pub(crate) async fn index(&self, base: &str) -> Option<StoryIndex> {
        let Some(State::Ready { port }) = self.state(base) else {
            return None;
        };
        let read = tokio::time::timeout(INDEX, index::read(port)).await;
        read.ok()?.ok()
    }

    /// Whether the story's compile, in the ready preview under `base`, ended or passed its time:
    /// the first ask starts it. False while it runs, and when no preview is ready under `base`.
    /// Its end is a change of `base`.
    pub(crate) fn compiled(&self, base: &str, story: &index::Entry) -> bool {
        let entry = self.0.entries().get(base).cloned();
        let compiles = entry.and_then(|entry| entry.live().compiles.clone());
        compiles.is_some_and(|compiles| compiles.ended(story))
    }

    /// Stops each preview whose checkout was removed, and each without a view for 30 minutes.
    /// One whose base is in `kept` counts as viewed now.
    pub(crate) fn sweep(&self, shared: &Shared, kept: &HashSet<String>) {
        let now = shared.now();
        let mut entries = self.0.entries();
        let all: Vec<_> = entries.values().cloned().collect();
        for entry in all {
            if !entry.checkout.dir.exists() {
                self.0.halt(&mut entries, &entry);
            } else if kept.contains(&entry.checkout.base) {
                entry.live().last_view = now;
            } else if now
                .duration_since(entry.live().last_view)
                .is_ok_and(|idle| idle > IDLE)
            {
                self.0.halt(&mut entries, &entry);
            }
        }
    }

    /// Stops every preview whose base starts with `prefix`: a repository's, as it leaves the
    /// list, or all of them, as the frame secret is replaced. The runner stays open: the next
    /// view starts one again.
    pub(crate) fn stop_under(&self, prefix: &str) {
        let mut entries = self.0.entries();
        let all: Vec<_> = entries.values().cloned().collect();
        for entry in all
            .iter()
            .filter(|entry| entry.checkout.base.starts_with(prefix))
        {
            self.0.halt(&mut entries, entry);
        }
    }

    /// Stops every command the runner started, a stopped preview's that still ends too, and
    /// waits for each to end: nothing starts afterwards.
    pub(super) async fn close(&self) {
        let runs = {
            // Under the lock a command starts under: none starts once this is set.
            let mut runs = self.0.runs.lock().unwrap_or_else(PoisonError::into_inner);
            self.0.closed.store(true, Ordering::Release);
            std::mem::take(&mut *runs)
        };
        {
            let mut entries = self.0.entries();
            let all: Vec<_> = entries.values().cloned().collect();
            for entry in &all {
                self.0.stopped(&mut entries, entry);
            }
        }
        let stopping = runs
            .into_iter()
            .map(|run| tokio::spawn(async move { run.stop().await }));
        for stopped in stopping.collect::<Vec<_>>() {
            let _ = stopped.await;
        }
    }
}

impl Inner {
    fn entries(&self) -> MutexGuard<'_, HashMap<String, Arc<Entry>>> {
        self.entries.lock().unwrap_or_else(PoisonError::into_inner)
    }

    /// Starts the checkout's preview, under its base.
    fn start(
        self: &Arc<Self>,
        shared: &Shared,
        entries: &mut HashMap<String, Arc<Entry>>,
        checkout: &Checkout,
    ) -> Arc<Entry> {
        let now = shared.now();
        let entry = Arc::new(Entry {
            checkout: checkout.clone(),
            stamp: self.reads.load(Ordering::Acquire),
            started: now,
            live: Mutex::new(Live {
                state: State::Starting,
                last_view: now,
                run: None,
                compiles: None,
            }),
            stopped: watch::Sender::new(false),
        });
        entries.insert(checkout.base.clone(), entry.clone());
        (self.on_change)(&checkout.base, true);
        tokio::spawn(self.clone().launch(shared.clone(), entry.clone()));
        entry
    }

    /// Runs the entry's command until the entry fails or is stopped: a taken port is tried once
    /// more, on a new one.
    async fn launch(self: Arc<Self>, shared: Shared, entry: Arc<Entry>) {
        let mut stopped = entry.stopped.subscribe();
        let mut retried = false;
        loop {
            let outcome = tokio::select! {
                outcome = self.run(&shared, &entry) => outcome,
                _ = stopped.wait_for(|stopped| *stopped) => return,
            };
            match outcome {
                Outcome::Stopped => return,
                Outcome::PortTaken if !retried => retried = true,
                Outcome::PortTaken => return self.fail(&entry, NO_PORT.to_owned()),
                Outcome::Failed(error) => return self.fail(&entry, error),
            }
        }
    }

    /// Starts the entry's command on a free port, reads its index until it answers, then waits
    /// for the command to end: how it ended.
    async fn run(self: &Arc<Self>, shared: &Shared, entry: &Arc<Entry>) -> Outcome {
        let Checkout {
            base,
            command,
            dir,
            folder,
            ..
        } = &entry.checkout;
        let did_not_start = |why: &str| Outcome::Failed(format!("Storybook did not start: {why}"));
        let cwd = dir.join(folder);
        if !cwd.is_dir() {
            return did_not_start(&format!("{folder} is not a folder of this checkout."));
        }
        let Some(port) = free_port() else {
            return Outcome::Failed(NO_PORT.to_owned());
        };
        let start = Start {
            environment: shared.environment(),
            command,
            folder: &cwd,
            port,
            base,
        };
        let run = match self.started(&start) {
            Some(Ok(run)) => run,
            Some(Err(why)) => return did_not_start(&why),
            None => return Outcome::Stopped,
        };
        {
            // Under the lock a stop takes the command under: a stop that came first left it to
            // this task.
            let mut live = entry.live();
            if *entry.stopped.borrow() {
                tokio::spawn(async move { run.stop().await });
                return Outcome::Stopped;
            }
            live.run = Some(run.clone());
        }
        let (groups, leader) = (self.groups.clone(), run.leader());
        let _ = tokio::task::spawn_blocking(move || groups.add(leader)).await;
        let ended = |why: String| did_not_start(&run.reason().unwrap_or(why));
        loop {
            tokio::select! {
                why = run.ended() => {
                    return if port_taken(port) { Outcome::PortTaken } else { ended(why) };
                }
                () = tokio::time::sleep(POLL) => {}
            }
            if shared
                .now()
                .duration_since(entry.started)
                .is_ok_and(|taken| taken > START)
            {
                return Outcome::Failed(TIMED_OUT.to_owned());
            }
            match tokio::time::timeout(INDEX, index::read(port)).await {
                Ok(Ok(_)) => break,
                Ok(Err(NoIndex::Unreadable)) => {
                    return Outcome::Failed(index::UNREADABLE.to_owned());
                }
                Ok(Err(NoIndex::NotYet)) | Err(_) => {}
            }
        }
        self.ready(entry, port);
        // A command that ends once it was ready is failed too, with its last line.
        ended(run.ended().await)
    }

    /// Starts a command, and keeps it among the ones the server stops as it stops: none once
    /// the runner is closed.
    fn started(&self, start: &Start) -> Option<Result<Arc<Run>, String>> {
        let mut runs = self.runs.lock().unwrap_or_else(PoisonError::into_inner);
        if self.closed.load(Ordering::Acquire) {
            return None;
        }
        runs.retain(|run| !run.has_ended());
        let run = Run::start(start, self.groups.clone()).map(Arc::new);
        if let Ok(run) = &run {
            runs.push(run.clone());
        }
        Some(run)
    }

    /// The entry's preview answers: it is ready, and its stories compile from now on.
    fn ready(self: &Arc<Self>, entry: &Arc<Entry>, port: u16) {
        let base = entry.checkout.base.clone();
        let runner = Arc::downgrade(self);
        let compiled = move || {
            if let Some(runner) = Weak::upgrade(&runner) {
                let running = runner.entries().contains_key(&base);
                (runner.on_change)(&base, running);
            }
        };
        let entries = self.entries();
        if *entry.stopped.borrow() {
            return;
        }
        let mut live = entry.live();
        live.state = State::Ready { port };
        live.compiles = Some(Compiles::new(port, &entry.checkout.base, compiled));
        drop(live);
        (self.on_change)(&entry.checkout.base, held(&entries, entry));
    }

    /// The entry failed: its command, if it runs, is stopped, and the entry kept for its error.
    fn fail(&self, entry: &Arc<Entry>, error: String) {
        let entries = self.entries();
        if *entry.stopped.borrow() {
            return;
        }
        let mut live = entry.live();
        live.state = State::Failed { error };
        if let Some(compiles) = live.compiles.take() {
            compiles.abort();
        }
        let run = live.run.clone();
        drop(live);
        if let Some(run) = run {
            tokio::spawn(async move { run.stop().await });
        }
        (self.on_change)(&entry.checkout.base, held(&entries, entry));
    }

    /// Stops the entry, forgets it, and stops its command without waiting for it.
    fn halt(&self, entries: &mut HashMap<String, Arc<Entry>>, entry: &Arc<Entry>) {
        if let Some(run) = self.stopped(entries, entry) {
            tokio::spawn(async move { run.stop().await });
        }
    }

    /// Stops the entry, and forgets it: its command, to stop, if one runs.
    fn stopped(
        &self,
        entries: &mut HashMap<String, Arc<Entry>>,
        entry: &Arc<Entry>,
    ) -> Option<Arc<Run>> {
        entry.stopped.send_replace(true);
        let mut live = entry.live();
        if let Some(compiles) = live.compiles.take() {
            compiles.abort();
        }
        let run = live.run.take();
        drop(live);
        if held(entries, entry) {
            entries.remove(&entry.checkout.base);
            (self.on_change)(&entry.checkout.base, false);
        }
        run
    }
}

/// Whether the entry is the one its base has now.
fn held(entries: &HashMap<String, Arc<Entry>>, entry: &Arc<Entry>) -> bool {
    let current = entries.get(&entry.checkout.base);
    current.is_some_and(|current| Arc::ptr_eq(current, entry))
}
