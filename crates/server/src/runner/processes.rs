//! The sessions' processes: at most one per session, opened in the session's directory, read
//! to its exit, and closed with a bounded wait.

use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::SystemTime;

use tokio::sync::watch;
use uraeda_core::api;

use super::event::{Event, TokenCounts, UsageWindow};
use super::live::Proc;
use super::manager::{Runner, State, TERMINATE_AFTER, refusals};
use super::message::{CLEARED, FRESH, REPLACED};
use super::picks;
use super::session::Session;
use super::turn::TurnState;
use super::turns::TurnEnd;
use crate::extensions;
use crate::live::Fault;
use crate::mcp::{self, Mcp};
use crate::process::Signal;
use crate::runtimes::{AgentProcess, Events, Options, Tools};
use crate::secret;

/// A turn failed by its process's exit keeps this many lines of its stderr.
const STDERR_LINES: usize = 20;

/// Each runtime's usage windows, as its open processes report them: the newest report of a
/// window wins, even when usage decreased.
#[derive(Default)]
pub(super) struct Usage {
    /// Each report, in the order they came: its runtime, its process, and its window.
    reports: Vec<(String, u64, UsageWindow)>,
    /// What says so when the next window expires, though no process prints another event.
    expiry: Option<super::live::Timer>,
}

/// How many of a process's background tasks are commands.
pub(super) fn commands(proc: &Proc) -> u32 {
    proc.commands()
}

/// What a process opened for a turn starts with.
pub(super) struct Opened {
    /// The line of a new agent session it started: its turn shows it.
    pub line: Option<String>,
}

/// A new random UUID, as an agent's session is named.
pub(super) fn uuid() -> String {
    let mut bytes = secret::random_bytes(16);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    let hex: String = bytes.iter().map(|byte| format!("{byte:02x}")).collect();
    format!(
        "{}-{}-{}-{}-{}",
        &hex[..8],
        &hex[8..12],
        &hex[12..16],
        &hex[16..20],
        &hex[20..]
    )
}

/// When a usage window resets: none for a time that is not one.
fn resets(window: &UsageWindow) -> Option<SystemTime> {
    let at: jiff::Timestamp = window.resets_at.parse().ok()?;
    Some(SystemTime::from(at))
}

impl Runner {
    /// The runtime's usage windows, each the freshest report of it that has not expired, from
    /// an open process.
    pub(crate) fn usage(&self, runtime: &str) -> Vec<UsageWindow> {
        let now = self.now();
        let state = self.state();
        let mut windows: Vec<UsageWindow> = Vec::new();
        let reports = state.usage.reports.iter();
        for (_, _, window) in reports.filter(|(of, _, _)| of == runtime) {
            if resets(window).is_none_or(|at| at <= now) {
                continue;
            }
            match windows.iter_mut().find(|known| known.id == window.id) {
                Some(known) => *known = window.clone(),
                None => windows.push(window.clone()),
            }
        }
        windows
    }

    /// Drops a process's reports of every window: whether it had any.
    fn drop_usage(state: &mut State, serial: u64) -> bool {
        let before = state.usage.reports.len();
        state.usage.reports.retain(|(_, of, _)| *of != serial);
        state.usage.reports.len() != before
    }

    /// Drops the reports that expired, says the usage changed, and arms the next expiry.
    fn usage_changed(&self, state: &mut State) {
        let now = self.now();
        state
            .usage
            .reports
            .retain(|(_, _, window)| resets(window).is_some_and(|at| at > now));
        let next = state.usage.reports.iter();
        let next = next.filter_map(|(_, _, window)| resets(window)).min();
        state.usage.expiry = match next.and_then(|next| next.duration_since(now).ok()) {
            Some(wait) if !state.closed => Some(self.after(wait, |runner| {
                let mut state = runner.state();
                runner.usage_changed(&mut state);
            })),
            _ => None,
        };
        self.agent_changed();
    }

