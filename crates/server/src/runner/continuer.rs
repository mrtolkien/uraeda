//! The automatic continues of the run lifecycle decision: whether a stopped turn continues, and
//! when; the switches, the cap, and what sets the count back; the stagger; and the cancels. The
//! store holds every pending continue: a timer only wakes the server to claim one.

use std::collections::HashMap;
use std::path::Path;
use std::time::{Duration, SystemTime};

use uraeda_core::api;

use super::event::{Limit, LimitKind};
use super::live::Timer;
use super::manager::{Change, Runner, SERVER_STOPPED, State, TAKEN_BACK};
use super::message::continued_line;
use super::picks;
use super::running::line;
use super::send::of_dropped;
use super::session::Session;
use super::turn::{ContinueReason, Turn, TurnKind, TurnState};
use crate::records::{repositories, settings};

const MINUTE: Duration = Duration::from_secs(60);

/// A limit without a reset time is tried again this long after, each try counting toward the
/// cap.
const RETRY_WITHOUT_RESET: Duration = Duration::from_secs(60 * 60);

/// How long after its cut a run the server's stop cut continues at the next start.
pub const RESTART_WINDOW: Duration = Duration::from_secs(6 * 60 * 60);

/// Which automatic continues are on, and how many in a row a session takes: the `[runs]`
/// settings.
struct Runs {
    after_limit: bool,
    after_restart: bool,
    cap: u32,
}

impl Runs {
    fn on(&self, reason: ContinueReason) -> bool {
        match reason {
            ContinueReason::Limit => self.after_limit,
            ContinueReason::Restart => self.after_restart,
        }
    }
}

/// What the continuer keeps in memory.
#[derive(Default)]
pub(super) struct Continues {
    /// The timer of each pending continue this server armed, by its turn.
    timers: HashMap<i64, Timer>,
    /// The turn each continue queued, with the turn it continues, until it ends.
    claimed: HashMap<i64, i64>,
    /// The worktree commit of each session at its last continue.
    commits: HashMap<String, String>,
    /// The worktree commit each session's pending continue was decided at, kept as it fires.
    decided_at: HashMap<String, String>,
    /// How many times the human or the agent took each session's run over, by a message, an
    /// allow, Stop, a dismiss, or going on: a decision that read meanwhile is dropped.
    taken_over: HashMap<String, u64>,
    /// The takeover count of each session's latest Stop: a refused message restores no wait
    /// after.
    stops: HashMap<String, u64>,
    /// The continue of each parent that waits for its sub-sessions to end, by the parent.
    held: HashMap<String, i64>,
    /// Whether the pending continues were armed: the restart's scan waits for it.
    started: bool,
    /// Whether the server stops: no timer is armed then.
    closed: bool,
}

impl Continues {
    /// Clears every timer, as the server stops: the waits stay in the store, armed by no
    /// timer.
    pub(super) fn close(&mut self) {
        self.closed = true;
        self.timers.clear();
    }

    fn taken(&self, session: &str) -> u64 {
        self.taken_over.get(session).copied().unwrap_or_default()
    }
}

/// What a message that took a run's continue over cancelled, and how to put it back.
pub(super) struct Taken {
    cancelled: Vec<Turn>,
    /// The session's count of continues before.
    count: u32,
    /// Its takeover count after.
    taken: u64,
}

impl Taken {
    pub(super) fn turns(&self) -> Vec<i64> {
        self.cancelled.iter().map(|turn| turn.id).collect()
    }
}

/// What a turn's end leaves to decide, off the manager's lock, before its end is said.
pub(super) enum Decision {
    /// A session's limit failed it: it waits for the reset.
    Limit {
        turn: Box<Turn>,
        limit: Limit,
        taken: u64,
        parent: Option<String>,
    },
    /// A step's run ended done: the next step's run starts, before a gate.
    Chain {
        turn: i64,
        folder: String,
        step: String,
        taken: u64,
    },
}

impl Decision {
    /// Decides: reads the worktree, or the feature's step, and writes what follows.
    pub(super) fn run(self, runner: &Runner, session: &str) {
        match self {
            Decision::Limit {
                turn,
                limit,
                taken,
                parent,
            } => {
                let at = |runner: &Runner| runner.limit_continue_at(&limit);
                runner.decide(&turn, ContinueReason::Limit, at, taken);
                let mut state = runner.state();
                runner.sub_ended(&mut state, parent.as_deref());
            }
            Decision::Chain {
                turn,
                folder,
                step,
                taken,
            } => {
                // A refused run leaves its reason as the turn's last line.
                let Err(fault) = runner.chain_next(session, &folder, &step, taken) else {
                    return;
                };
                let store = runner.store();
                let added = store.append(turn, runner.now(), &line(fault.message()));
                let page = added.and_then(|added| store.page_of(turn, added.seq));
                if let (Ok(Some(page)), Ok(row)) = (page, runner.row(session)) {
                    runner.page_changed(&row.repo, turn, page);
                }
            }
        }
    }
}

