//! What a feature's record reads of its sessions: their ids, the runtime its runs go to, what
//! a new session of it runs on, and its sessions' time and tokens.

use uraeda_core::steps::StepName;
use uraeda_core::view::FeatureView;
use uraeda_protocol::{FeatureAgent, FeatureTokens, NewPick};

use crate::runner::{Runner, Turn, TurnState, sent};
use crate::shared::Shared;

/// What a feature's record shows of its sessions.
#[derive(Default)]
pub(crate) struct Sessions {
    /// Its latest session, the one its runs go to.
    pub session: Option<String>,
    /// Its sessions, the latest started first, without the archived ones.
    pub sessions: Vec<String>,
    /// The runtime of its latest session.
    pub runtime: Option<String>,
    pub new_pick: Option<NewPick>,
    pub agent: Option<FeatureAgent>,
    pub tokens: Option<FeatureTokens>,
}

/// A feature's sessions, as its record shows them: none before the sessions run.
pub(crate) fn sessions_of(shared: &Shared, root: &str, feature: &FeatureView) -> Sessions {
    let Some(runner) = Runner::find(shared) else {
        return Sessions::default();
    };
    let store = runner.store();
    let rows = store
        .folder_sessions(root, &feature.folder)
        .unwrap_or_default();
    // Every session's turns, then with their sub-sessions', in the order they were added.
    let turns_of = |id: &str| store.turns(id).unwrap_or_default();
    let mut turns: Vec<Turn> = rows.iter().flat_map(|row| turns_of(&row.id)).collect();
    turns.sort_by_key(|turn| turn.id);
    let subs = rows
        .iter()
        .flat_map(|row| store.sub_sessions(&row.id).unwrap_or_default());
    let mut all: Vec<Turn> = subs.flat_map(|sub| turns_of(&sub.id)).collect();
    all.extend(turns.iter().cloned());
    all.sort_by_key(|turn| turn.id);
    let run_step = StepName::parse(&feature.step.name).and_then(|step| step.run_step());
    let pick = runner.step_pick(root, &feature.folder, run_step);
    Sessions {
        session: rows.first().map(|row| row.id.clone()),
        runtime: rows.first().map(|row| row.agent.clone()),
        // An archived session, of a dropped change, leaves the lists.
        sessions: rows
            .iter()
            .filter(|row| row.archived_at.is_none())
            .map(|row| row.id.clone())
            .collect(),
        new_pick: pick.map(|pick| NewPick {
            runtime: pick.runtime,
            model: pick.model,
            effort: pick.effort,
        }),
        agent: agent_time(&turns),
        tokens: tokens(&all),
    }
}

/// The agent time of a feature's turns: none when no turn has a start. A turn with no end that
/// is not running adds nothing: its time cannot be counted, and is not guessed.
pub(crate) fn agent_time(turns: &[Turn]) -> Option<FeatureAgent> {
    if !turns.iter().any(|turn| turn.started_at.is_some()) {
        return None;
    }
    let (mut millis, mut running_since) = (0, None);
    for turn in turns {
        match (turn.started_at, turn.ended_at) {
            // A clock set back leaves a negative span: not a time that ran.
            (Some(started), Some(ended)) => {
                millis += ended
                    .duration_since(started)
                    .map_or(0, |ran| ran.as_millis());
            }
            // Sessions run one at a time: only the latest running turn is named.
            (Some(started), None) if turn.state == TurnState::Running => {
                running_since = Some(sent(started));
            }
            _ => {}
        }
    }
    Some(FeatureAgent {
        seconds: u64::try_from(millis / 1000).unwrap_or(u64::MAX),
        running_since,
    })
}

/// The tokens of a feature's sessions' turns, in order: none when no turn has counts.
pub(crate) fn tokens(turns: &[Turn]) -> Option<FeatureTokens> {
    let first = turns.iter().position(|turn| turn.tokens.is_some())?;
    // A counted turn has ended: it has a time.
    let since = turns[first].started_at.or(turns[first].ended_at)?;
    let counted = turns.iter().filter_map(|turn| turn.tokens);
    let (input, output) = counted.fold((0, 0), |(input, output), tokens| {
        (
            input + tokens.input + tokens.cache_write,
            output + tokens.output,
        )
    });
    Some(FeatureTokens {
        input,
        output,
        partial: turns[..first]
            .iter()
            .any(|turn| turn.state == TurnState::Done),
        since: sent(since),
    })
}
