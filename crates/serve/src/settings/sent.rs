//! What the settings page sends: the run options as its fields hold them, every value a text,
//! empty for the default, and the core's run options they become.

use serde::{Deserialize, Serialize};
use uraeda_core::settings::{ReviewerOptions, RunOptions, RunPick, StepOptions};

/// The agent an agent reviewer runs on when none is picked.
const REVIEWER_AGENT: &str = "claude";

/// An agent, a model, and an effort, as the page sends them: empty for the default.
#[derive(Clone, Debug, Default, Deserialize, Serialize)]
pub struct Pick {
    #[serde(default)]
    pub(super) agent: String,
    #[serde(default)]
    pub(super) model: String,
    #[serde(default)]
    pub(super) effort: String,
}

impl Pick {
    pub(super) fn of(
        agent: &Option<String>,
        model: &Option<String>,
        effort: &Option<String>,
    ) -> Pick {
        let text = |v: &Option<String>| v.clone().unwrap_or_default();
        Pick {
            agent: text(agent),
            model: text(model),
            effort: text(effort),
        }
    }

    fn values(&self) -> (Option<String>, Option<String>, Option<String>) {
        let value = |v: &str| Some(v.trim().to_string()).filter(|v| !v.is_empty());
        (value(&self.agent), value(&self.model), value(&self.effort))
    }
}

/// A step's options, as the page sends them.
#[derive(Deserialize)]
pub struct Step {
    step: String,
    #[serde(flatten)]
    pick: Pick,
    /// Whether the step starts a new session, cut from the step before.
    new_session: bool,
}

/// A reviewer, as the page sends it: an agent on its pick, or a command.
#[derive(Deserialize)]
pub struct Reviewer {
    #[serde(flatten)]
    pick: Pick,
    #[serde(default)]
    instructions: String,
    #[serde(default)]
    command: String,
}

/// The run options, as the page sends them.
#[derive(Deserialize)]
pub struct Runs {
    steps: Vec<Step>,
    implementers: Pick,
    reviewers: Vec<Reviewer>,
    depth: String,
}

impl Runs {
    /// The options to write: only what differs from the defaults is set.
    pub(super) fn options(&self) -> RunOptions {
        let steps = self
            .steps
            .iter()
            .filter_map(|step| {
                let (agent, model, effort) = step.pick.values();
                let default_cut = step.step == "plan";
                let new_session = (step.step != "discovery" && step.new_session != default_cut)
                    .then_some(step.new_session);
                (agent.is_some() || model.is_some() || effort.is_some() || new_session.is_some())
                    .then(|| StepOptions {
                        step: step.step.clone(),
                        agent,
                        model,
                        effort,
                        new_session,
                    })
            })
            .collect();
        let (agent, model, effort) = self.implementers.values();
        let implementers =
            (agent.is_some() || model.is_some() || effort.is_some()).then_some(RunPick {
                agent,
                model,
                effort,
            });
        let reviewers: Vec<ReviewerOptions> = self
            .reviewers
            .iter()
            .map(|r| {
                let command = Some(r.command.trim().to_string()).filter(|c| !c.is_empty());
                let (agent, model, effort) = r.pick.values();
                let instructions =
                    Some(r.instructions.trim().to_string()).filter(|i| !i.is_empty());
                match command {
                    Some(command) => ReviewerOptions {
                        command: Some(command),
                        ..ReviewerOptions::default()
                    },
                    None => ReviewerOptions {
                        // An agent reviewer names its agent: the default one when none is picked.
                        agent: agent.or_else(|| Some(REVIEWER_AGENT.to_string())),
                        model,
                        effort,
                        instructions,
                        command: None,
                    },
                }
            })
            .collect();
        RunOptions {
            steps,
            implementers,
            reviewers: (!reviewers.is_empty()).then_some(reviewers),
            review_depth: (self.depth == "branch").then(|| "branch".to_string()),
        }
    }
}