impl Runner {
    fn runs(&self) -> Runs {
        let runs = settings::current(&self.shared).runs;
        Runs {
            after_limit: runs.continue_after_limit.in_force,
            after_restart: runs.continue_after_restart.in_force,
            cap: runs.automatic_continues.in_force,
        }
    }

    /// Whether the server lists a main checkout: the continues skip the others, whose runs
    /// show nowhere.
    fn hosted(&self, root: &str) -> bool {
        let listed = repositories::all(&self.shared);
        let mut there = listed.iter().filter(|repository| !repository.missing);
        there.any(|repository| repository.path.to_string_lossy() == root)
    }

    /// What a turn that ended leaves to decide, before its end is said, so it never reads as
    /// asking: a turn failed by a session's limit waits for the reset, and a step's run that
    /// ended done starts the next step's, unless a turn queued after it goes on with the run.
    /// A continue's turn that ends without starting, taken back or refused, gives the run back
    /// its own reason.
    pub(super) fn decision(
        &self,
        state: &mut State,
        session: &str,
        turn: Turn,
        limit: Option<Limit>,
    ) -> Option<Decision> {
        self.unclaim(state, &turn);
        let live = state.lives.get(session)?;
        if !live.queue.is_empty() {
            return None;
        }
        let (parent, folder) = (live.parent.clone(), live.folder.clone());
        let taken = state.continues.taken(session);
        let limit = limit
            .filter(|limit| turn.state == TurnState::Failed && limit.kind == LimitKind::Session);
        if let Some(limit) = limit {
            return Some(Decision::Limit {
                turn: Box::new(turn),
                limit,
                taken,
                parent,
            });
        }
        self.sub_ended(state, parent.as_deref());
        // The step chain: a workflow turn of a feature's session, not a sub-session's, that
        // ended done.
        let chains = turn.state == TurnState::Done && turn.kind == TurnKind::Workflow;
        let step = turn.step.clone().filter(|_| chains && parent.is_none())?;
        Some(Decision::Chain {
            turn: turn.id,
            folder: folder?,
            step,
            taken,
        })
    }

    /// Cancels the session's pending continue, and returns the turns it cancelled: the
    /// human's message, or `stopped`, their Stop, which leaves the turn stopped.
    pub(super) fn cancel_continue(
        &self,
        state: &mut State,
        session: &str,
        stopped: bool,
    ) -> Vec<i64> {
        let cancelled = self.cancel(state, session, stopped);
        self.left(state, session);
        cancelled.into_iter().map(|turn| turn.id).collect()
    }

    /// The session's pending continue left, cancelled, dropped, or refused: when it is a
    /// sub-session's, its parent's held continue goes once none of its sub-sessions works.
    fn left(&self, state: &mut State, session: &str) {
        let parent = self.store().session(session).ok().flatten();
        let parent = parent.and_then(|row| row.parent);
        self.sub_ended(state, parent.as_deref());
    }

    /// Cancels the session's pending continues, and returns their turns as they waited.
    fn cancel(&self, state: &mut State, session: &str, stopped: bool) -> Vec<Turn> {
        self.taken_over(state, session);
        state.continues.held.remove(session);
        if stopped {
            let taken = state.continues.taken(session);
            state.continues.stops.insert(session.to_owned(), taken);
        }
        let store = self.store();
        let pending = store.pending_continues().unwrap_or_default();
        let own = pending
            .into_iter()
            .filter(|turn| turn.session_id == session);
        let cancelled = own.filter(|turn| {
            state.continues.timers.remove(&turn.id);
            store.cancel_continue(turn.id, stopped).unwrap_or(false)
        });
        cancelled.collect()
    }

    /// The human's message or allow takes the place of the session's continue, and sets its
    /// count back: what it cancelled, and what puts the wait and the count back.
    pub(super) fn take_over(&self, session: &str) -> Taken {
        let store = self.store();
        let count = store.session(session).ok().flatten();
        let count = count.map_or(0, |row| row.continues);
        let mut state = self.state();
        let cancelled = self.cancel(&mut state, session, false);
        let taken = state.continues.taken(session);
        if let Err(error) = store.set_continues(session, 0) {
            eprintln!("uraeda: the continues of {session} were not set back: {error}");
        }
        Taken {
            cancelled,
            count,
            taken,
        }
    }

