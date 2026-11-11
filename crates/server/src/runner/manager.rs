//! The sessions' manager: at most one process and one turn per session, and one working session
//! per change or feature, whose sessions work in its worktree; a chat works in the main
//! checkout. Turns and their events go to the store, and every change to the bus.
//!
//! [`Runner`] is how the server reaches it: `Runner::of(&shared)`. Its parts are beside this
//! file, each a set of its methods: a session's [process](super::processes), the
//! [transcript](super::transcript) its events are recorded in, its [turns](super::running), a
//! message's [way in](super::send), the [continues](super::continuer), and the
//! [step chain](super::chain).
//!
//! # Where its code runs
//!
//! Every method is a plain function, called on a blocking thread, as a handler's: it reads the
//! core, the store, and a runtime as they are. What it keeps in memory is one [`State`], behind
//! one lock, held for a few statements at a time and never across a read of the core or a call
//! of a runtime. A session's sends and turn starts take that session's own lock, one after
//! another. A process's events are read by a task, which records each on a blocking thread,
//! in order. A timer is a task that waits, then acts.

use std::collections::HashMap;
use std::future::Future;
use std::sync::{Arc, Mutex, MutexGuard};
use std::time::{Duration, SystemTime};

use tokio::runtime::Handle;
use tokio::sync::watch;

use super::live::{Live, Lives, Timer};
use super::session::Session;
use super::store::{Store, StoreError};
use super::turn::TurnState;
use super::turns::TurnEnd;
use super::{catch_ups, continuer, processes, starts, sub_sessions};
use crate::live::{Fault, locked};
use crate::records::repositories;
use crate::runtimes::Runtimes;
use crate::shared::Shared;

/// Why a turn stopped as the server stopped, or as the next start found it left running.
pub const SERVER_STOPPED: &str = "Stopped: the server stopped while it ran.";

/// Why a queued turn stopped as the human took its message back: it never asks for them.
pub const TAKEN_BACK: &str = "Taken back.";

/// A session's process is closed after this long without a turn, and resumed by its next
/// message.
pub const IDLE_CLOSE: Duration = Duration::from_secs(15 * 60);

/// A turn without any output for this long is stopped, and fails.
pub const WATCHDOG: Duration = Duration::from_secs(30 * 60);

/// A signal follows an unanswered interrupt after this long, and the next as long after. A
/// closed process still running this long after is signalled too.
pub const TERMINATE_AFTER: Duration = Duration::from_secs(10);

/// What the sessions refuse, in the words the human reads.
pub(crate) mod refusals {
    /// A write on a feature while its agent works.
    pub const WORKING: &str = "An agent is working on this feature. Stop it first, or wait for it.";
    pub const NO_BRANCH: &str = "This feature has no branch left: it is merged.";
    /// A take-back of a message the agent read.
    pub const READ: &str = "The agent already read it.";
    pub const BLANK: &str = "The message is empty.";
    /// A rename of a sub-session, which its parent's calls find by its task.
    pub const SUB_SESSION_NAME: &str = "A sub-agent's session keeps its task's name.";
    /// An allow of a blocked action no rule matches alone.
    pub const NO_RULE: &str = "No allow rule can match only this action.";
    pub const NOTHING_TO_ALLOW: &str = "No blocked action to allow.";
    pub const NO_IMAGES: &str = "This agent cannot read images.";
    pub const TOO_MANY_IMAGES: &str = "A message takes at most 10 images.";
    pub const WORKFLOW_IMAGES: &str = "The workflow's message takes no images.";
    pub const IMAGE_GONE: &str = "This image is gone: add it again.";
    /// A new session of a repository with every runtime off there.
    pub const NO_RUNTIME: &str = "No agent runtime is on here: turn one on in Settings, Extensions";
    /// A session moved, or a change moved or dropped, while its agent works.
    pub const AGENT_WORKING: &str = "The agent is working";
    /// A dismiss of a turn that runs or waits.
    pub const STILL_RUNNING: &str = "The run is still going.";
    /// A dismiss of a queued message taken back.
    pub const TAKEN_BACK: &str = "This message was taken back: it never ran.";
    /// A message, a run, or a new session of a dropped change or feature.
    pub const DROPPED: &str = "This change or feature was dropped: its branch stays.";
    /// The main checkout's writes while a chat's agent works in it.
    pub const CHAT_WORKS: &str = "An agent works in this checkout: wait for its turn to end.";

