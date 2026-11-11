//! A session's status in the sidebar and its view, decided from its turns, its feature's step,
//! and when the human last saw it: the one rule every record and the notifications read.

use std::time::SystemTime;

use uraeda_protocol::{SessionStatus, StatusReason, Wait};

use super::manager::SERVER_STOPPED;
use super::turn::{ContinueReason, Turn, TurnKind, TurnState};

/// The step of an open pull request behind the default branch, which its agent catches up.
pub(crate) const CATCH_UP: &str = "catch-up";

/// A session's status, in words too, and why.
#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct Status {
    pub status: SessionStatus,
    pub label: &'static str,
    pub reason: Option<StatusReason>,
}

impl Status {
    fn of(status: SessionStatus, label: &'static str, reason: Option<StatusReason>) -> Status {
        Status {
            status,
            label,
            reason,
        }
    }

    /// Whether it is a run that asks for the human, which a message or Continue all goes on
    /// with.
    pub(crate) fn continuable(&self) -> bool {
        use StatusReason::{Capped, Failed, Halted, Interrupted, Stopped};
        let asks = matches!(
            self.reason,
            Some(Failed | Stopped | Interrupted | Halted | Capped)
        );
        self.status == SessionStatus::Attention && asks
    }
}

/// What a session's status reads.
#[derive(Default)]
pub(crate) struct Read<'a> {
    /// Whether its latest turn was refused an action the human has not allowed.
    pub blocked: bool,
    /// At `catch-up`, the default branch's tip the feature's branch is behind.
    pub catch_up_commit: Option<&'a str>,
    /// Its latest turn that ran.
    pub latest: Option<&'a Turn>,
    /// Whether it is its change's or feature's latest: an older one's run halted nothing, as
    /// the folder's runs go to the latest.
    pub latest_session: bool,
    /// Whether a turn of it waits in its queue.
    pub queued: bool,
    pub seen_at: Option<SystemTime>,
    /// The feature's step.
    pub step: Option<&'a str>,
    pub waits_on_agent: bool,
    pub waits_on_human: bool,
    /// Whether its process waits for a wakeup the agent set: it goes on by itself then.
    pub wakeup: bool,
}

/// The wait of a turn, when it waits to continue by itself.
pub(crate) fn wait_of(turn: Option<&Turn>) -> Option<Wait> {
    let turn = turn?;
    let (at, reason) = (turn.continue_at?, turn.continue_reason?);
    Some(Wait {
        at: uraeda_core::today::rfc3339(at),
        reason: match reason {
            ContinueReason::Restart => "restart".to_owned(),
            ContinueReason::Limit => "limit".to_owned(),
        },
    })
}

/// A session's status, from the first rule that matches: a running or queued turn, a latest
/// turn waiting to continue by itself, a blocked action not allowed, a latest turn that failed
/// or was stopped, until the human dismisses it, as capped when it would have continued, a
/// catch-up turn that ended while the step is still `catch-up` for the same tip, in its
/// folder's latest session, until dismissed, a step that waits on the human, a dismissed turn
/// as idle, a latest turn that ended while the step still waits on the agent, in its folder's
/// latest session, but at `catch-up`, as waiting while its process waits for a wakeup the
/// agent set, a latest turn that ended after the human last saw the session, and otherwise
/// idle.
pub(crate) fn session_status(read: &Read<'_>) -> Status {
    use SessionStatus::{Attention, Idle, NeedsYou, Unread, Working};
    let latest = read.latest;
    let state = latest.map(|turn| turn.state);
    let waits_on_agent = read.latest_session && read.waits_on_agent;
    if read.queued || matches!(state, Some(TurnState::Running | TurnState::Queued)) {
        return Status::of(Working, "Working", None);
    }
    // The same rule as the run's wait, so the two never disagree.
    if wait_of(latest).is_some() {
        return Status::of(Working, "Waiting", Some(StatusReason::Waiting));
    }
    let capped = latest.is_some_and(|turn| turn.continue_reason.is_some());
    if read.blocked {
        return Status::of(NeedsYou, "Needs you", Some(StatusReason::Blocked));
    }
    let failed = latest.filter(|turn| matches!(turn.state, TurnState::Failed | TurnState::Stopped));
    if let Some(turn) = failed.filter(|turn| turn.dismissed_at.is_none()) {
        let reason = match (capped, turn.state, turn.reason.as_deref()) {
            (true, _, _) => StatusReason::Capped,
            (false, _, Some(SERVER_STOPPED)) => StatusReason::Interrupted,
            (false, TurnState::Failed, _) => StatusReason::Failed,
            (false, _, _) => StatusReason::Stopped,
        };
        return Status::of(Attention, "Needs attention", Some(reason));
    }
    // A catch-up that ended still behind the tip it caught up with stopped on a conflict,
    // which asks for the human's choice. Behind a newer tip, the default branch moved again:
    // the next catch-up goes on. Only a catch-up turn, or the retry of one allowed an action,
    // records its tip.
    let conflict = latest.filter(|turn| {
        turn.state == TurnState::Done
            && read.step == Some(CATCH_UP)
            && turn.caught_up_to.is_some()
            && turn.caught_up_to.as_deref() == read.catch_up_commit
            && read.latest_session
    });
    if conflict.is_some_and(|turn| turn.dismissed_at.is_none()) {
        return Status::of(Attention, "Needs attention", Some(StatusReason::Conflict));
    }
    if read.waits_on_human {
        return Status::of(NeedsYou, "Needs you", Some(StatusReason::Step));
    }
    if failed.is_some() || conflict.is_some() {
        return Status::of(Idle, "Idle", None);
    }
    let unseen = latest
        .and_then(|turn| turn.ended_at)
        .is_some_and(|ended| read.seen_at.is_none_or(|seen| ended > seen));
    // A chat turn flags until the human opens the session; a workflow turn, until the agent
    // moves on. A turn before the catch-up halted nothing: the pull request it left was ready.
    let halted = latest.is_some_and(|turn| {
        turn.state == TurnState::Done && (turn.kind != TurnKind::Chat || unseen)
    });
    let step = read.step.unwrap_or_default();
    if halted && waits_on_agent && step != "pull-request-unknown" && step != CATCH_UP {
        // The agent waits by its own wakeup: its run halted nothing yet.
        if read.wakeup {
            return Status::of(Working, "Waiting", Some(StatusReason::Waiting));
        }
        let reason = match capped {
            true => StatusReason::Capped,
            false => StatusReason::Halted,
        };
        return Status::of(Attention, "Needs attention", Some(reason));
    }
    match unseen {
        true => Status::of(Unread, "New reply", None),
        false => Status::of(Idle, "Idle", None),
    }
}

/// The order of statuses within a sidebar group: what needs the human first.
pub(crate) fn order(status: SessionStatus) -> u8 {
    match status {
        SessionStatus::NeedsYou => 0,
        SessionStatus::Attention => 1,
        SessionStatus::Unread => 2,
        SessionStatus::Working => 3,
        SessionStatus::Idle => 4,
    }
}

/// Whether Continue all continues a feature: its step waits on the agent, which has a message
/// to send, and its run asks and a message can continue it, or, at `catch-up`, nothing ran it
/// yet: it reads idle or with a new reply. A run that failed at a human gate asks too, but the
/// gate is the human's; a catch-up stopped on a conflict asks for the human's choice.
pub(crate) fn continued_by_all(status: &Status, step: &str, waits_on: &str) -> bool {
    let idle = matches!(status.status, SessionStatus::Idle | SessionStatus::Unread);
    waits_on == "agent" && (status.continuable() || (step == CATCH_UP && idle))
}
