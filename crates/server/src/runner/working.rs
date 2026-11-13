//! What works now, as the manager's memory says: the folders and sessions at work, a running
//! turn's activity and sub-agents, and the hold a move or a drop takes on what no agent works on.

use uraeda_protocol::{Subagent, SubagentCall, TurnActivity};

use super::live::{Live, folder_key, session_key};
use super::manager::{Runner, refusals};
use super::processes;
use crate::live::Fault;

impl Runner {
    /// The folders of a repository whose session has a turn running, starting, or queued.
    pub(crate) fn working(&self, root: &str) -> Vec<String> {
        let state = self.state();
        let folders = state.lives.working(root);
        folders.filter_map(|live| live.folder.clone()).collect()
    }

    /// Whether a chat, a session without a feature, has a turn running, starting, or queued.
    pub(crate) fn chat_working(&self, root: &str) -> bool {
        let state = self.state();
        state.lives.working(root).any(|live| live.folder.is_none())
    }

    /// Whether any session of the repository, a chat's too, has a turn running, starting, or
    /// queued.
    pub(crate) fn busy(&self, root: &str) -> bool {
        self.state().lives.working(root).next().is_some()
    }

    /// Whether the session's agent works: a turn of it runs, starts, or waits, on this server.
    pub(crate) fn session_working(&self, session: &str) -> bool {
        let state = self.state();
        state.lives.sessions.get(session).is_some_and(Live::working)
    }

    /// How many background commands of the session's run still run.
    pub(crate) fn background_commands(&self, session: &str) -> u32 {
        let state = self.state();
        let proc = state.lives.sessions.get(session);
        let proc = proc.and_then(|live| live.proc.as_ref());
        proc.map_or(0, processes::commands)
    }

    /// Whether the session's process waits for a wakeup the agent set.
    pub(crate) fn wakeup(&self, session: &str) -> bool {
        let now = self.now();
        let state = self.state();
        let proc = state.lives.sessions.get(session);
        let proc = proc.and_then(|live| live.proc.as_ref());
        proc.is_some_and(|proc| proc.wakeup_pending(now))
    }

    /// What a running turn does now, and its sub-agents at work, in the order they started:
    /// none for a turn this server does not run.
    pub(crate) fn turn_live(&self, turn: i64) -> Option<(TurnActivity, Vec<Subagent>)> {
        let state = self.state();
        let mut running = state
            .lives
            .sessions
            .values()
            .filter_map(|live| live.turn.as_ref());
        let running = running.find(|running| running.id == turn)?;
        let activity = TurnActivity {
            label: running.label.clone(),
            since: super::page::sent(running.since),
        };
        let subagents = running.tools.iter().filter_map(|(id, tool)| {
            Some(Subagent {
                id: id.clone(),
                description: tool.subagent.clone()?,
                parent: tool.parent.clone(),
                started_at: super::page::sent(tool.started_at),
                calls: tool.calls,
                latest: tool.latest.clone().map(|(kind, target)| SubagentCall {
                    tool_kind: super::page::tool_kind(kind),
                    target,
                }),
            })
        });
        Some((activity, subagents.collect()))
    }

    /// How many sub-agents of the session's running turn work.
    pub(crate) fn subagents(&self, session: &str) -> u32 {
        let state = self.state();
        let running = state
            .lives
            .sessions
            .get(session)
            .and_then(|live| live.turn.as_ref());
        let subagents = running.map_or(0, |running| {
            running
                .tools
                .iter()
                .filter(|(_, tool)| tool.subagent.is_some())
                .count()
        });
        u32::try_from(subagents).unwrap_or(u32::MAX)
    }

    /// Holds the change or the feature, or the session without one, for a move or a drop:
    /// refused while one of its sessions works, or another move holds it. Until what it
    /// returns is dropped, its sessions take no message.
    pub(crate) fn hold(&self, root: &str, target: Target<'_>) -> Result<Moving, Fault> {
        let mut state = self.state();
        let (busy, key) = match target {
            Target::Folder(folder) => {
                let mut working = state.lives.working(root);
                let busy = working.any(|live| live.folder.as_deref() == Some(folder));
                (busy, folder_key(root, folder))
            }
            Target::Session(session) => {
                let live = state.lives.sessions.get(session);
                (live.is_some_and(Live::working), session_key(session))
            }
        };
        if busy {
            return Err(Fault::refused(refusals::AGENT_WORKING));
        }
        if !state.lives.moving.insert(key.clone()) {
            return Err(Fault::refused(refusals::MOVING));
        }
        Ok(Moving {
            runner: self.clone(),
            key,
        })
    }
}

/// What a move or a drop holds.
pub(crate) enum Target<'a> {
    /// A change or a feature, by its folder.
    Folder(&'a str),
    /// A session without one.
    Session(&'a str),
}

/// A change, a feature, or a session held for a move or a drop, until this is dropped.
pub(crate) struct Moving {
    runner: Runner,
    key: String,
}

impl Drop for Moving {
    fn drop(&mut self) {
        self.runner.state().lives.moving.remove(&self.key);
    }
}
