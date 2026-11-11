//! The sessions' turns: one running per session, the others queued after it. A turn is
//! started, watched for output, halted, and ended, and its messages are forgotten once the
//! agent cannot read them any more.

use std::sync::Arc;
use std::time::Duration;

use tokio::sync::watch;
use tokio::time::Instant;

use super::event::{ChatImage, Event, Limit, Origin};
use super::live::{Queued, Reading, Running, Sent};
use super::manager::{IDLE_CLOSE, Runner, SERVER_STOPPED, State, TERMINATE_AFTER, WATCHDOG};
use super::message::{RESUMED, WORKING};
use super::processes::proc_of;
use super::turn::{NewTurn, Turn, TurnKind, TurnState};
use super::turns::TurnEnd;
use crate::extensions;
use crate::live::Fault;
use crate::process::Signal;
use crate::runtimes::{AgentProcess, Outgoing};

/// An idle process with a pending wakeup closes this long after it, unless the agent went on.
const WAKEUP_GRACE: Duration = Duration::from_secs(60);

/// A turn to start: what its row holds, the lines it opens with, and its message.
pub(super) struct Starting {
    pub kind: TurnKind,
    pub trigger: Option<String>,
    pub step: Option<String>,
    pub allowed: Option<String>,
    /// A catch-up's commit of the default branch.
    pub caught_up_to: Option<String>,
    /// The lines it opens with, before its message: its process's, when it started a new
    /// agent session, and its workflow message's, as a catch-up's.
    pub lines: Vec<String>,
    /// The lines after its message.
    pub after: Vec<String>,
    /// The message as its transcript shows it.
    pub shown: Shown,
    /// The message as the agent gets it.
    pub message: Outgoing,
}

/// A message as a transcript shows it.
#[derive(Clone)]
pub(super) struct Shown {
    pub origin: Origin,
    pub text: String,
    pub opening: Option<String>,
    pub images: Vec<ChatImage>,
}

impl Shown {
    /// The message's event, under its id.
    pub fn event(&self, id: &str) -> Event {
        Event::Message {
            id: id.to_owned(),
            origin: self.origin,
            text: self.text.clone(),
            opening: self.opening.clone(),
            images: self.images.clone(),
        }
    }
}

/// A line of Uraeda's, as a turn's log holds it.
pub(super) fn line(text: &str) -> Event {
    Event::Notice {
        text: text.to_owned(),
    }
}

impl Starting {
    /// The turn's row, and the first events of its log: its lines, its message, and the lines
    /// after it.
    fn rows(&self, session: &str, state: TurnState) -> (NewTurn, Vec<Event>) {
        let new = NewTurn {
            session_id: session.to_owned(),
            kind: self.kind,
            trigger: self.trigger.clone(),
            step: self.step.clone(),
            allowed: self.allowed.clone(),
            caught_up_to: self.caught_up_to.clone(),
            state,
        };
        let before = self.lines.iter().map(|text| line(text));
        let after = self.after.iter().map(|text| line(text));
        let message = self.shown.event(&self.message.id);
        (new, before.chain([message]).chain(after).collect())
    }

    /// The message this server keeps of the turn, at its place in the log.
    fn sent(&self, turn: i64, seq: u64, page: u32, written: bool) -> Sent {
        Sent {
            turn,
            seq,
            page,
            written,
            state: Reading::Pending,
            origin: self.shown.origin,
            text: self.shown.text.clone(),
            opening: self.shown.opening.clone(),
            images: self.shown.images.clone(),
        }
    }
}

/// Whether a running turn's end stops its session's sub-sessions: a failure, but a usage
/// limit's, or a stop, but the server's, whose runs continue after it.
fn ends_sub_sessions(end: &TurnEnd, limit: Option<&Limit>) -> bool {
    match end.state {
        TurnState::Failed => limit.is_none(),
        TurnState::Stopped => end.reason.as_deref() != Some(SERVER_STOPPED),
        _ => false,
    }
}

impl Runner {
    /// Records that a turn will end, for what waits for it.
    pub(super) fn track(state: &mut State, turn: i64) {
        state.pending.insert(turn, watch::Sender::new(false));
    }

