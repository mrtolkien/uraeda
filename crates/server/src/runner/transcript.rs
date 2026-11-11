//! The sessions' events, recorded in their turns' logs: texts as they stream, tool calls,
//! retries, skipped lines, blocked actions, and the messages the agent read or took back. A
//! result ends its turn once no background task runs, and an `init` with a problem fails it.
//! Output after the turn ended, when the agent goes on by itself, opens it again.
//!
//! A log is only added to, so what is said of it is small: a new line says its page changed,
//! a piece of a text is an `append` to that text, and nothing reads a turn again.

mod tools;

mod ends;

use std::path::PathBuf;
use std::sync::Arc;
use std::time::{Duration, SystemTime};

use tokio::time::Instant;
use uraeda_protocol::TurnLog;

use super::event::{BackgroundKind, BackgroundTask, Denial, Event, TokenCounts};
use super::live::{Reading, Tool};
use super::manager::{Runner, State};
use super::message::{CLEARED, WORKING, activity_label, waiting_label};
use super::processes::proc_of;
use super::turn::TurnState;
use super::turns::TurnEnd;
use crate::live::{Bus, Fault};
use crate::runtimes::Runtime;
use crate::runtimes::built_in::tool_target;

/// A wakeup further ahead than this holds no process open: it would for days.
const WAKEUP_HORIZON: Duration = Duration::from_secs(24 * 60 * 60);

/// What a result's blocked action is about, and the rule that allows it alone.
type Ruled = (Option<String>, Option<String>);

/// When an agent's time is, in ISO 8601: none for a text that is no time.
fn time(text: &str) -> Option<SystemTime> {
    let at: jiff::Timestamp = text.parse().ok()?;
    Some(SystemTime::from(at))
}

impl Runner {
    /// Records an event of a session's process, other than its exit and its usage.
    pub(super) fn record(&self, session: &str, serial: u64, event: Event) -> Result<(), Fault> {
        // A rule is asked of the runtime, which may wait: before the lock is taken.
        let ruled = match &event {
            Event::Result { denials, .. } if !denials.is_empty() => {
                self.ruled(session, serial, denials)
            }
            _ => Vec::new(),
        };
        let mut state = self.state();
        if proc_of(&mut state, session, serial).is_none() {
            return Ok(());
        }
        let shows = matches!(
            event,
            Event::Activity { .. }
                | Event::Thought { .. }
                | Event::TextDelta { .. }
                | Event::Text { .. }
                | Event::ToolStart { .. }
                | Event::ToolEnd { .. }
                | Event::Retry { .. }
        );
        let runs = |state: &mut State| {
            let live = state.lives.get(session);
            live.is_some_and(|live| live.turn.is_some())
        };
        // Output with no turn running is the agent going on by itself: its last turn opens
        // again.
        let running = runs(&mut state) || (shows && self.resume(&mut state, session, serial));
        if let Some(turn) = state.lives.get(session).and_then(|live| live.turn.as_mut())
            && turn.stop.is_none()
        {
            turn.heard = Instant::now();
        }
        match event {
            Event::Init {
                session_id,
                problem,
            } => self.init(&mut state, session, serial, &session_id, problem),
            Event::RunsOn { model, effort } => {
                self.store().edit_session(session, |row| {
                    row.ran_model = Some(model);
                    row.ran_effort = effort;
                })?;
                self.changed(&mut state, session, None, None);
                Ok(())
            }
            Event::Background { tasks } => self.background(&mut state, session, serial, &tasks),
            Event::Tokens { total } => {
                self.tokens(&mut state, session, serial, total);
                Ok(())
            }
            Event::Wakeup { at } => {
                // A wakeup in the past is dropped, no output follows it, and one over a day
                // ahead too.
                let now = self.now();
                let at = time(&at).filter(|at| *at > now && *at <= now + WAKEUP_HORIZON);
                if let (Some(at), Some(proc)) = (at, proc_of(&mut state, session, serial)) {
                    proc.wakeup = Some(proc.wakeup.map_or(at, |known| known.max(at)));
                }
                Ok(())
            }
            Event::Limit { limit } => {
                // The later report of one refusal says more; it counts once the turn fails.
                if let Some(turn) = state.lives.get(session).and_then(|live| live.turn.as_mut()) {
                    turn.limit = Some(limit);
                }
                Ok(())
            }
            Event::Accepted { id } => {
                self.settle(&mut state, session, &id, Reading::Read);
                Ok(())
            }
            Event::Cancelled { id } => {
                self.settle(&mut state, session, &id, Reading::TakenBack);
                Ok(())
            }
            // What only the runner writes means nothing from an agent.
            Event::Message { .. } | Event::Denial { .. } | Event::Allowed { .. } => Ok(()),
            output if running => self.output(&mut state, session, serial, output, ruled),
            _ => Ok(()),
        }
    }

