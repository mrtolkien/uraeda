//! What an agent runtime says of itself: what its agent can do, and the models it lists. The
//! runtime contract gives them, and a client reads them where a session starts.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// What an agent can do, which a client offers and nothing more.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Capabilities {
    /// The agent asks before an action, instead of skipping it.
    pub approvals: bool,
    /// The agent opens the images sent with a message, by their paths.
    pub images: bool,
    /// A message sent during a turn waits for the next one.
    pub queue: bool,
    /// A message sent during a turn joins it.
    pub steer: bool,
    /// The agent reports its sub-agents and their tools.
    pub subagents: bool,
    /// A message not read yet can be taken back.
    pub take_back: bool,
}

/// The models a runtime lists, in the agent's order, and what the agent runs on when none is
/// picked.
#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ModelList {
    pub defaults: ModelDefaults,
    pub models: Vec<AgentModel>,
}

/// The model and the effort an agent runs on when none is picked, by their ids.
#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ModelDefaults {
    pub model: Option<String>,
    pub effort: Option<String>,
}

/// A model the agent lists for the account.
#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct AgentModel {
    /// The agent's id, which a session stores as its model.
    pub id: String,
    /// Its name for people.
    pub name: String,
    /// The agent's line about it.
    pub description: Option<String>,
    /// The efforts it takes, in the agent's order: empty for none.
    pub efforts: Vec<ModelEffort>,
}

/// An effort a model takes: the agent's id for it, and its name for people.
#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ModelEffort {
    pub id: String,
    pub name: String,
}