    pub fn unavailable(name: &str) -> String {
        format!("{name} is not available on this machine.")
    }

    /// A message to a session whose runtime is off in its repository, or not registered.
    pub fn runtime_off(title: &str) -> String {
        format!("{title} is off: turn it on to continue this session")
    }

    pub fn no_model(runtime: &str, model: &str) -> String {
        format!("{runtime} has no model {model}: pick another")
    }

    pub fn no_effort(model: &str, effort: &str) -> String {
        format!("{model} takes no {effort} effort: pick another")
    }

    pub fn step_model_gone(step: &str, model: &str, agent: &str) -> String {
        format!("{step} runs on {model}, which {agent} no longer lists.")
    }

    /// A message to a session of a change or a feature while another of its sessions works.
    pub fn other_working(kind: &str) -> String {
        format!("Another session of this {kind} is working")
    }
}

/// A message a chat takes at most this many images.
pub const MAX_IMAGES: usize = 10;

/// What the manager keeps in memory, behind its one lock.
#[derive(Default)]
pub(super) struct State {
    pub lives: Lives,
    /// What numbers each process opened.
    pub next_proc: u64,
    /// The turns not ended yet, each told once it ended.
    pub pending: HashMap<i64, watch::Sender<bool>>,
    pub continues: continuer::Continues,
    pub subs: sub_sessions::Calls,
    pub usage: processes::Usage,
    pub starts: starts::Kept,
    pub catching: catch_ups::Catching,
    /// The server stops: no timer is armed, and no turn starts.
    pub closed: bool,
}

/// The sessions' manager, as the server provides it: `shared.get::<Sessions>()`. It holds what
/// is kept in memory: [`Runner`] is what acts on it.
pub struct Sessions(Arc<Inner>);

pub(super) struct Inner {
    /// The server's runtime: the manager is also called from threads outside it.
    handle: Handle,
    state: Mutex<State>,
    /// The server, for what is told of a change outside any call: none once it stopped.
    shared: Mutex<Option<Shared>>,
    /// Each main checkout's name in the list, as last read: every event of a reply names its
    /// repository on the bus. Forgotten when the list changes.
    names: Mutex<HashMap<String, Option<String>>>,
}

/// What follows the runtimes for the manager, without holding the server once it stopped.
pub(super) struct Following(Arc<Inner>);

impl Following {
    pub(super) fn of(runner: &Runner) -> Following {
        *locked(&runner.inner.shared) = Some(runner.shared.clone());
        Following(runner.inner.clone())
    }

    /// The list of repositories changed: each name is read again.
    pub(super) fn list_changed(&self) {
        locked(&self.0.names).clear();
    }

    /// A runtime registered, removed, or turned on or off: it is shown at once, and checked
    /// a moment later. One turned on finds no change of availability, but continues the runs
    /// a restart cut on it.
    pub(super) fn runtimes_changed(&self) {
        let Some(shared) = locked(&self.0.shared).clone() else {
            return;
        };
        let runner = Runner {
            shared,
            inner: self.0.clone(),
        };
        runner.agent_changed();
        runner.task({
            let runner = runner.clone();
            async move {
                tokio::time::sleep(super::CHECK_AFTER_CHANGE).await;
                let checked = tokio::task::spawn_blocking(move || runner.check(true));
                let _ = checked.await;
            }
        });
    }
}

impl Sessions {
    /// The manager of a server, on the runtime it starts in.
    pub(super) fn new() -> Sessions {
        Sessions(Arc::new(Inner {
            handle: Handle::current(),
            state: Mutex::default(),
            shared: Mutex::default(),
            names: Mutex::default(),
        }))
    }
}

/// The sessions' manager, with the server it runs in: what every call on it goes through. A
/// handle, cheap to clone.
#[derive(Clone)]
pub(crate) struct Runner {
    pub(crate) shared: Shared,
    inner: Arc<Inner>,
}

impl Runner {
    /// The manager of a server.
    pub(crate) fn of(shared: &Shared) -> Runner {
        Runner {
            shared: shared.clone(),
            inner: shared.get::<Sessions>().0.clone(),
        }
    }

