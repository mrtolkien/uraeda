//! A turn's transcript, by pages: [`TurnLog`] and its lines.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use super::ToolKind;
use crate::registry::Record;
use crate::shared::ChatImage;

/// Which page of a turn's transcript.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct TurnLogArgs {
    /// The repository's name in the list.
    pub repo: String,
    /// The turn's id.
    pub turn: String,
    /// The page, from 0.
    pub page: u32,
}

/// A page of a turn's transcript: its items, in order. Its value is `null` for a turn that is
/// none of the repository's.
///
/// A page is never read again for a piece of a reply: a text being written grows by an `append`
/// at `["items", <id>, "text"]`. A new item, and an item whose state changed, as a tool call
/// that ended, reads its own page again, and no other.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct TurnLog {
    pub items: Vec<Item>,
}

impl Record for TurnLog {
    const NAME: &'static str = "TurnLog";
    type Args = TurnLogArgs;
    type Value = Option<Self>;
}

/// A line of a turn's transcript, whatever the agent. Its `id` is its place in its turn's log,
/// which names it for good.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(
    tag = "kind",
    rename_all = "kebab-case",
    rename_all_fields = "camelCase"
)]
pub enum Item {
    /// A message sent to the agent: the human's, or the workflow's. One taken back leaves the
    /// transcript.
    Message {
        id: String,
        /// The message's own id, which `session.takeBack` names.
        message: String,
        at: u64,
        origin: MessageOrigin,
        /// Whether the agent read it.
        read: bool,
        text: String,
        /// The chat's opening line, shown above the human's text.
        opening: Option<String>,
        images: Vec<ChatImage>,
    },
    /// A text the agent wrote: `streaming` until it ends.
    Text {
        id: String,
        streaming: bool,
        text: String,
    },
    /// A tool call.
    Tool {
        id: String,
        /// The tool call's own id.
        call: String,
        /// `Bash`, `Read`, ...
        name: String,
        tool_kind: ToolKind,
        /// The command, the path from the session's directory, the address, or the pattern.
        target: Option<String>,
        /// The tool call of the sub-agent that runs it.
        parent: Option<String>,
        /// What the sub-agent it starts is for, when it starts one.
        subagent: Option<String>,
        status: ToolStatus,
        /// Its result's text, cut to its first 4,000 characters.
        output: Option<String>,
        /// How long it took, once it ended, in milliseconds.
        duration_ms: Option<u64>,
    },
    /// A thinking block: its text only when the agent gave one, and how long it lasted.
    Thought {
        id: String,
        /// The tool call of the sub-agent that thought it.
        parent: Option<String>,
        text: Option<String>,
        duration_ms: u64,
    },
    /// A line of Uraeda's, or of the agent's: a new agent session, a retry, skipped lines.
    System { id: String, text: String },
    /// An action the agent's permissions blocked. Without a rule, it cannot be allowed.
    Denial {
        id: String,
        tool: String,
        target: Option<String>,
        rule: Option<String>,
        allowed: bool,
    },
}

/// Who sent a message to the agent.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "kebab-case")]
pub enum MessageOrigin {
    Human,
    Workflow,
}

/// Where a tool call is.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "kebab-case")]
pub enum ToolStatus {
    InProgress,
    Completed,
    Failed,
}