    /// Starts a turn on the session's open process, and writes its message. The turn, its
    /// lines, and its message are written as one, or not at all.
    pub(super) fn begin(
        &self,
        state: &mut State,
        session: &str,
        turn: Starting,
    ) -> Result<i64, Fault> {
        let (new, events) = turn.rows(session, TurnState::Running);
        let store = self.store();
        let (id, places) = store.begin_turn(new, &events, self.now())?;
        let seq = places[turn.lines.len()];
        let page = store.page_of(id, seq)?.unwrap_or_default();
        Self::track(state, id);
        if let Some(live) = state.lives.get(session) {
            let sent = turn.sent(id, seq, page, true);
            live.messages.insert(turn.message.id.clone(), sent);
        }
        self.run(state, session, id, turn.message);
        Ok(id)
    }

    /// Adds a queued turn, with its message and its lines, as one write: the turn starts once
    /// the running one ends, or once the other session of its folder is idle.
    pub(super) fn queue(
        &self,
        state: &mut State,
        session: &str,
        turn: Starting,
        workflow: Option<super::live::Workflow>,
    ) -> Result<i64, Fault> {
        let (new, events) = turn.rows(session, TurnState::Queued);
        let store = self.store();
        let (id, places) = store.begin_turn(new, &events, self.now())?;
        let seq = places[turn.lines.len()];
        let page = store.page_of(id, seq)?.unwrap_or_default();
        Self::track(state, id);
        if let Some(live) = state.lives.get(session) {
            let sent = turn.sent(id, seq, page, false);
            live.messages.insert(turn.message.id.clone(), sent);
            // Checked again as it starts: the running turn may move its step on.
            live.queue.push_back(Queued {
                id,
                message: turn.message,
                workflow,
            });
        }
        self.changed(state, session, Some(id), Some(TurnState::Queued));
        Ok(id)
    }

    /// Makes a turn the running one, and writes its message.
    fn run(&self, state: &mut State, session: &str, id: i64, message: Outgoing) {
        self.open_turn(state, session, id, message.id.clone());
        let live = state.lives.get(session);
        if let Some(proc) = live.and_then(|live| live.proc.as_ref()) {
            proc.agent.send(message);
        }
    }

    /// Makes a turn the running one, started by the message `first`.
    fn open_turn(&self, state: &mut State, session: &str, id: i64, first: String) {
        let now = self.now();
        let pages = self.store().pages(id).unwrap_or_default();
        let hold = self.held_runtime(session);
        let Some(live) = state.lives.get(session) else {
            return;
        };
        live.idle = None;
        live.turn = Some(Running {
            id,
            first,
            label: WORKING.to_owned(),
            since: now,
            limit: None,
            replied: false,
            stop: None,
            terminate: Vec::new(),
            watchdog: None,
            tools: Vec::new(),
            text: None,
            skipped: None,
            pages: pages.saturating_sub(1),
            heard: Instant::now(),
            _hold: hold,
        });
        self.watch(state, session, WATCHDOG);
        self.changed(state, session, Some(id), Some(TurnState::Running));
    }

    /// Holds the session's runtime's extension from loading again while a turn runs on it.
    fn held_runtime(&self, session: &str) -> Option<extensions::Hold> {
        let row = self.store().session(session).ok()??;
        // A built-in's runtime is the server's own code: nothing loads it again.
        let owned = self.shared.find::<extensions::Extensions>().is_some()
            && !matches!(row.agent.as_str(), "claude" | "codex" | "fake");
        let title = row
            .title
            .or(row.folder)
            .unwrap_or_else(|| "a session".to_owned());
        owned.then(|| extensions::hold(&self.shared, &row.agent, &title))
    }

    /// Opens again the turn that last ended on the process, whose agent goes on by itself: a
    /// background task reported back. Without it, its output would show nowhere, and the idle
    /// timer would close the process mid-work. False when a turn runs or starts, or the
    /// process is closing.
    pub(super) fn resume(&self, state: &mut State, session: &str, serial: u64) -> bool {
        let Some(live) = state.lives.get(session) else {
            return false;
        };
        if live.turn.is_some() || !live.queue.is_empty() {
            return false;
        }
        let Some(proc) = live.proc.as_ref().filter(|proc| proc.serial == serial) else {
            return false;
        };
        let Some((id, first)) = proc.ended.clone().filter(|_| !proc.closing) else {
            return false;
        };
        // The agent goes on by itself: the run no longer waits to continue.
        self.cancel_continue(state, session, false);
        let store = self.store();
        let reopened = store.reopen_turn(id, self.now());
        let reopened = reopened.and_then(|()| store.append(id, self.now(), &line(RESUMED)));
        if let Err(error) = reopened {
            eprintln!("uraeda: turn {id} could not open again: {error}");
            return false;
        }
        Self::track(state, id);
        self.open_turn(state, session, id, first);
        true
    }

