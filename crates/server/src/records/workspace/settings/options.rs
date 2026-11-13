//! The run options, between the core's types and the protocol's: the core's have no JSON form.
//! The settings' and a feature's own cross the protocol through here.

use uraeda_core::settings as core;
use uraeda_protocol::{ReviewerOptions, RunOptions, RunPick, StepOptions};

use crate::runtimes::Runtimes;

/// The run options a file holds, as the protocol sends them.
pub(in crate::records) fn sent(options: core::RunOptions) -> RunOptions {
    let step = |step: core::StepOptions| StepOptions {
        step: step.step,
        agent: step.agent,
        model: step.model,
        effort: step.effort,
        new_session: step.new_session,
    };
    let pick = |pick: core::RunPick| RunPick {
        agent: pick.agent,
        model: pick.model,
        effort: pick.effort,
    };
    let reviewer = |reviewer: core::ReviewerOptions| ReviewerOptions {
        agent: reviewer.agent,
        model: reviewer.model,
        effort: reviewer.effort,
        instructions: reviewer.instructions,
        command: reviewer.command,
    };
    let reviewers = |reviewers: Vec<_>| reviewers.into_iter().map(reviewer).collect();
    RunOptions {
        steps: options.steps.into_iter().map(step).collect(),
        implementers: options.implementers.map(pick),
        reviewers: options.reviewers.map(reviewers),
        review_depth: options.review_depth,
    }
}

/// The run options a client sends, as the core writes them.
pub(in crate::records) fn given(options: RunOptions) -> core::RunOptions {
    let step = |step: StepOptions| core::StepOptions {
        step: step.step,
        agent: step.agent,
        model: step.model,
        effort: step.effort,
        new_session: step.new_session,
    };
    let pick = |pick: RunPick| core::RunPick {
        agent: pick.agent,
        model: pick.model,
        effort: pick.effort,
    };
    let reviewer = |reviewer: ReviewerOptions| core::ReviewerOptions {
        agent: reviewer.agent,
        model: reviewer.model,
        effort: reviewer.effort,
        instructions: reviewer.instructions,
        command: reviewer.command,
    };
    let reviewers = |reviewers: Vec<_>| reviewers.into_iter().map(reviewer).collect();
    core::RunOptions {
        steps: options.steps.into_iter().map(step).collect(),
        implementers: options.implementers.map(pick),
        reviewers: options.reviewers.map(reviewers),
        review_depth: options.review_depth,
    }
}

/// What a client sends as a pick's model or effort left to the agent's own default: no model or
/// effort is named by an empty text.
const AGENTS_OWN: &str = "";

/// Options a client sends, as they are kept over `fallback`, the options they are read over: a
/// model or an effort left to the agent's own default (`""`), where the fallback sets one on the
/// same agent, is kept as the default the agent gives now, since a value left out would run on
/// the fallback's; anywhere else, and while the agent says no default, it is left out. A
/// reviewer's is always left out: the reviewers are kept whole, never read over others.
pub(in crate::records) fn left_to_agents(
    options: RunOptions,
    fallback: &core::RunOptions,
    runtimes: &Runtimes,
) -> RunOptions {
    let steps = options.steps.into_iter().map(|step| {
        let over = fallback.steps.iter().find(|each| each.step == step.step);
        let over = over.map(|each| core::RunPick {
            agent: each.agent.clone(),
            model: each.model.clone(),
            effort: each.effort.clone(),
        });
        let pick = RunPick {
            agent: step.agent,
            model: step.model,
            effort: step.effort,
        };
        let pick = own_defaults(pick, over.as_ref(), runtimes);
        StepOptions {
            agent: pick.agent,
            model: pick.model,
            effort: pick.effort,
            ..step
        }
    });
    let implementers = options
        .implementers
        .map(|pick| own_defaults(pick, fallback.implementers.as_ref(), runtimes));
    let reviewer = |reviewer: ReviewerOptions| ReviewerOptions {
        model: reviewer.model.filter(|model| model != AGENTS_OWN),
        effort: reviewer.effort.filter(|effort| effort != AGENTS_OWN),
        ..reviewer
    };
    RunOptions {
        steps: steps.collect(),
        implementers,
        reviewers: options
            .reviewers
            .map(|list| list.into_iter().map(reviewer).collect()),
        review_depth: options.review_depth,
    }
}

/// A pick's model and effort left to its agent's own default, as kept over `fallback`'s pick.
fn own_defaults(pick: RunPick, fallback: Option<&core::RunPick>, runtimes: &Runtimes) -> RunPick {
    let none = core::RunPick::default();
    let fallback = fallback.unwrap_or(&none);
    // The core's merge keeps the fallback's model and effort only on the agent it names.
    let same = pick.agent.is_none() || pick.agent == fallback.agent;
    let agent = pick.agent.clone().or_else(|| fallback.agent.clone());
    // Neither naming one, the first agent on runs.
    let agent = agent.or_else(|| runtimes.on_in(None).into_iter().next());
    let defaults = agent
        .and_then(|name| runtimes.models(&name))
        .map(|list| list.defaults);
    let own = |value: Option<String>, over: &Option<String>, default: Option<String>| match value {
        Some(text) if text == AGENTS_OWN => default.filter(|_| same && over.is_some()),
        value => value,
    };
    let (model, effort) = defaults.map_or((None, None), |both| (both.model, both.effort));
    RunPick {
        model: own(pick.model, &fallback.model, model),
        effort: own(pick.effort, &fallback.effort, effort),
        agent: pick.agent,
    }
}