    /// Puts back the wait and the count a refused message took, as they were: unless the run
    /// was taken over since, by Stop, a dismiss, another message, or an allow, or the wait's
    /// kind was switched off. A Stop since leaves the runs whose wait it cancelled stopped.
    pub(super) fn restore(&self, session: &str, taken: &Taken) {
        let store = self.store();
        let mut state = self.state();
        if state.continues.taken(session) != taken.taken {
            let stopped = state
                .continues
                .stops
                .get(session)
                .copied()
                .unwrap_or_default();
            let stops = taken.cancelled.iter().filter(|_| stopped > taken.taken);
            for turn in stops.filter(|turn| store.stop_ended(turn.id).unwrap_or(false)) {
                self.say(&mut state, turn, TurnState::Stopped);
            }
            return;
        }
        if let Err(error) = store.set_continues(session, taken.count) {
            eprintln!("uraeda: the continues of {session} were not given back: {error}");
        }
        let runs = self.runs();
        for turn in &taken.cancelled {
            let (Some(at), Some(reason)) = (turn.continue_at, turn.continue_reason) else {
                continue;
            };
            let restored = runs.on(reason)
                && store
                    .restore_continue(turn.id, at, reason, TAKEN_BACK)
                    .unwrap_or(false);
            if restored {
                self.arm(&mut state, turn.id, at);
            }
        }
    }

    /// How many times the session's run was taken over, by a message, an allow, Stop, or a
    /// dismiss: a read under way compares it after, as the step chain does before it sends.
    pub(super) fn takeovers(&self, session: &str) -> u64 {
        self.state().continues.taken(session)
    }

    /// Drops the decisions of the session's continue under way: the run was taken over.
    pub(super) fn taken_over(&self, state: &mut State, session: &str) {
        let taken = state.continues.taken(session) + 1;
        state.continues.taken_over.insert(session.to_owned(), taken);
    }

    /// Claims the turn's continue, and queues its turn in the same step, so the run never
    /// reads as stopped between them. Nothing happens when a cancel cleared it. A refusal
    /// leaves the run asking: the agent gone, the feature moved or dropped, or the run taken
    /// over another way. So does a failure of the store, which writes the turn and the count
    /// as one, or not at all.
    pub(super) fn fire(&self, turn: i64) {
        let store = self.store();
        // A parent goes on once its sub-sessions answered: their calls would be made again
        // before.
        let parent = store.turn(turn).ok().flatten().map(|row| row.session_id);
        // What reads the settings and the list, before the lock.
        let allowed = parent.as_deref().and_then(|session| {
            let row = store.session(session).ok()??;
            let fits = picks::runs_on(self, &row)
                && self.hosted(&row.repo)
                && !of_dropped(&row)
                && self.current(&row);
            Some(fits)
        });
        let mut state = self.state();
        state.continues.timers.remove(&turn);
        if let Some(parent) = &parent
            && self.hold_for_subs(&mut state, parent, turn)
        {
            return;
        }
        let Ok(Some(claimed)) = store.take_continue(turn) else {
            return;
        };
        let (Some(reason), Ok(Some(row))) =
            (claimed.continue_reason, store.session(&claimed.session_id))
        else {
            return;
        };
        self.live_of(&mut state, &row);
        let latest = self.latest(&row.id, None).map(|latest| latest.id);
        let refused =
            allowed != Some(true) || state.lives.is_moving(&row.id) || latest != Some(claimed.id);
        let queued = match refused {
            true => None,
            false => {
                let opens_with = continued_line(reason);
                let queued =
                    self.deliver_continue(&mut state, &row.id, opens_with, reason, &claimed);
                queued
                    .inspect_err(|fault| {
                        let why = fault.message();
                        eprintln!("uraeda: the continue of turn {} failed: {why}", claimed.id);
                    })
                    .ok()
            }
        };
        match queued {
            Some(queued) => {
                state.continues.claimed.insert(queued, claimed.id);
                if let Some(commit) = state.continues.decided_at.get(&row.id).cloned() {
                    state.continues.commits.insert(row.id.clone(), commit);
                }
            }
            None => {
                let _ = store.cancel_continue(claimed.id, false);
                self.changed(&mut state, &row.id, Some(claimed.id), Some(claimed.state));
                self.left(&mut state, &row.id);
            }
        }
        state.lives.prune(&row.id);
    }

