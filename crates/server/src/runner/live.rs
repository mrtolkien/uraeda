//! What the server keeps in memory of a session while it is used: its process, the turn that
//! runs on it, the turns that wait, and the messages the agent may still read. A session with
//! nothing left in memory is forgotten: everything else is in the store.

use std::collections::{HashMap, HashSet, VecDeque};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::SystemTime;

use tokio::sync::watch;
use tokio::task::AbortHandle;

use super::event::{BackgroundKind, ChatImage, Limit, Origin, TokenCounts, ToolKind};
use super::session::Session;
use super::turns::TurnEnd;
use crate::extensions::Hold;
use crate::runtimes::{AgentProcess, Capabilities, Outgoing, Runtime};

/// A timer: a task that waits, then acts. Dropping it stops the wait.
pub(super) struct Timer(pub(super) AbortHandle);

impl Drop for Timer {
    fn drop(&mut self) {
        self.0.abort();
    }
}

/// A session's open process.
pub(super) struct Proc {
    /// What tells it from the session's earlier processes.
    pub serial: u64,
    pub agent: Arc<dyn AgentProcess>,
    /// The runtime it runs on, kept for its whole life, even once the runtime is unregistered.
    pub runtime: Arc<dyn Runtime>,
    /// The name its runtime is registered as: its session's stored `agent`.
    pub kind: String,
    /// The account it runs on, by its runtime's id: none on the server's own login.
    pub account: Option<String>,
    /// The agent's name for people, and what it can do, as they were when it opened.
    pub name: String,
    pub capabilities: Capabilities,
    pub cwd: PathBuf,
    /// The effort it runs on: what it opened with, or its last change.
    pub effort: Option<String>,
    /// Opened without resume, until its first `init`: the agent session that init reports is
    /// the session's own, not a new one the agent started in its process.
    pub adopts: bool,
    /// Closed by the idle timer, an init's problem, or an allow: no message goes to it.
    pub closing: bool,
    /// Its background tasks still running, by their tool calls: a turn does not end, nor the
    /// process close, before they report back.
    pub background: Vec<(String, BackgroundKind)>,
    /// The turn that last ended on it, and the message that started it: it opens again when
    /// the agent goes on by itself.
    pub ended: Option<(i64, String)>,
    /// The line of the new agent session it started, until a turn on it records it.
    pub line: Option<String>,
    /// The signals of a closed process that does not exit.
    pub terminate: Vec<Timer>,
    /// Its token of the MCP endpoint, for a workflow session's process: revoked as it exits.
    pub token: Option<String>,
    /// The latest wakeup the agent set: the idle timer waits a minute past it.
    pub wakeup: Option<SystemTime>,
    /// Its agent session's total so far, which its next report's own work is counted from.
    pub baseline: Option<TokenCounts>,
    /// Told once its events were read to its exit.
    pub done: watch::Sender<bool>,
}

impl Proc {
    /// How many of its background tasks are commands, not sub-agents.
    pub fn commands(&self) -> u32 {
        let commands = self.background.iter();
        let commands = commands.filter(|(_, kind)| *kind == BackgroundKind::Command);
        u32::try_from(commands.count()).unwrap_or(u32::MAX)
    }

    /// Whether it is open, and waits for a wakeup the agent set: it goes on by itself then.
    pub fn wakeup_pending(&self, now: SystemTime) -> bool {
        !self.closing && self.wakeup.is_some_and(|wakeup| wakeup > now)
    }
}

/// A tool call of the running turn that has not ended, or whose background task still runs.
pub(super) struct Tool {
    /// The page of its line.
    pub page: u32,
    /// The tool call of the sub-agent that runs it.
    pub parent: Option<String>,
    /// What the sub-agent it starts is for, when it starts one.
    pub subagent: Option<String>,
    pub started_at: SystemTime,
    /// Its own tool calls so far, for a sub-agent.
    pub calls: u32,
    /// The last of them.
    pub latest: Option<(ToolKind, Option<String>)>,
    /// Its result, held until its background task reports back.
    pub ended: Option<(bool, String)>,
}