    /// The manager of a server, once it mounted: none before, and in a test without it.
    pub(crate) fn find(shared: &Shared) -> Option<Runner> {
        let sessions = shared.find::<Sessions>()?;
        Some(Runner {
            shared: shared.clone(),
            inner: sessions.0.clone(),
        })
    }

    /// Lets go of the server, as it stops: what follows the runtimes does nothing more.
    pub(super) fn let_go(&self) {
        locked(&self.inner.shared).take();
    }

    /// Asks each runtime for its version, and says a change of availability. A runtime back,
    /// or `continue_cuts`, continues the runs the server's restart cut, on the runtimes that
    /// work.
    pub(crate) fn check(&self, continue_cuts: bool) {
        if self.state().closed {
            return;
        }
        self.refresh_all_accounts();
        let found = self.runtimes().check();
        if found.changed {
            self.agent_changed();
        }
        if found.back || continue_cuts {
            self.agent_back();
        }
    }

    /// What the manager does once the server started, off its start: the chat images no
    /// message holds are cleaned, the runtimes checked, now and every minute, the continues
    /// armed, the pull requests caught up, and the previews of what waits for the human
    /// started.
    pub(super) fn started(self) {
        let every = self.clone();
        self.spawn(|runner| {
            crate::files::chat_images::clean(&runner.shared);
            runner.check(false);
            // Once the repositories and the runtimes are there: a run of one no longer
            // listed does not go on after a restart.
            runner.start_continues();
            runner.catch_up_all();
            crate::preview::warm_all_waiting(&runner.shared);
        });
        self.task(async move {
            loop {
                tokio::select! {
                    () = every.shared.stopping() => return,
                    () = tokio::time::sleep(super::CHECK_EVERY) => {}
                }
                let checking = every.clone();
                let checked = tokio::task::spawn_blocking(move || checking.check(false));
                let _ = checked.await;
            }
        });
    }