    /// What each blocked action of a result is about, and the rule that allows it alone, as
    /// the process's runtime gives it.
    fn ruled(&self, session: &str, serial: u64, denials: &[Denial]) -> Vec<Ruled> {
        let of: Option<(Arc<dyn Runtime>, PathBuf)> = {
            let mut state = self.state();
            let proc = proc_of(&mut state, session, serial);
            proc.map(|proc| (proc.runtime.clone(), proc.cwd.clone()))
        };
        let Some((runtime, cwd)) = of else {
            return Vec::new();
        };
        let ruled = denials.iter().map(|denial| {
            // A rule is one line: the turn that allows keeps its rules a line each.
            let rule = runtime.allow_rule(denial);
            (
                tool_target(&denial.tool, &denial.input, &cwd.to_string_lossy()),
                rule,
            )
        });
        ruled.collect()
    }

    /// Marks a message the agent read, or took back, while it is still pending.
    fn settle(&self, state: &mut State, session: &str, message: &str, read: Reading) {
        let live = state.lives.get(session);
        let sent = live.and_then(|live| live.messages.get(message));
        if sent.is_some_and(|sent| sent.state == Reading::Pending) {
            self.mark(state, session, message, read);
        }
    }

    /// Records the process's start: the agent session a new process's first init reports,
    /// adopted, a new agent session the agent started in its process, and a process that must
    /// not run, as one without the skill.
    fn init(
        &self,
        state: &mut State,
        session: &str,
        serial: u64,
        native: &str,
        problem: Option<String>,
    ) -> Result<(), Fault> {
        let turn = {
            let live = state.lives.get(session);
            live.and_then(|live| live.turn.as_ref().map(|turn| turn.id))
        };
        let Some(proc) = proc_of(state, session, serial) else {
            return Ok(());
        };
        let adopts = proc.adopts;
        // Adopted from the first init that names an id: an empty one leaves it to the next.
        if !native.is_empty() {
            proc.adopts = false;
        }
        let store = self.store();
        if !native.is_empty() && native != self.row(session)?.native_id {
            store.edit_session(session, |row| native.clone_into(&mut row.native_id))?;
            // An agent that picks its own ids reports a new session's at its first start; a
            // later new id is a new agent session in the same process.
            if !adopts {
                if let Some(proc) = proc_of(state, session, serial) {
                    proc.baseline = proc.baseline.map(|_| TokenCounts::default());
                }
                // Its line marks where the agent session's tokens start.
                if let Some(turn) = turn {
                    self.add_line(state, session, turn, &super::running::line(CLEARED))?;
                }
            }
            self.changed(state, session, turn, None);
        }
        // A process its runtime says must not run fails its turn.
        if let Some(problem) = problem {
            self.halt(state, session, TurnEnd::because(TurnState::Failed, problem));
            self.close_proc(state, session);
        }
        Ok(())
    }

    /// Appends an event that starts a line of the running turn's transcript, and says its
    /// page changed: the page, and the event's place in the log.
    pub(super) fn add_line(
        &self,
        state: &mut State,
        session: &str,
        turn: i64,
        event: &Event,
    ) -> Result<(u32, u64), Fault> {
        let store = self.store();
        let added = store.append(turn, self.now(), event)?;
        let page = store.page_of(turn, added.seq)?.unwrap_or_default();
        let Some(live) = state.lives.get(session) else {
            return Ok((page, added.seq));
        };
        let repo = live.repo.clone();
        self.page_changed(&repo, turn, page);
        // A new page is the turn's to say.
        let running = live.turn.as_mut().filter(|running| running.id == turn);
        if let Some(running) = running.filter(|running| running.pages != page) {
            running.pages = page;
            self.turn_changed(&repo, turn);
        }
        Ok((page, added.seq))
    }