    /// Keeps a report's windows as the process's newest.
    pub(super) fn report_usage(&self, session: &str, serial: u64, windows: Vec<UsageWindow>) {
        let mut state = self.state();
        let Some(proc) = proc_of(&mut state, session, serial) else {
            return;
        };
        if proc.closing {
            return;
        }
        let kind = proc.kind.clone();
        // An account's reports are its own, kept after the process: see `account.rs`.
        if let Some(account) = proc.account.clone() {
            drop(state);
            let reported = |window| self.account_report(&kind, &account, window);
            return windows.into_iter().for_each(reported);
        }
        for window in windows {
            state.usage.reports.retain(|(of, from, known)| {
                !(*of == kind && *from == serial && known.id == window.id)
            });
            state.usage.reports.push((kind.clone(), serial, window));
        }
        self.usage_changed(&mut state);
    }

    /// The session's open process, opened when it has none, or when it is closing: then once
    /// it exited. A transcript that is gone starts a new agent session, and the line says so.
    /// `allowed` opens it again with the rules. The directory is the session's folder as it is
    /// now. It runs on the session's model and effort: an effort changed since it opened is
    /// given to it, or, for a runtime that cannot change it, opens it again. Called as a turn
    /// starts, inside the session's own turn, never during one.
    pub(super) fn open(
        &self,
        session: &str,
        allowed: Option<Vec<String>>,
    ) -> Result<Opened, Fault> {
        let row = self.row(session)?;
        let account = self.account_for(&row)?;
        let (held, closing) = {
            let mut state = self.state();
            let gone = || Fault::internal(format!("session {session} is not kept"));
            let live = state.lives.get(session).ok_or_else(gone)?;
            match live.proc.as_mut() {
                None => (None, None),
                Some(proc) => {
                    // A turn taken back while the process opened left its line to the next one.
                    let held = proc.line.clone();
                    // A process opened on an older pick, or before a move, opens again.
                    let same = proc.account == account;
                    if !proc.closing && allowed.is_none() && same && effort_set(proc, &row) {
                        proc.line = None;
                        return Ok(Opened { line: held });
                    }
                    (held, self.close_proc(&mut state, session))
                }
            }
        };
        if let Some(mut done) = closing {
            self.wait(async move {
                let _ = done.wait_for(|done| *done).await;
            });
        }
        if self.state().closed {
            return Err(Fault::refused("The server is stopping."));
        }
        let allowed = allowed.unwrap_or_default();
        self.start(session, &row, held, allowed, account)
    }

    /// Starts a session's process, with the rules allowed for it, and the line a process
    /// taken back before left: the line its turn opens with.
    fn start(
        &self,
        session: &str,
        row: &Session,
        held: Option<String>,
        allowed: Vec<String>,
        account: Option<String>,
    ) -> Result<Opened, Fault> {
        let folder = {
            let mut state = self.state();
            let live = state.lives.get(session);
            live.and_then(|live| live.folder.clone())
        };
        // A sub-session works in its task's worktree.
        let cwd = match (&row.worktree, &folder) {
            (Some(worktree), _) => PathBuf::from(worktree),
            (None, None) => PathBuf::from(&row.repo),
            (None, Some(folder)) => PathBuf::from(api::work_dir(Path::new(&row.repo), folder)?),
        };
        // The session's own runtime, never another: one unregistered or turned off since
        // leaves it read-only.
        let runtime = picks::session_runtime(self, row)?;
        let resume = runtime.has_session(&row.native_id, account.as_deref());
        let store = self.store();
        let ran = store
            .turns(session)?
            .iter()
            .any(|turn| turn.started_at.is_some());
        // A session that ran before has lost its transcript: the agent deletes old ones. A
        // line held from a replacement is carried, resuming that new session.
        let replaced = !resume && ran;
        let line = match replaced {
            true => Some(REPLACED.to_owned()),
            false => held,
        };
        let native_id = match replaced {
            true => uuid(),
            false => row.native_id.clone(),
        };
        if replaced {
            store.edit_session(session, |row| row.native_id.clone_from(&native_id))?;
        }
        let tools = self.tools(row);
        let token = match &tools {
            Tools::Uraeda { token, .. } => Some(token.clone()),
            Tools::Own | Tools::None => None,
        };
        let repository = self.name_of(&row.repo);
        let skills =
            repository.map_or_else(Vec::new, |name| extensions::skills(&self.shared, &name));
        let options = Options {
            cwd: cwd.clone(),
            native_id,
            resume,
            model: row.model.clone(),
            effort: row.effort.clone(),
            account: account.clone(),
            allowed,
            skills,
            tools,
        };
        let mut process = runtime.open(options);
        let events = process.events();
        let agent: Arc<dyn AgentProcess> = Arc::from(process);
        let (name, capabilities) = (runtime.name(), runtime.capabilities());
        // A resumed agent session reports its earlier turns' tokens again.
        let baseline = match resume {
            true => store.agent_session_tokens(session, &[FRESH, REPLACED, CLEARED])?,
            false => TokenCounts::default(),
        };
        let serial = {
            let mut state = self.state();
            state.next_proc += 1;
            let serial = state.next_proc;
            let proc = Proc {
                serial,
                agent,
                runtime,
                kind: row.agent.clone(),
                account,
                name,
                capabilities,
                cwd,
                effort: row.effort.clone(),
                adopts: !resume,
                closing: false,
                background: Vec::new(),
                ended: None,
                line: None,
                terminate: Vec::new(),
                token,
                wakeup: None,
                baseline: Some(baseline),
                done: watch::Sender::new(false),
            };
            match state.lives.get(session) {
                Some(live) => live.proc = Some(proc),
                None => {
                    proc.agent.close();
                    return Err(Fault::internal(format!("session {session} is not kept")));
                }
            }
            serial
        };
        self.consume(session.to_owned(), serial, events);
        Ok(Opened { line })
    }

