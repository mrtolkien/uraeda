//! The records `Turn` and `TurnLog`: a turn's state and what it does now, and one page of its
//! transcript.

use uraeda_protocol::{SessionArgs, Turn, TurnKind, TurnLog, TurnLogArgs, TurnState};

use crate::live::{Fault, Registry};
use crate::runner::{self, Runner, sent};
use crate::shared::Shared;

/// Registers the records `Turn` and `TurnLog`.
pub(super) fn register(registry: &Registry) {
    registry.record::<Turn>(read);
    registry.record::<TurnLog>(page);
}

/// The turn of an id, with its session, when its session is one of the repository's.
fn own(
    runner: &Runner,
    repository: &str,
    id: &str,
) -> Result<Option<(runner::Turn, runner::Session)>, Fault> {
    let root = runner.root_of(repository)?;
    let store = runner.store();
    let Some(turn) = id
        .parse()
        .ok()
        .map(|id| store.turn(id))
        .transpose()?
        .flatten()
    else {
        return Ok(None);
    };
    let session = store.session(&turn.session_id)?;
    Ok(session
        .filter(|row| row.repo == root)
        .map(|row| (turn, row)))
}

/// The value of the record `Turn`: none for an id that is no turn's of the repository.
fn read(shared: &Shared, args: SessionArgs) -> Result<Option<Turn>, Fault> {
    let runner = Runner::of(shared);
    let Some((turn, _)) = own(&runner, &args.repo, &args.id)? else {
        return Ok(None);
    };
    // What it does now is the manager's, while it runs on this server.
    let live = runner
        .turn_live(turn.id)
        .filter(|_| turn.state == runner::TurnState::Running);
    let (activity, subagents) = live.unzip();
    Ok(Some(Turn {
        id: turn.id.to_string(),
        session: turn.session_id,
        kind: match turn.kind {
            runner::TurnKind::Workflow => TurnKind::Workflow,
            runner::TurnKind::Chat => TurnKind::Chat,
            runner::TurnKind::Allow => TurnKind::Allow,
        },
        state: match turn.state {
            runner::TurnState::Queued => TurnState::Queued,
            runner::TurnState::Running => TurnState::Running,
            runner::TurnState::Done => TurnState::Done,
            runner::TurnState::Failed => TurnState::Failed,
            runner::TurnState::Stopped => TurnState::Stopped,
        },
        reason: turn.reason,
        step: turn.step,
        // A trigger this version does not know is left out.
        trigger: turn
            .trigger
            .and_then(|trigger| serde_json::from_value(serde_json::Value::String(trigger)).ok()),
        allowed: turn.allowed,
        started_at: turn.started_at.map(sent),
        ended_at: turn.ended_at.map(sent),
        dismissed: turn.dismissed_at.is_some(),
        activity,
        subagents: subagents.unwrap_or_default(),
        pages: runner.store().pages(turn.id)?,
    }))
}

/// The value of the record `TurnLog`: a page of a turn's transcript, none for a turn that is
/// none of the repository's. It reads the page's own events, whatever the turn's length.
fn page(shared: &Shared, args: TurnLogArgs) -> Result<Option<TurnLog>, Fault> {
    let runner = Runner::of(shared);
    let Some((turn, session)) = own(&runner, &args.repo, &args.turn)? else {
        return Ok(None);
    };
    let agent = runner.runtime_name(&session.agent);
    let items = runner.store().page(turn.id, args.page, &agent)?;
    Ok(Some(TurnLog { items }))
}