    /// Records the agent's output in its turn: texts, tool calls, retries, skipped lines,
    /// results.
    fn output(
        &self,
        state: &mut State,
        session: &str,
        serial: u64,
        event: Event,
        ruled: Vec<Ruled>,
    ) -> Result<(), Fault> {
        let Some(turn) = self.turn_of(state, session) else {
            return Ok(());
        };
        self.follow(state, session, &event);
        match event {
            Event::Activity { .. } => {
                self.store().append(turn, self.now(), &event)?;
            }
            Event::TextDelta { ref text } => self.piece(state, session, turn, &event, text)?,
            Event::Text { .. } => self.whole(state, session, turn, &event)?,
            Event::ToolStart { .. } => self.tool_start(state, session, turn, &event)?,
            Event::ToolEnd {
                id,
                is_error,
                output,
            } => {
                let background = proc_of(state, session, serial);
                let background = background
                    .is_some_and(|proc| proc.background.iter().any(|(tool, _)| *tool == id));
                let tool = self.running(state, session).and_then(|turn| turn.tool(&id));
                match tool {
                    // A background task's call ends once it reports back, not when it starts.
                    Some(tool) if background && !is_error => tool.ended = Some((is_error, output)),
                    _ => self.end_tool(state, session, &id, is_error, output)?,
                }
            }
            Event::Thought { .. } | Event::Retry { .. } | Event::Notice { .. } => {
                self.add_line(state, session, turn, &event)?;
            }
            Event::Skipped => self.skipped(state, session, turn)?,
            Event::Result {
                denials,
                errors,
                interrupted,
                ok,
                ..
            } => {
                let end = match (interrupted, ok) {
                    (true, _) => TurnEnd::of(TurnState::Stopped),
                    (false, true) => TurnEnd::of(TurnState::Done),
                    (false, false) => TurnEnd {
                        state: TurnState::Failed,
                        reason: Some(errors.join("\n")).filter(|errors| !errors.is_empty()),
                    },
                };
                self.result(state, session, serial, &denials, ruled, ok, end)?;
            }
            _ => {}
        }
        Ok(())
    }

    /// A piece of a text: the first is a new line of its page, and each next one grows that
    /// line's text, as an `append` to it, with no read.
    fn piece(
        &self,
        state: &mut State,
        session: &str,
        turn: i64,
        event: &Event,
        text: &str,
    ) -> Result<(), Fault> {
        let store = self.store();
        let Some(repo) = self.repo_of(state, session) else {
            return Ok(());
        };
        let added = store.append(turn, self.now(), event)?;
        let first = super::log::Growth {
            start: added.seq,
            at: 0,
        };
        let grown = added.text.unwrap_or(first);
        if grown.start == added.seq {
            // The first piece is a new line: the next ones grow it.
            let page = store.page_of(turn, added.seq)?.unwrap_or_default();
            let new = self.running(state, session).is_some_and(|running| {
                running.text = Some((grown.start, page));
                std::mem::replace(&mut running.pages, page) != page
            });
            if new {
                self.turn_changed(&repo, turn);
            }
            self.page_changed(&repo, turn, page);
            return Ok(());
        }
        let writing = self.running(state, session).and_then(|turn| turn.text);
        let page = match writing.filter(|(start, _)| *start == grown.start) {
            Some((_, page)) => page,
            None => store.page_of(turn, grown.start)?.unwrap_or_default(),
        };
        if let Some(args) = self.page_args(&repo, turn, page) {
            let line = grown.start.to_string();
            let at = usize::try_from(grown.at).unwrap_or(usize::MAX);
            let bus = self.shared.get::<Bus>();
            bus.append::<TurnLog>(&args, &["items", &line, "text"], at, text);
        }
        Ok(())
    }