    /// Holds the continue of a turn of `parent` while one of the parent's sub-sessions works
    /// or waits to continue: whether it held it.
    fn hold_for_subs(&self, state: &mut State, parent: &str, turn: i64) -> bool {
        if !self.subs_work(state, parent) {
            return false;
        }
        state.continues.held.insert(parent.to_owned(), turn);
        true
    }

    /// Fires the held continue of the parent of a sub-session that ended, or stopped waiting,
    /// once none of its sub-sessions works or waits to continue.
    pub(super) fn sub_ended(&self, state: &mut State, parent: Option<&str>) {
        let Some(parent) = parent else {
            return;
        };
        if !state.continues.held.contains_key(parent) || self.subs_work(state, parent) {
            return;
        }
        if let Some(turn) = state.continues.held.remove(parent) {
            self.spawn(move |runner| runner.fire(turn));
        }
    }

    /// Arms every pending continue, as the server starts: the ones of a kind now off are
    /// dropped. Then continues the runs the server's stop cut in the last 6 hours, whose agent
    /// kept their session, once the agent works.
    pub(super) fn start_continues(&self) {
        self.runs_changed();
        let store = self.store();
        let now = self.now();
        // The limits' overdue waits go a minute apart, in their order, as they would have.
        let mut overdue = now;
        {
            let mut state = self.state();
            for turn in store.pending_continues().unwrap_or_default() {
                let at = turn.continue_at.unwrap_or(now);
                if turn.continue_reason != Some(ContinueReason::Limit) || at > now {
                    self.arm(&mut state, turn.id, at);
                } else if store.move_continue(turn.id, at, overdue).unwrap_or(false) {
                    self.arm(&mut state, turn.id, overdue);
                    overdue += MINUTE;
                }
            }
            state.continues.started = true;
        }
        self.agent_back();
    }

    /// Continues the runs the server's stop cut, once the agent works: at the start, or when a
    /// check finds it back. Safe twice: a cut decided once has its continue's reason.
    pub(super) fn agent_back(&self) {
        if !self.state().continues.started || !self.runs().after_restart {
            return;
        }
        let store = self.store();
        let since = self
            .now()
            .checked_sub(RESTART_WINDOW)
            .unwrap_or(SystemTime::UNIX_EPOCH);
        let cuts = store.server_cuts(SERVER_STOPPED, since).unwrap_or_default();
        let sessions = cuts.into_iter().filter_map(|turn| {
            let session = store.session(&turn.session_id).ok()??;
            Some((turn, session))
        });
        // Sub-sessions first: their parents wait for them.
        let (subs, parents): (Vec<_>, Vec<_>) =
            sessions.partition(|(_, session)| session.parent.is_some());
        for (turn, session) in subs.into_iter().chain(parents) {
            let kept = picks::runs_on(self, &session)
                && self
                    .runtimes()
                    .get(&session.agent)
                    .is_some_and(|runtime| runtime.has_session(&session.native_id));
            if kept {
                let taken = self.takeovers(&session.id);
                self.decide(&turn, ContinueReason::Restart, Runner::now, taken);
            }
        }
    }

    /// Drops the pending continues of each kind whose setting is now off: their runs ask.
    pub(crate) fn runs_changed(&self) {
        let runs = self.runs();
        let store = self.store();
        for reason in [ContinueReason::Limit, ContinueReason::Restart] {
            if runs.on(reason) {
                continue;
            }
            let mut state = self.state();
            for turn in store.drop_continues(reason).unwrap_or_default() {
                state.continues.timers.remove(&turn.id);
                self.say(&mut state, &turn, turn.state);
                self.left(&mut state, &turn.session_id);
            }
        }
    }