    /// Uraeda's tools for a session's new process: a workflow session's, of a change or a
    /// feature, gets the MCP endpoint with a token of its own, which ends its earlier
    /// process's; a sub-session gets neither its agent's own sub-agents nor Uraeda's; a chat
    /// keeps its agent's own.
    fn tools(&self, row: &Session) -> Tools {
        if row.parent.is_some() {
            return Tools::None;
        }
        if row.folder.is_none() {
            return Tools::Own;
        }
        Tools::Uraeda {
            url: mcp::url(&self.shared),
            token: self.shared.get::<Mcp>().issue(&row.id),
        }
    }

    /// Closes a session's process once its turn is over: it exits, and is opened again by the
    /// next message. One still running 10 seconds later gets `SIGTERM`, and `SIGKILL` 10
    /// seconds after that, so no send, nor the server's stop, waits on it for ever. What tells
    /// its exit, when it has a process.
    pub(super) fn close_proc(
        &self,
        state: &mut State,
        session: &str,
    ) -> Option<watch::Receiver<bool>> {
        let proc = state.lives.get(session)?.proc.as_mut()?;
        let done = proc.done.subscribe();
        if proc.closing {
            return Some(done);
        }
        proc.closing = true;
        proc.agent.close();
        let signalled = |agent: Arc<dyn AgentProcess>, signal| move || agent.kill(signal);
        let term = signalled(proc.agent.clone(), Signal::Terminate);
        let kill = signalled(proc.agent.clone(), Signal::Kill);
        proc.terminate = vec![
            self.after_now(TERMINATE_AFTER, term),
            self.after_now(2 * TERMINATE_AFTER, kill),
        ];
        let serial = proc.serial;
        if Self::drop_usage(state, serial) {
            self.usage_changed(state);
        }
        Some(done)
    }

    /// Reads a process's events into the store, each on a blocking thread, in order, until it
    /// exits.
    fn consume(&self, session: String, serial: u64, mut events: Events) {
        let runner = self.clone();
        self.task(async move {
            while let Some(event) = events.next().await {
                let (runner, session) = (runner.clone(), session.clone());
                let recorded = tokio::task::spawn_blocking(move || {
                    runner.take(&session, serial, event);
                });
                if recorded.await.is_err() {
                    say_err!("uraeda: the session manager could not record an event");
                }
            }
        });
    }