    /// A whole text: it ends the pieces before it, the same line, no longer written, or is a
    /// line of its own.
    fn whole(
        &self,
        state: &mut State,
        session: &str,
        turn: i64,
        event: &Event,
    ) -> Result<(), Fault> {
        let writing = self
            .running(state, session)
            .and_then(|turn| turn.text.take());
        let Some((_, page)) = writing else {
            return self.add_line(state, session, turn, event).map(|_| ());
        };
        self.store().append(turn, self.now(), event)?;
        if let Some(repo) = self.repo_of(state, session) {
            self.page_changed(&repo, turn, page);
        }
        Ok(())
    }

    /// Output the agent printed that Uraeda does not read: the first of a turn is a line of
    /// its transcript, which the next ones count on.
    fn skipped(&self, state: &mut State, session: &str, turn: i64) -> Result<(), Fault> {
        let store = self.store();
        let added = store.append(turn, self.now(), &Event::Skipped)?;
        let first = store.page_of(turn, added.seq)?;
        let Some(repo) = self.repo_of(state, session) else {
            return Ok(());
        };
        let Some(running) = self.running(state, session) else {
            return Ok(());
        };
        // The page of the line: the first one's, kept while the turn runs.
        let page = *running
            .skipped
            .get_or_insert(first.unwrap_or(running.pages));
        self.page_changed(&repo, turn, page);
        Ok(())
    }

    /// The session's running turn.
    fn running<'a>(
        &self,
        state: &'a mut State,
        session: &str,
    ) -> Option<&'a mut super::live::Running> {
        state.lives.get(session)?.turn.as_mut()
    }

    /// The main agent's output says what it does now, as its sub-agents' does not: theirs
    /// counts as their own calls.
    fn follow(&self, state: &mut State, session: &str, event: &Event) {
        let Some(running) = self.running(state, session) else {
            return;
        };
        let parent = match event {
            Event::ToolStart { parent, .. } | Event::Thought { parent, .. } => parent.clone(),
            Event::ToolEnd { id, .. } => running.tool(id).and_then(|tool| tool.parent.clone()),
            Event::Activity { .. } | Event::TextDelta { .. } | Event::Text { .. } => None,
            _ => return,
        };
        if let Some(parent) = parent {
            // A sub-agent's call: its count, and its latest.
            if let Event::ToolStart { kind, target, .. } = event
                && let Some(tool) = running.tool(&parent)
            {
                tool.calls += 1;
                tool.latest = Some((*kind, target.clone()));
                let (repo, turn) = (self.repo_of(state, session), self.turn_of(state, session));
                if let (Some(repo), Some(turn)) = (repo, turn) {
                    self.turn_changed(&repo, turn);
                }
            }
            return;
        }
        running.replied = false;
        let label = match event {
            Event::Activity { activity } => activity_label(activity),
            _ => WORKING.to_owned(),
        };
        // A piece of text restarts the time, and leaves its own change to say it; each tool
        // call restarts it too, so the line reads the current call's.
        let quiet = matches!(event, Event::TextDelta { .. });
        let restart = matches!(event, Event::ToolStart { .. });
        self.set_activity(state, session, label, quiet, restart);
    }

    fn repo_of(&self, state: &mut State, session: &str) -> Option<String> {
        Some(state.lives.get(session)?.repo.clone())
    }

    fn turn_of(&self, state: &mut State, session: &str) -> Option<i64> {
        Some(state.lives.get(session)?.turn.as_ref()?.id)
    }

    /// Sets what the running turn does now, said when it changed or `restart`s. Since when
    /// restarts with it, and with each piece of text, which `quiet` leaves unsaid.
    fn set_activity(
        &self,
        state: &mut State,
        session: &str,
        label: String,
        quiet: bool,
        restart: bool,
    ) {
        let now = self.now();
        let Some(live) = state.lives.get(session) else {
            return;
        };
        let repo = live.repo.clone();
        let Some(running) = live.turn.as_mut() else {
            return;
        };
        if label == running.label && !quiet && !restart {
            return;
        }
        (running.label, running.since) = (label, now);
        if !quiet {
            self.turn_changed(&repo, running.id);
        }
    }
}
