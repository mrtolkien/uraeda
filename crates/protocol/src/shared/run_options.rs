//! The run options: which agent, model, and effort each step runs on, as the settings hold
//! them for every feature, and as a feature holds its own.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// The run options a settings file or a feature holds, every value optional: what was picked,
/// nothing resolved.
#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct RunOptions {
    /// The steps with an option set, in the workflow's order.
    pub steps: Vec<StepOptions>,
    /// The agent, model, and effort of the build's implementers.
    pub implementers: Option<RunPick>,
    /// The reviewers, in the order they run: one agent reviewer on the review step's agent when
    /// unset or empty.
    pub reviewers: Option<Vec<ReviewerOptions>>,
    /// `waves`, each wave and the branch, or `branch`: `waves` when unset.
    pub review_depth: Option<String>,
}

/// One step's options.
#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct StepOptions {
    /// The step: `discovery`, `spec`, `plan`, `build`, `review`, or `comments`.
    pub step: String,
    /// The agent's runtime, like `claude` or `codex`.
    pub agent: Option<String>,
    /// A model the agent lists.
    pub model: Option<String>,
    /// An effort the model takes.
    pub effort: Option<String>,
    /// Whether the step starts a clean session.
    pub new_session: Option<bool>,
}

/// An agent, a model, and an effort picked for a role, like the implementers'.
#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct RunPick {
    /// The agent's runtime.
    pub agent: Option<String>,
    /// A model the agent lists.
    pub model: Option<String>,
    /// An effort the model takes.
    pub effort: Option<String>,
}

/// A reviewer: an agent, or a command the human wrote.
#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ReviewerOptions {
    /// An agent reviewer's runtime: none on a command reviewer.
    pub agent: Option<String>,
    /// A model the agent lists.
    pub model: Option<String>,
    /// An effort the model takes.
    pub effort: Option<String>,
    /// Text added to the review's prompt.
    pub instructions: Option<String>,
    /// A command reviewer's shell command, run in the feature's worktree.
    pub command: Option<String>,
}
