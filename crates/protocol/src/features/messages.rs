//! The workflow's messages: the one a step's run starts with, which fills the composer, and the
//! one recommended to a feature now.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use super::ItemArgs;
use crate::registry::Record;

/// What started a workflow turn, which its message tells the agent.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "kebab-case")]
pub enum Trigger {
    /// The human answered a round of questions.
    Answers,
    /// The human approved a spec or a plan.
    Approval,
    /// The catcher catches up an open pull request behind the default branch.
    CatchUp,
    /// The human requested changes.
    Changes,
    /// The comments message, on the feature's pull request.
    Comments,
    /// The human committed a proposal.
    Proposal,
    /// A feature or a change started.
    Start,
    /// The human sent the step's message.
    Manual,
    /// The run Uraeda started itself once the step before ended.
    NextStep,
}

/// Which workflow message: a feature's, for what starts its run.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowMessageArgs {
    /// The repository's name in the list.
    pub repo: String,
    /// The feature's or the change's folder.
    pub folder: String,
    /// What starts the run: `comments` gives the comments message, whatever the step.
    pub trigger: Trigger,
}

/// The workflow's message for a feature and a trigger, which the composer is filled with. Its
/// value is `null` when no feature has that folder.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowMessage {
    /// Why there is no message: the feature has no branch, or does not wait on the agent.
    pub refusal: Option<String>,
    /// The step the message starts.
    pub step: String,
    /// The message: empty with a refusal.
    pub text: String,
}

impl Record for WorkflowMessage {
    const NAME: &'static str = "WorkflowMessage";
    type Args = WorkflowMessageArgs;
    type Value = Option<Self>;
}

/// The one workflow message that applies to a feature now, by its folder, which its session's
/// composer offers; or why none does, with an empty text. Its value is `null` when no feature
/// has that folder.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct RecommendedMessage {
    /// What the message does, like `Continue, write the plan`.
    pub name: Option<String>,
    /// Why no message is recommended.
    pub reason: Option<String>,
    /// The step it starts.
    pub step: Option<String>,
    /// The message: empty with a reason.
    pub text: String,
    /// What sending it counts as.
    pub trigger: Option<Trigger>,
}

impl Record for RecommendedMessage {
    const NAME: &'static str = "RecommendedMessage";
    type Args = ItemArgs;
    type Value = Option<Self>;
}

/// The workflow's message that postpones a feature or a change, by its folder, which the human
/// reads before it is sent: its folder leaves, a proposal stays, its line goes to Later. Its value
/// is `null` when no feature has that folder.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct PostponeMessage {
    /// Why it cannot be sent: a feature with no branch left to close.
    pub refusal: Option<String>,
    /// The message: empty with a refusal.
    pub text: String,
}

impl Record for PostponeMessage {
    const NAME: &'static str = "PostponeMessage";
    type Args = ItemArgs;
    type Value = Option<Self>;
}