    /// Stops a run that waits for its agent's own wakeup, no turn running: its process closes,
    /// which drops the wakeup, and its last turn, done, reads stopped by the human.
    pub(super) fn stop_wakeup(&self, state: &mut State, session: &str) {
        let now = self.now();
        let ended = {
            let Some(live) = state.lives.get(session) else {
                return;
            };
            let waits = live.proc.as_ref().filter(|proc| proc.wakeup_pending(now));
            match (live.turn.is_none(), waits) {
                (true, Some(proc)) => proc.ended.as_ref().map(|(turn, _)| *turn),
                _ => return,
            }
        };
        self.close_proc(state, session);
        if let Some(ended) = ended
            && self.store().stop_ended(ended).unwrap_or(false)
        {
            self.changed(state, session, Some(ended), Some(TurnState::Stopped));
        }
    }

    /// Arms the running turn's watchdog, which stops a turn that shows nothing for 30 minutes.
    /// It waits while a background task runs, and while the session's sub-sessions work or
    /// one of its tool calls waits for them: their own watchdogs stop them.
    pub(super) fn watch(&self, state: &mut State, session: &str, wait: Duration) {
        let (closed, owner) = (state.closed, session.to_owned());
        let Some(turn) = state.lives.get(session).and_then(|live| live.turn.as_mut()) else {
            return;
        };
        let id = turn.id;
        turn.watchdog = (!closed).then(|| {
            self.after(wait, move |runner| {
                let mut state = runner.state();
                runner.silent(&mut state, &owner, id);
            })
        });
    }

    /// The watchdog's time came: the turn is stopped when it showed nothing since, and nothing
    /// of it works elsewhere.
    fn silent(&self, state: &mut State, session: &str, id: i64) {
        let busy = self.subs_busy(state, session);
        let Some(live) = state.lives.get(session) else {
            return;
        };
        let background = live
            .proc
            .as_ref()
            .is_some_and(|proc| !proc.background.is_empty());
        let Some(turn) = live.turn.as_ref().filter(|turn| turn.id == id) else {
            return;
        };
        let left = WATCHDOG.saturating_sub(turn.heard.elapsed());
        if !left.is_zero() {
            return self.watch(state, session, left);
        }
        if background || busy {
            return self.watch(state, session, WATCHDOG);
        }
        let silent = TurnEnd::because(TurnState::Failed, "No output for 30 minutes.");
        self.halt(state, session, silent);
    }

    /// Interrupts the running turn, which then ends as `end` says: `SIGINT` when it has not
    /// ended 10 seconds later, and `SIGTERM` 10 seconds after that. Its messages not read yet
    /// are taken back, and marked so by the agent's `cancelled`.
    pub(super) fn halt(&self, state: &mut State, session: &str, end: TurnEnd) {
        let Some(live) = state.lives.get(session) else {
            return;
        };
        let Some((id, first)) = live.turn.as_ref().map(|turn| (turn.id, turn.first.clone())) else {
            return;
        };
        let unread = live.unread(id, &first);
        let Some(turn) = live.turn.as_mut().filter(|turn| turn.stop.is_none()) else {
            return;
        };
        turn.stop = Some(end);
        turn.watchdog = None;
        let Some(proc) = live.proc.as_ref() else {
            return;
        };
        if proc.capabilities.take_back {
            unread.iter().for_each(|id| proc.agent.take_back(id));
        }
        proc.agent.interrupt();
        let signalled = |agent: Arc<dyn AgentProcess>, signal| move || agent.kill(signal);
        turn.terminate = vec![
            self.after_now(
                TERMINATE_AFTER,
                signalled(proc.agent.clone(), Signal::Interrupt),
            ),
            self.after_now(
                2 * TERMINATE_AFTER,
                signalled(proc.agent.clone(), Signal::Terminate),
            ),
        ];
    }