    pub(super) fn state(&self) -> MutexGuard<'_, State> {
        locked(&self.inner.state)
    }

    pub(crate) fn store(&self) -> Arc<Store> {
        self.shared.get::<Store>()
    }

    pub(super) fn runtimes(&self) -> Arc<Runtimes> {
        self.shared.get::<Runtimes>()
    }

    pub(super) fn now(&self) -> SystemTime {
        self.shared.now()
    }

    /// Makes this thread one of the server's runtime, until what it returns is dropped: a
    /// runtime is called where tokio is, and a start's landing, which sends its first run, is
    /// on the write queue's own thread.
    pub(crate) fn entered(&self) -> tokio::runtime::EnterGuard<'_> {
        self.inner.handle.enter()
    }

    /// Runs a future to its end, from a blocking thread.
    pub(super) fn wait<F: Future>(&self, future: F) -> F::Output {
        self.inner.handle.block_on(future)
    }

    /// Runs `work` on a blocking thread of its own, without waiting for it.
    pub(crate) fn spawn(&self, work: impl FnOnce(&Runner) + Send + 'static) {
        let runner = self.clone();
        self.inner.handle.spawn_blocking(move || work(&runner));
    }

    /// Runs a future in a task of its own.
    pub(super) fn task(&self, work: impl Future<Output = ()> + Send + 'static) {
        self.inner.handle.spawn(work);
    }

    /// Runs `work` on a blocking thread after a wait, unless the timer is dropped first.
    pub(super) fn after(
        &self,
        wait: Duration,
        work: impl FnOnce(&Runner) + Send + 'static,
    ) -> Timer {
        let runner = self.clone();
        let task = self.inner.handle.spawn(async move {
            tokio::time::sleep(wait).await;
            let _ = tokio::task::spawn_blocking(move || work(&runner)).await;
        });
        Timer(task.abort_handle())
    }

    /// Runs `act`, which waits for nothing, after a wait, unless the timer is dropped first: a
    /// signal to a process.
    pub(super) fn after_now(&self, wait: Duration, act: impl FnOnce() + Send + 'static) -> Timer {
        let task = self.inner.handle.spawn(async move {
            tokio::time::sleep(wait).await;
            act();
        });
        Timer(task.abort_handle())
    }

    /// The session of an id.
    pub(super) fn row(&self, session: &str) -> Result<Session, Fault> {
        let found = self.store().session(session)?;
        found.ok_or_else(|| Fault::internal(format!("no session {session}")))
    }

    /// The name in the list of the repository whose main checkout is `root`: none once it left
    /// the list.
    pub(crate) fn name_of(&self, root: &str) -> Option<String> {
        if let Some(known) = locked(&self.inner.names).get(root) {
            return known.clone();
        }
        let listed = repositories::all(&self.shared).into_iter();
        let mut listed = listed.filter(|repository| !repository.missing);
        let found = listed.find(|repository| repository.path.to_string_lossy() == root);
        let name = found.map(|repository| repository.name);
        locked(&self.inner.names).insert(root.to_owned(), name.clone());
        name
    }

    /// The main checkout of a listed repository, as its sessions name it.
    pub(crate) fn root_of(&self, repository: &str) -> Result<String, Fault> {
        let path = repositories::path(&self.shared, repository)?;
        Ok(path.to_string_lossy().into_owned())
    }

    /// The session of an id, when it is one of the repository's: the store holds every
    /// repository's.
    pub(crate) fn own(&self, repository: &str, session: &str) -> Result<Session, Fault> {
        let root = self.root_of(repository)?;
        let found = self.store().session(session)?;
        let own = found.filter(|row| row.repo == root);
        own.ok_or_else(|| Fault::refused(format!("no session {session}")))
    }

    /// The session's state in memory, made when it has none.
    pub(super) fn live_of<'a>(&self, state: &'a mut State, row: &Session) -> &'a mut Live {
        state.lives.of(row)
    }

    /// Runs `body` after the session's earlier sends and turn starts.
    pub(super) fn serial<T>(&self, row: &Session, body: impl FnOnce() -> T) -> T {
        let lock = {
            let mut state = self.state();
            let live = self.live_of(&mut state, row);
            live.calls += 1;
            live.lock.clone()
        };
        let _left = Left(self, &row.id);
        let _turn = locked(&lock);
        // The call took its place among the session's: its connection's next call may start.
        crate::live::placed();
        body()
    }

    /// Resolves once the turn has ended, at once when this server does not run it.
    pub(super) fn settled(&self, turn: i64) -> impl Future<Output = ()> + Send + use<> {
        let ended = self
            .state()
            .pending
            .get(&turn)
            .map(watch::Sender::subscribe);
        async move {
            if let Some(mut ended) = ended {
                let _ = ended.wait_for(|ended| *ended).await;
            }
        }
    }

    /// Stops every turn and closes every process, as the server stops, and waits for them.
    pub(super) fn close_all(&self) {
        let waits = {
            let mut state = self.state();
            state.closed = true;
            // A continue whose time comes while the processes close is the next start's.
            state.continues.close();
            let sessions: Vec<String> = state.lives.sessions.keys().cloned().collect();
            let mut waits = Vec::new();
            for session in sessions {
                let queued: Vec<i64> = match state.lives.get(&session) {
                    Some(live) => live.queue.drain(..).map(|queued| queued.id).collect(),
                    None => continue,
                };
                let stopped = TurnEnd::because(TurnState::Stopped, SERVER_STOPPED);
                for turn in queued {
                    self.end(&mut state, &session, turn, stopped.clone());
                }
                self.halt(&mut state, &session, stopped);
                if let Some(done) = self.close_proc(&mut state, &session) {
                    waits.push(done);
                }
            }
            waits
        };
        self.drop_kept();
        for mut done in waits {
            self.wait(async move {
                let _ = done.wait_for(|done| *done).await;
            });
        }
        // Nothing arms a timer any more: the ones left are dropped with what holds them.
        let mut state = self.state();
        for live in state.lives.sessions.values_mut() {
            live.idle = None;
            if let Some(turn) = live.turn.as_mut() {
                turn.watchdog = None;
                turn.terminate.clear();
            }
        }
    }
}

/// A call on a session ended: the session is forgotten once nothing of it is left in memory.
struct Left<'a>(&'a Runner, &'a str);

impl Drop for Left<'_> {
    fn drop(&mut self) {
        let mut state = self.0.state();
        if let Some(live) = state.lives.get(self.1) {
            live.calls = live.calls.saturating_sub(1);
        }
        state.lives.prune(self.1);
    }
}

impl From<StoreError> for Fault {
    /// The store failed: the server's own failure.
    fn from(error: StoreError) -> Fault {
        Fault::internal(error.to_string())
    }
}