    /// Takes an event of a session's process: its exit ends it, a usage report is the
    /// runtime's, and every other is the transcript's.
    fn take(&self, session: &str, serial: u64, event: Event) {
        let recorded = match event {
            Event::Exit {
                code,
                missing,
                stderr,
            } => {
                self.exited(session, serial, code, missing == Some(true), &stderr);
                Ok(())
            }
            Event::Usage { windows } => {
                self.report_usage(session, serial, windows);
                Ok(())
            }
            event => self.record(session, serial, event),
        };
        // A write that fails does not stop the session.
        if let Err(fault) = recorded {
            let why = fault.message();
            say_err!("uraeda: the session manager could not record an event of {session}: {why}");
        }
    }

    /// The process exited: its turn ends, and the queued turns start on a new one.
    fn exited(&self, session: &str, serial: u64, code: Option<i32>, missing: bool, stderr: &str) {
        let mut state = self.state();
        if Self::drop_usage(&mut state, serial) {
            self.usage_changed(&mut state);
        }
        let Some(live) = state.lives.get(session) else {
            return;
        };
        let Some(proc) = live.proc.take_if(|proc| proc.serial == serial) else {
            return;
        };
        if let Some(token) = &proc.token {
            self.shared.get::<Mcp>().revoke(token);
        }
        live.idle = None;
        let stopped = live.turn.as_ref().map(|turn| (turn.id, turn.stop.clone()));
        if let Some((turn, stop)) = stopped {
            let end = stop.unwrap_or_else(|| {
                let lines: Vec<&str> = stderr.trim_end().lines().collect();
                let kept = lines[lines.len().saturating_sub(STDERR_LINES)..].join("\n");
                let reason = match (missing, kept.is_empty()) {
                    (true, _) => refusals::unavailable(&proc.name),
                    (false, false) => kept,
                    (false, true) => {
                        let code = code.map_or_else(|| "null".to_owned(), |code| code.to_string());
                        format!("{} exited with code {code}.", proc.name)
                    }
                };
                TurnEnd::because(TurnState::Failed, reason)
            });
            self.end(&mut state, session, turn, end);
        }
        proc.done.send_replace(true);
        drop(proc);
        self.changed(&mut state, session, None, None);
        self.next(&mut state, session);
        state.lives.prune(session);
    }

    /// Adds the work of a process's agent session since its last report to the turn running
    /// on it. Without one, the next report counts it.
    pub(super) fn tokens(&self, state: &mut State, session: &str, serial: u64, total: TokenCounts) {
        let Some(live) = state.lives.get(session) else {
            return;
        };
        let Some(turn) = live.turn.as_ref().map(|turn| turn.id) else {
            return;
        };
        let Some(proc) = live.proc.as_mut().filter(|proc| proc.serial == serial) else {
            return;
        };
        let Some(baseline) = proc.baseline else {
            return;
        };
        // An agent session's total never decreases: a lower one is a new agent session's,
        // should its `init` have been missed.
        let started = total.cache_read < baseline.cache_read
            || total.cache_write < baseline.cache_write
            || total.input < baseline.input
            || total.output < baseline.output;
        let own = |total: u64, before: u64| match started {
            true => total,
            false => total - before,
        };
        let counts = TokenCounts {
            cache_read: own(total.cache_read, baseline.cache_read),
            cache_write: own(total.cache_write, baseline.cache_write),
            input: own(total.input, baseline.input),
            output: own(total.output, baseline.output),
        };
        proc.baseline = Some(total);
        if let Err(error) = self.store().add_turn_tokens(turn, counts) {
            say_err!("uraeda: the tokens of turn {turn} were not counted: {error}");
        }
    }
}

/// Whether a session's open process runs on its effort: one changed since is given to it, when
/// its runtime can change it. Else it is to be opened again.
fn effort_set(proc: &mut Proc, row: &Session) -> bool {
    if proc.effort == row.effort {
        return true;
    }
    if !proc.agent.set_effort(row.effort.as_deref()) {
        return false;
    }
    proc.effort.clone_from(&row.effort);
    true
}

/// A session's process, when it is still the one of this serial.
pub(super) fn proc_of<'a>(
    state: &'a mut State,
    session: &str,
    serial: u64,
) -> Option<&'a mut Proc> {
    let proc = state.lives.get(session)?.proc.as_mut()?;
    (proc.serial == serial).then_some(proc)
}