/// The turn running on a session's process.
pub(super) struct Running {
    pub id: i64,
    /// The id of the message that started it.
    pub first: String,
    /// What it does now, and since when nothing new showed.
    pub label: String,
    pub since: SystemTime,
    /// The usage limit that refused it, the last one reported: it counts only when it fails.
    pub limit: Option<Limit>,
    /// Its reply ended, and it waits for its background tasks to report back.
    pub replied: bool,
    /// How the turn ends once it was halted: by Stop, the watchdog, its process, or the server.
    pub stop: Option<TurnEnd>,
    pub terminate: Vec<Timer>,
    pub watchdog: Option<Timer>,
    /// Asks about the background tasks a reply that ended waits for, then fails it: `QUIET`.
    pub quiet: Option<Timer>,
    /// It was asked about its background tasks, and showed nothing since.
    pub asked: bool,
    /// Its tool calls not ended, by their ids, in the order they started.
    pub tools: Vec<(String, Tool)>,
    /// The text being written: the place of its first piece, and the page of its line.
    pub text: Option<(u64, u32)>,
    /// The page of its line of skipped output, once it has one.
    pub skipped: Option<u32>,
    /// The page of its transcript's last line.
    pub pages: u32,
    /// When it last showed something: one that shows nothing for long is stopped.
    pub heard: tokio::time::Instant,
    /// Holds its runtime's extension from loading again while it runs: let go as it ends.
    pub _hold: Option<Hold>,
}

impl Running {
    pub fn tool(&mut self, id: &str) -> Option<&mut Tool> {
        let found = self.tools.iter_mut().find(|(call, _)| call == id);
        found.map(|(_, tool)| tool)
    }

    pub fn remove_tool(&mut self, id: &str) -> Option<Tool> {
        let at = self.tools.iter().position(|(call, _)| call == id)?;
        Some(self.tools.remove(at).1)
    }
}

/// A workflow run's trigger and the step its message was read at: checked again as its queued
/// turn starts.
#[derive(Clone, Debug, PartialEq, Eq)]
pub(super) struct Workflow {
    pub trigger: String,
    pub step: Option<String>,
    /// Always start a new session of the change or the feature.
    pub fresh: bool,
    /// A line its turn shows before the message, as a catch-up's.
    pub line: Option<String>,
}

/// A turn waiting for the running one to end, or for another session of its change or feature:
/// its message is written when it starts.
pub(super) struct Queued {
    pub id: i64,
    pub message: Outgoing,
    /// A workflow run's, checked again then: one that no longer applies starts as a chat.
    pub workflow: Option<Workflow>,
}

/// Where a message is.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(super) enum Reading {
    Pending,
    Read,
    TakenBack,
}

/// A message this server sent, or will send, as its turn's log has it.
pub(super) struct Sent {
    pub turn: i64,
    /// Its place in its turn's log, and the page of its line.
    pub seq: u64,
    pub page: u32,
    /// Whether it was written to the agent: a queued turn's is not yet.
    pub written: bool,
    pub state: Reading,
    pub origin: Origin,
    pub text: String,
    pub opening: Option<String>,
    pub images: Vec<ChatImage>,
}

/// A session's changes held while the continue of a turn that ended is decided, to say once it
/// is: read before, the run would read as asking.
#[derive(Default)]
pub(super) struct Held {
    pub deciding: usize,
    pub changes: Vec<(Option<i64>, Option<super::turn::TurnState>)>,
}

/// What this server keeps of a session while it is used.
pub(super) struct Live {
    pub id: String,
    /// Its repository's main checkout.
    pub repo: String,
    pub folder: Option<String>,
    /// The session whose run started it, for a sub-session.
    pub parent: Option<String>,
    /// The sends and turn starts waiting or running, which keep it in memory.
    pub calls: usize,
    /// Held by the one send or turn start that runs.
    pub lock: Arc<Mutex<()>>,
    pub proc: Option<Proc>,
    pub turn: Option<Running>,
    pub queue: VecDeque<Queued>,
    pub messages: HashMap<String, Sent>,
    /// A turn is starting: its process opens. It works, for the other sessions of its folder.
    pub starting: bool,
    pub idle: Option<Timer>,
    pub held: Option<Held>,
}

impl Live {
    pub fn of(row: &Session) -> Live {
        Live {
            id: row.id.clone(),
            repo: row.repo.clone(),
            folder: row.folder.clone(),
            parent: row.parent.clone(),
            calls: 0,
            lock: Arc::default(),
            proc: None,
            turn: None,
            queue: VecDeque::new(),
            messages: HashMap::new(),
            starting: false,
            idle: None,
            held: None,
        }
    }