    /// Records the end of a turn, running or queued, and tells the continuer, then the step
    /// chain. A running turn that failed or stopped, but by a usage limit or the server's
    /// stop, stops the session's sub-sessions: nothing waits for their answers any more. The
    /// end is said once the continuer decided, or the chain sent the next step's run, so a run
    /// that waits to continue, or goes on with its next step, never reads as asking.
    pub(super) fn end(&self, state: &mut State, session: &str, id: i64, end: TurnEnd) {
        let (was_running, limit) = {
            let Some(live) = state.lives.get(session) else {
                return;
            };
            match live.turn.take_if(|turn| turn.id == id) {
                Some(turn) => {
                    if let Some(proc) = live.proc.as_mut() {
                        proc.ended = Some((id, turn.first.clone()));
                    }
                    // A limit counts only when it failed the turn on its own, not halted.
                    let counts = end.state == TurnState::Failed && turn.stop.is_none();
                    (true, turn.limit.clone().filter(|_| counts))
                }
                None => (false, None),
            }
        };
        let store = self.store();
        let ended = store.end_turn(id, &end, self.now());
        let row = ended.and_then(|()| store.turn(id)).unwrap_or_else(|error| {
            eprintln!("uraeda: the end of turn {id} could not be recorded: {error}");
            None
        });
        if was_running && ends_sub_sessions(&end, limit.as_ref()) {
            self.stop_subs(state, session);
        }
        Self::forget(state, session, id);
        let deciding = row.and_then(|row| self.decision(state, session, row, limit));
        let Some(decision) = deciding else {
            return self.ended(state, session, id, end.state);
        };
        // Every change of the session waits for the decision: the process's exit says one too.
        if let Some(live) = state.lives.get(session) {
            live.held.get_or_insert_default().deciding += 1;
        }
        let (owner, ended) = (session.to_owned(), end.state);
        self.spawn(move |runner| {
            decision.run(runner, &owner);
            let mut state = runner.state();
            runner.released(&mut state, &owner, id, ended);
        });
    }

    /// Says a turn's end once its continue was decided, then the session's changes held
    /// meanwhile.
    fn released(&self, state: &mut State, session: &str, id: i64, ended: TurnState) {
        let held = state.lives.get(session).and_then(|live| {
            let deciding = &mut live.held.as_mut()?.deciding;
            *deciding = deciding.saturating_sub(1);
            (*deciding == 0).then(|| live.held.take()).flatten()
        });
        self.ended(state, session, id, ended);
        if let Some(held) = held {
            for (turn, ended) in held.changes {
                self.changed(state, session, turn, ended);
            }
            state.lives.prune(session);
        }
    }

    /// Says a turn's end, and lets what waits for it go on.
    fn ended(&self, state: &mut State, session: &str, id: i64, ended: TurnState) {
        if let Some(pending) = state.pending.remove(&id) {
            pending.send_replace(true);
        }
        self.changed(state, session, Some(id), Some(ended));
    }

    /// Forgets the messages of a turn once it ended, but those the agent may still read.
    pub(super) fn forget(state: &mut State, session: &str, turn: i64) {
        let Some(live) = state.lives.get(session) else {
            return;
        };
        let running = live.turn.as_ref().is_some_and(|running| running.id == turn);
        if running || live.queue.iter().any(|queued| queued.id == turn) {
            return;
        }
        live.messages
            .retain(|_, sent| sent.turn != turn || sent.state == Reading::Pending);
    }

    /// Marks a message read or taken back, in its turn's log.
    pub(super) fn mark(&self, state: &mut State, session: &str, message: &str, read: Reading) {
        let Some(live) = state.lives.get(session) else {
            return;
        };
        let repo = live.repo.clone();
        let Some(sent) = live.messages.get_mut(message) else {
            return;
        };
        sent.state = read;
        let (turn, page) = (sent.turn, sent.page);
        let id = message.to_owned();
        let event = match read {
            Reading::TakenBack => Event::Cancelled { id },
            Reading::Read | Reading::Pending => Event::Accepted { id },
        };
        if let Err(error) = self.store().append(turn, self.now(), &event) {
            eprintln!("uraeda: a message of turn {turn} could not be marked: {error}");
        }
        self.page_changed(&repo, turn, page);
        Self::forget(state, session, turn);
    }