    /// Waits the turn for its continue of `reason` at `at`, or, at the session's cap, marks it
    /// capped: nothing when that kind is off, its repository is no longer listed, the session
    /// is not its folder's latest, nor a chat, the turn is not its latest, or it was refused
    /// an action the human has not allowed. A commit in the feature's worktree since the
    /// session's last continue sets its count back to 0 first. The run taken over since
    /// `taken`, or the switch turned off, while it reads, drops it.
    pub(super) fn decide(
        &self,
        turn: &Turn,
        reason: ContinueReason,
        at: impl FnOnce(&Runner) -> SystemTime,
        taken: u64,
    ) {
        let store = self.store();
        let Ok(Some(session)) = store.session(&turn.session_id) else {
            return;
        };
        // A repository removed from the server's list shows its runs nowhere: none goes on
        // there.
        if !self.hosted(&session.repo) || !self.runs().on(reason) || !self.current(&session) {
            return;
        }
        let blocked = store.blocked(turn.id).unwrap_or_default();
        if blocked.iter().any(|blocked| !blocked.allowed) {
            return;
        }
        let commit = worktree_commit(&session);
        let runs = self.runs();
        let mut state = self.state();
        // The human's message, Stop, or a dismiss while the commit was read takes the run
        // over.
        let now = store.turn(turn.id).ok().flatten();
        let latest = self.latest(&session.id, None).map(|latest| latest.id);
        let stands =
            now.is_some_and(|now| now.dismissed_at.is_none() && now.continue_reason.is_none());
        if state.continues.taken(&session.id) != taken
            || !runs.on(reason)
            || !stands
            || latest != Some(turn.id)
        {
            return;
        }
        match commit {
            None => drop(state.continues.decided_at.remove(&session.id)),
            Some(commit) => {
                let recorded = state.continues.commits.remove(&session.id);
                if recorded.is_some_and(|recorded| recorded != commit) {
                    let _ = store.set_continues(&session.id, 0);
                }
                state
                    .continues
                    .decided_at
                    .insert(session.id.clone(), commit);
            }
        }
        let count = store.session(&session.id).ok().flatten();
        if count.map_or(0, |row| row.continues) >= runs.cap {
            let _ = store.decide_continue(turn.id, None, reason, TAKEN_BACK);
            return;
        }
        let time = at(self);
        if store
            .decide_continue(turn.id, Some(time), reason, TAKEN_BACK)
            .unwrap_or(false)
        {
            self.arm(&mut state, turn.id, time);
        }
    }

    /// When a limit's continue goes: a minute after its reset, an hour from now without one,
    /// never sooner than a minute from now. The runs waiting for one reset go a minute apart:
    /// it steps a minute at a time while another limit's continue waits in that minute.
    fn limit_continue_at(&self, limit: &Limit) -> SystemTime {
        let now = self.now();
        let reset = limit.resets_at.as_deref().and_then(|at| {
            let at: jiff::Timestamp = at.parse().ok()?;
            Some(SystemTime::from(at))
        });
        let at = reset.map_or(now + RETRY_WITHOUT_RESET, |reset| reset + MINUTE);
        let mut time = at.max(now + MINUTE);
        let store = self.store();
        while store
            .limit_continue_within(time, time + MINUTE)
            .unwrap_or(false)
        {
            time += MINUTE;
        }
        time
    }

    /// Whether the session's runs continue: a chat, a sub-session, or its folder's latest
    /// session, not archived.
    fn current(&self, session: &Session) -> bool {
        if session.archived_at.is_some() {
            return false;
        }
        let Some(folder) = session
            .folder
            .as_deref()
            .filter(|_| session.parent.is_none())
        else {
            return true;
        };
        let latest = self.store().latest_session(&session.repo, folder);
        latest
            .ok()
            .flatten()
            .is_some_and(|latest| latest.id == session.id)
    }

    /// Arms the turn's timer for `at`: the wait is the server's clock's, and none for a time
    /// that passed.
    fn arm(&self, state: &mut State, turn: i64, at: SystemTime) {
        state.continues.timers.remove(&turn);
        if state.continues.closed || state.closed {
            return;
        }
        let wait = at.duration_since(self.now()).unwrap_or_default();
        let timer = self.after(wait, move |runner| runner.fire(turn));
        state.continues.timers.insert(turn, timer);
    }

    /// Forgets a continue's turn once it ends: one that never started, taken back, stopped, or
    /// refused, clears the reason of the turn it continued, which would read capped again.
    fn unclaim(&self, state: &mut State, turn: &Turn) {
        let Some(continued) = state.continues.claimed.remove(&turn.id) else {
            return;
        };
        if turn.started_at.is_none() {
            let _ = self.store().cancel_continue(continued, false);
        }
    }

    /// Says a turn's change, its session kept in memory or not.
    fn say(&self, state: &mut State, turn: &Turn, ended: TurnState) {
        if state.lives.get(&turn.session_id).is_some() {
            return self.changed(state, &turn.session_id, Some(turn.id), Some(ended));
        }
        if let Ok(Some(row)) = self.store().session(&turn.session_id) {
            self.publish(&Change::of(&row, Some(turn.id), Some(ended)));
        }
    }
}

/// The commit the feature's worktree has checked out, for its count: none for a chat, nor for
/// a feature without a worktree. Read only: the worktree is never made here.
fn worktree_commit(session: &Session) -> Option<String> {
    let folder = session.folder.as_deref()?;
    let root = Path::new(&session.repo);
    let feature = api::read_feature(root, folder).ok()?;
    api::checkout_commit(&root.join(feature.worktree?)).ok()?
}