    /// Whether a turn of the session runs, starts, or waits.
    pub fn working(&self) -> bool {
        self.turn.is_some() || self.starting || !self.queue.is_empty()
    }

    /// Whether nothing of it is left in memory: no process, no turn running or queued, no
    /// message the agent may read, and no call on its way.
    pub fn empty(&self) -> bool {
        self.calls == 0
            && self.proc.is_none()
            && self.turn.is_none()
            && self.queue.is_empty()
            && self.messages.is_empty()
            && self.held.is_none()
    }

    /// The messages steered into a turn that the agent has not read.
    pub fn unread(&self, turn: i64, first: &str) -> Vec<String> {
        let unread = self.messages.iter().filter(|(id, sent)| {
            sent.turn == turn
                && sent.written
                && sent.state == Reading::Pending
                && id.as_str() != first
        });
        unread.map(|(id, _)| id.clone()).collect()
    }
}

/// What a move or a drop holds: a change or a feature, or a session without one.
pub(super) fn folder_key(repo: &str, folder: &str) -> String {
    format!("{repo}\0{folder}")
}

pub(super) fn session_key(session: &str) -> String {
    format!("session\0{session}")
}

/// The sessions kept in memory, and what holds them.
#[derive(Default)]
pub(super) struct Lives {
    pub sessions: HashMap<String, Live>,
    /// The folders, and the sessions without one, that a move or a drop holds.
    pub moving: HashSet<String>,
}

impl Lives {
    /// The session's state, made when it has none.
    pub fn of(&mut self, row: &Session) -> &mut Live {
        let live = self.sessions.entry(row.id.clone());
        live.or_insert_with(|| Live::of(row))
    }

    pub fn get(&mut self, session: &str) -> Option<&mut Live> {
        self.sessions.get_mut(session)
    }

    /// Forgets the session once nothing of it is left in memory.
    pub fn prune(&mut self, session: &str) {
        if self.sessions.get(session).is_some_and(Live::empty) {
            self.sessions.remove(session);
        }
    }

    /// The other sessions of a session's change or feature, sub-sessions left out: they share
    /// its worktree, so one works at a time. A sub-session works in its task's worktree,
    /// beside its parent: it neither waits for its folder's sessions nor makes them wait.
    fn others<'a>(&'a self, of: &'a Live) -> impl Iterator<Item = &'a Live> {
        let shares = move |other: &&Live| {
            of.folder.is_some()
                && of.parent.is_none()
                && other.id != of.id
                && other.parent.is_none()
                && other.repo == of.repo
                && other.folder == of.folder
        };
        self.sessions.values().filter(shares)
    }

    /// Whether another session of the session's change or feature works: its turn runs or
    /// starts, and, with `queued`, while a turn of it waits.
    pub fn other_working(&self, session: &str, queued: bool) -> bool {
        let Some(live) = self.sessions.get(session) else {
            return false;
        };
        self.others(live).any(|other| {
            other.turn.is_some() || other.starting || (queued && !other.queue.is_empty())
        })
    }

    /// The other sessions of the session's change or feature whose turn waits, none running.
    pub fn waiting(&self, session: &str) -> Vec<String> {
        let Some(live) = self.sessions.get(session) else {
            return Vec::new();
        };
        let waiting = self
            .others(live)
            .filter(|other| other.turn.is_none() && !other.queue.is_empty());
        waiting.map(|other| other.id.clone()).collect()
    }

    /// Whether a move or a drop holds the session, or its change or feature.
    pub fn is_moving(&self, session: &str) -> bool {
        let Some(live) = self.sessions.get(session) else {
            return self.moving.contains(&session_key(session));
        };
        let folder = live.folder.as_ref();
        self.moving.contains(&session_key(&live.id))
            || folder.is_some_and(|folder| self.moving.contains(&folder_key(&live.repo, folder)))
    }

    /// The sessions of a main checkout with a turn running, starting, or waiting.
    pub fn working(&self, repo: &str) -> impl Iterator<Item = &Live> {
        let works = move |live: &&Live| live.repo == repo && live.working();
        self.sessions.values().filter(works)
    }
}