    /// After a turn: the next queued turn starts, or the idle timer does.
    pub(super) fn next(&self, state: &mut State, session: &str) {
        let now = self.now();
        let closed = state.closed;
        let Some(live) = state.lives.get(session) else {
            return;
        };
        if live.turn.is_some() {
            return;
        }
        if !live.queue.is_empty() {
            let owner = session.to_owned();
            return self.spawn(move |runner| runner.start_queued(&owner));
        }
        live.idle = None;
        // A background task still runs: the idle timer starts once it ends. A pending wakeup
        // holds the process open until a minute after it, for the agent to go on by itself.
        let idle = live
            .proc
            .as_ref()
            .filter(|proc| !proc.closing && proc.background.is_empty());
        if let Some(proc) = idle.filter(|_| !closed) {
            let wakeup = proc.wakeup.map(|wakeup| wakeup + WAKEUP_GRACE);
            let wakeup = wakeup.and_then(|until| until.duration_since(now).ok());
            let (owner, serial) = (session.to_owned(), proc.serial);
            let wait = IDLE_CLOSE.max(wakeup.unwrap_or_default());
            live.idle = Some(self.after(wait, move |runner| {
                let mut state = runner.state();
                if proc_of(&mut state, &owner, serial).is_some() {
                    runner.close_proc(&mut state, &owner);
                }
            }));
        }
        self.wake(state, session);
    }

    /// Starts the turns of the change's or feature's other sessions that waited for this one,
    /// now idle: the first to start makes the others wait again.
    pub(super) fn wake(&self, state: &mut State, session: &str) {
        for other in state.lives.waiting(session) {
            self.next(state, &other);
        }
    }

    /// Starts the session's first queued turn, in the session's own turn, opening the process
    /// again when it is gone. It waits while another session of its change or feature works:
    /// that one wakes it once idle.
    fn start_queued(&self, session: &str) {
        let Ok(row) = self.row(session) else {
            return;
        };
        self.serial(&row, || self.start_first(session));
    }

    fn start_first(&self, session: &str) {
        let first = {
            let mut state = self.state();
            let waits = state.closed || state.lives.other_working(session, false);
            let Some(live) = state.lives.get(session) else {
                return;
            };
            let first = live.queue.front().map(|queued| queued.id);
            match first.filter(|_| !waits && live.turn.is_none()) {
                Some(first) => {
                    live.starting = true;
                    first
                }
                None => return,
            }
        };
        let prepared = self.recheck_queued(session, first);
        let prepared = prepared.and_then(|()| self.open(session, None));
        let mut state = self.state();
        let Some(live) = state.lives.get(session) else {
            return;
        };
        live.starting = false;
        let opened = match prepared {
            Ok(opened) => opened,
            Err(fault) => {
                // The turns cannot run: each fails with why.
                let turns: Vec<i64> = live.queue.drain(..).map(|queued| queued.id).collect();
                for turn in turns {
                    let failed = TurnEnd::because(TurnState::Failed, fault.message());
                    self.end(&mut state, session, turn, failed);
                }
                return self.wake(&mut state, session);
            }
        };
        // Stop, or a take-back, may have ended it while the process opened: the next one
        // starts, or the idle timer does.
        if live.queue.front().map(|queued| queued.id) != Some(first) {
            if let (Some(line), Some(proc)) = (opened.line, live.proc.as_mut()) {
                proc.line = Some(line);
            }
            return self.next(&mut state, session);
        }
        let Some(queued) = live.queue.pop_front() else {
            return;
        };
        let repo = live.repo.clone();
        let store = self.store();
        let mut started = store.start_turn(queued.id, self.now());
        if let Some(text) = opened.line {
            started = started.and_then(|()| {
                let added = store.append(queued.id, self.now(), &line(&text))?;
                if let Some(page) = store.page_of(queued.id, added.seq)? {
                    self.page_changed(&repo, queued.id, page);
                }
                Ok(())
            });
        }
        if let Err(error) = started {
            eprintln!("uraeda: turn {} could not start: {error}", queued.id);
        }
        self.run(&mut state, session, queued.id, queued.message);
    }

    /// The session's latest turn, or its latest before the turn `before`, without those taken
    /// back, which never ran.
    pub(super) fn latest(&self, session: &str, before: Option<i64>) -> Option<Turn> {
        let turns = self.store().turns(session).ok()?;
        latest_of(&turns, before).cloned()
    }
}

/// The latest of a session's turns, or the latest before the turn `before`, without those
/// taken back, which never ran.
pub(crate) fn latest_of(turns: &[Turn], before: Option<i64>) -> Option<&Turn> {
    let ran = |turn: &&Turn| {
        let taken_back = turn.state == TurnState::Stopped
            && turn.reason.as_deref() == Some(super::manager::TAKEN_BACK);
        before.is_none_or(|before| turn.id < before) && !taken_back
    };
    turns.iter().rev().find(ran)
}
