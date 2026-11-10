//! The run options, between the core's types and the protocol's: the core's have no JSON form.

// JOIN(wave 6): a feature's own run options cross the protocol the same way (task 8).

use uraeda_core::settings as core;
use uraeda_protocol::{ReviewerOptions, RunOptions, RunPick, StepOptions};

/// The run options a file holds, as the protocol sends them.
pub(super) fn sent(options: core::RunOptions) -> RunOptions {
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
pub(super) fn given(options: RunOptions) -> core::RunOptions {
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
