//! What the sessions' records, a feature's status, and the automatic runs read of a session:
//! its turns, its status, and each feature in flight with the status every view shows.

use std::path::Path;

use uraeda_core::api;
use uraeda_core::view::FeatureView;
use uraeda_protocol::{FeatureStatus, SessionStatus, StatusReason, Wait};

use super::manager::Runner;
use super::running::latest_of;
use super::session::Session;
use super::status::{self, Status, session_status, wait_of};
use super::turn::{Turn, TurnState};
use crate::live::Fault;

/// What a session's status and its row read of its turns.
pub(crate) struct Turns {
    /// Every turn, the oldest first.
    pub turns: Vec<Turn>,
    /// Whether a turn waits in its queue.
    pub queued: bool,
    /// Whether its latest turn was refused an action the human has not allowed.
    pub blocked: bool,
}

impl Turns {
    /// The latest turn that ran: a queued message taken back ran nothing, and never asks for
    /// the human.
    pub(crate) fn latest(&self) -> Option<&Turn> {
        latest_of(&self.turns, None)
    }

    /// Whether a turn of the session runs or waits.
    fn works(&self) -> bool {
        let state = self.latest().map(|turn| turn.state);
        self.queued || matches!(state, Some(TurnState::Running | TurnState::Queued))
    }
}

/// A session's status, with when its run continues by itself while it waits.
pub(crate) struct Read {
    pub status: Status,
    pub wait: Option<Wait>,
}

impl Runner {
    /// A session's turns, as its status reads them.
    pub(crate) fn turns_of(&self, session: &str) -> Result<Turns, Fault> {
        let store = self.store();
        let turns = store.turns(session)?;
        let queued = turns.iter().any(|turn| turn.state == TurnState::Queued);
        let blocked = match latest_of(&turns, None) {
            Some(latest) => store
                .blocked(latest.id)?
                .iter()
                .any(|blocked| !blocked.allowed),
            None => false,
        };
        Ok(Turns {
            turns,
            queued,
            blocked,
        })
    }

    /// A session's status, from its turns, whether its process waits for a wakeup the agent
    /// set, when it was seen, its feature's step, and whether it is its feature's latest
    /// session.
    pub(crate) fn status_of(
        &self,
        row: &Session,
        turns: &Turns,
        feature: Option<&FeatureView>,
        latest_session: bool,
    ) -> Read {
        let step = feature.map(|feature| &feature.step);
        let catch_up = step.and_then(|step| step.catch_up.as_ref());
        let status = session_status(&status::Read {
            blocked: turns.blocked,
            catch_up_commit: catch_up.map(|catch_up| catch_up.commit.as_str()),
            latest: turns.latest(),
            latest_session,
            queued: turns.queued,
            seen_at: row.seen_at,
            step: step.map(|step| step.name.as_str()),
            waits_on_agent: step.is_some_and(|step| step.waits_on == "agent"),
            waits_on_human: step.is_some_and(|step| step.waits_on == "human"),
            wakeup: self.wakeup(&row.id),
        });
        let waits = status.reason == Some(StatusReason::Waiting);
        Read {
            wait: wait_of(turns.latest()).filter(|_| waits),
            status,
        }
    }

    /// The rules of the feature status decision, from the feature's step and its sessions, the
    /// first that matches: a session running or queued, or one whose sub-session is, the
    /// latest started first, gives "Working", from that session, whatever the step; a feature
    /// with problems needs the human; then the latest session's own status, which reads the
    /// step, never an older session's outcome; without a session, the step needs the human
    /// when it waits on them, else the feature is idle.
    pub(crate) fn feature_status(&self, root: &str, feature: &FeatureView) -> FeatureStatus {
        let idle = |status, label: &str, reason| FeatureStatus {
            status,
            label: label.to_owned(),
            reason,
            session: None,
            turn: None,
            wait: None,
        };
        let asks = !feature.problems.is_empty();
        let store = self.store();
        let sessions = store
            .folder_sessions(root, &feature.folder)
            .unwrap_or_default();
        // The latest session, unless one runs or waits: the first, latest started first, stops
        // the read.
        let mut followed = None;
        for row in sessions {
            let Ok(turns) = self.turns_of(&row.id) else {
                continue;
            };
            // A session works, or one of its sub-sessions does, in a task's worktree.
            let subs = store.sub_sessions(&row.id).unwrap_or_default();
            let sub_works = subs
                .iter()
                .any(|sub| self.turns_of(&sub.id).is_ok_and(|turns| turns.works()));
            if turns.works() || sub_works {
                return FeatureStatus {
                    session: Some(row.id),
                    turn: turns.latest().map(|turn| turn.id.to_string()),
                    ..idle(SessionStatus::Working, "Working", None)
                };
            }
            followed.get_or_insert((row, turns));
        }
        let needs_you = |reason| idle(SessionStatus::NeedsYou, "Needs you", reason);
        let Some((row, turns)) = followed else {
            return match (asks, feature.step.waits_on == "human") {
                (true, _) => needs_you(None),
                (false, true) => needs_you(Some(StatusReason::Step)),
                (false, false) => idle(SessionStatus::Idle, "Idle", None),
            };
        };
        let (session, turn) = (
            Some(row.id.clone()),
            turns.latest().map(|turn| turn.id.to_string()),
        );
        if asks {
            return FeatureStatus {
                session,
                turn,
                ..needs_you(None)
            };
        }
        let read = self.status_of(&row, &turns, Some(feature), true);
        FeatureStatus {
            status: read.status.status,
            label: read.status.label.to_owned(),
            reason: read.status.reason,
            session,
            turn,
            wait: read.wait,
        }
    }

    /// Each feature in flight of a repository, with its status: what the notifications,
    /// Continue all, and the catcher read.
    pub(crate) fn feature_statuses(&self, root: &str) -> Vec<(FeatureView, FeatureStatus)> {
        let Ok(workspace) = api::read_workspace(Path::new(root)) else {
            return Vec::new();
        };
        let in_flight = workspace
            .features
            .into_iter()
            .filter(|feature| !matches!(feature.step.name.as_str(), "done" | "none"));
        in_flight
            .map(|feature| {
                let status = self.feature_status(root, &feature);
                (feature, status)
            })
            .collect()
    }

    /// Each chat of a repository that is not archived, with its title and its status, from the
    /// same rules as the sidebar's.
    pub(crate) fn chat_statuses(&self, root: &str) -> Vec<(Session, Option<i64>, Status)> {
        let chats = self
            .store()
            .sessions_of(root, u32::MAX, None)
            .unwrap_or_default();
        let open = chats
            .into_iter()
            .filter(|row| row.folder.is_none() && row.archived_at.is_none());
        open.filter_map(|row| {
            let turns = self.turns_of(&row.id).ok()?;
            let status = self.status_of(&row, &turns, None, true).status;
            Some((row, turns.latest().map(|turn| turn.id), status))
        })
        .collect()
    }
}

/// The status of a session as the protocol sends it.
pub(crate) fn status_of_feature(status: &FeatureStatus) -> Status {
    Status {
        status: status.status,
        label: "",
        reason: status.reason,
    }
}
