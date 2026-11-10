//! The events of a turn, whatever the agent: what a runtime reads from its agent's output, and
//! what the runner writes beside it. A turn's transcript is the log of them, in order.
//!
//! Each keeps the meaning and the JSON of `AgentEvent`, in
//! [`events.ts`](/packages/server/src/runner/events.ts): `{"type":"toolEnd","id":..,"isError":..}`.
//! Three have no twin there, as no agent sends them: [`Event::Message`], [`Event::Denial`], and
//! [`Event::Allowed`], which the runner logs for what the Node server kept as an item it changed
//! in place.
//!
//! # Reading a log
//!
//! Nothing in the log is ever changed, so what a transcript shows is read from the events in
//! their order:
//!
//! - A **message** is pending from its `message` until an `accepted` or a `cancelled` of its id:
//!   read, or taken back.
//! - A **text** is every `textDelta` since the last `text`, joined, wherever other events came
//!   between them. The `text` that follows is the same text, whole: it replaces the pieces, and
//!   ends the text. A `text` with no piece before it is a whole text of its own. Pieces with no
//!   `text` after them are a text that was cut short.
//! - A **tool call** runs from its `toolStart` until the `toolEnd` of its id: completed, or failed
//!   when `isError`. It lasted the time between the two. One without an end was cut short.
//! - A **thought** lasted the time since the `activity` of kind `thinking` before it, when it has
//!   no `parent`: a sub-agent's thought has no start, and lasted nothing.
//! - A **blocked action** is a `denial`, which waits to be allowed until an `allowed` names its
//!   place in the log.
//! - A `notice` is a line of the transcript: the agent's, or the runner's own, as the line of a
//!   new agent session.

use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};

/// One event of a turn.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(
    tag = "type",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum Event {
    /// The agent's session, at the start of each turn. `problem` says why the process must not
    /// run, as a skill that did not load.
    Init {
        session_id: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        problem: Option<String>,
    },
    /// The model and the effort the agent runs on, by its names for people.
    RunsOn {
        model: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        effort: Option<String>,
    },
    /// A line for the transcript: the agent's, as a reviewer's verdict, or the runner's.
    Notice { text: String },
    /// A piece of the text being written.
    TextDelta { text: String },
    /// A text, whole: it ends the pieces before it, which it repeats.
    Text { text: String },
    /// What the agent writes that shows nothing yet: its thinking, or a tool call whose input
    /// streams.
    Activity { activity: Activity },
    /// A thinking block, whole: its text only when the agent gave one.
    Thought {
        /// The tool call of the sub-agent that thought it.
        #[serde(default, skip_serializing_if = "Option::is_none")]
        parent: Option<String>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        text: Option<String>,
    },
    /// A tool call starts.
    ToolStart {
        id: String,
        /// What the agent gave the tool: empty for a call the earlier store kept without it.
        #[serde(default)]
        input: Map<String, Value>,
        kind: ToolKind,
        /// `Bash`, `Read`, ...
        name: String,
        /// The tool call of the sub-agent that runs it.
        #[serde(default, skip_serializing_if = "Option::is_none")]
        parent: Option<String>,
        /// Set when the tool starts a sub-agent.
        #[serde(default, skip_serializing_if = "Option::is_none")]
        subagent: Option<Subagent>,
        /// The command, the path relative to the session's directory, the URL, or the pattern.
        #[serde(default, skip_serializing_if = "Option::is_none")]
        target: Option<String>,
    },
    /// A tool call ends, with its result's text.
    ToolEnd {
        id: String,
        is_error: bool,
        output: String,
    },
    /// The agent read the message of this id.
    Accepted { id: String },
    /// The message of this id was taken back before the agent read it.
    Cancelled { id: String },
    /// The agent's API failed, and it tries again after a delay.
    Retry {
        attempt: u32,
        delay_ms: u64,
        error: String,
    },
    /// A usage report of the account: the windows it gives, at least one.
    Usage { windows: Vec<UsageWindow> },
    /// The agent's background tasks still running, after one started or ended.
    Background { tasks: Vec<BackgroundTask> },
    /// A usage limit refused the agent's turn.
    Limit { limit: Limit },
    /// The agent set a one-shot wakeup for that instant, in ISO 8601.
    Wakeup { at: String },
    /// The agent session's running total, its sub-agents included.
    Tokens { total: TokenCounts },
    /// The agent ended its reply.
    Result {
        /// The session's cost as the agent reports it, in dollars.
        #[serde(default, skip_serializing_if = "Option::is_none")]
        cost_usd: Option<f64>,
        denials: Vec<Denial>,
        errors: Vec<String>,
        /// Ended by an interrupt: a stop, not an error.
        interrupted: bool,
        /// The models that answered, as the agent names them.
        #[serde(default, skip_serializing_if = "Option::is_none")]
        models: Option<Vec<String>>,
        ok: bool,
    },
    /// A line the runtime does not read: not JSON, or of an unknown type.
    Skipped,
    /// The process ended. `missing` when its command could not be found.
    Exit {
        code: Option<i32>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        missing: Option<bool>,
        stderr: String,
    },
    /// The runner's: a message sent to the agent, the human's or the workflow's. It is pending
    /// until an `accepted` or a `cancelled` of its id.
    Message {
        id: String,
        origin: Origin,
        text: String,
        /// The chat's opening line, shown above the human's text.
        #[serde(default, skip_serializing_if = "Option::is_none")]
        opening: Option<String>,
        /// The chat images sent with it.
        #[serde(default, skip_serializing_if = "Vec::is_empty")]
        images: Vec<ChatImage>,
    },
    /// The runner's: an action the agent's permissions blocked, as the transcript shows it.
    /// Without a rule, when none allows that action alone, it cannot be allowed.
    Denial {
        tool: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        target: Option<String>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        rule: Option<String>,
    },
    /// The runner's: the human allowed the blocked action logged at `denial`, a place of this
    /// turn's log.
    Allowed { denial: u64 },
}

impl Event {
    /// Reads an event from its JSON text.
    ///
    /// Read an event this way, or with `serde_json::from_value`, never with
    /// `serde_json::from_str`: this workspace builds serde_json with `arbitrary_precision`,
    /// which NSH's bundler turns on, and a number with a fraction, as a usage window's `used`,
    /// then fails to read from a text into an enum that names its kind in a field.
    ///
    /// # Errors
    ///
    /// When the text is not JSON, or not an event.
    pub fn parse(json: &str) -> serde_json::Result<Event> {
        serde_json::from_value(serde_json::from_str(json)?)
    }
}

/// What the main agent writes before anything of it shows.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum Activity {
    Thinking,
    Tool {
        name: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        target: Option<String>,
    },
}

/// What a tool call does, in the Agent Client Protocol's words.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ToolKind {
    Read,
    Edit,
    Delete,
    Move,
    Search,
    Execute,
    Think,
    Fetch,
    Other,
}

/// The sub-agent a tool call starts.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Subagent {
    pub description: String,
}

/// One usage window a runtime reports, like five hours or a week: the share `used` from 0 to 1,
/// and its reset time in ISO 8601.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UsageWindow {
    pub id: String,
    pub label: String,
    pub resets_at: String,
    pub used: f64,
}

/// A background task of the agent's run, by the tool call that started it.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct BackgroundTask {
    pub kind: BackgroundKind,
    pub tool: String,
}

/// What runs in the background: a sub-agent or a workflow, or a command.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum BackgroundKind {
    Subagent,
    Command,
}

/// A usage limit that refused the agent's turn, in the agent's own words.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Limit {
    pub kind: LimitKind,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub resets_at: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub text: Option<String>,
}

/// `session` is the limit of a few hours that resets by itself; `other` is any other.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum LimitKind {
    Session,
    Other,
}

/// Tokens the model read and wrote. `input` was read for the first time, `cache_write` read and
/// written to the cache, `cache_read` read back from it.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TokenCounts {
    pub cache_read: u64,
    pub cache_write: u64,
    pub input: u64,
    pub output: u64,
}

/// An action the agent's permissions blocked, as a result reports it.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct Denial {
    pub input: Map<String, Value>,
    pub tool: String,
}

/// Who sent a message to the agent.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Origin {
    Human,
    Workflow,
}

/// A chat image: its file's name in the data folder's `images/`, and its size in pixels.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct ChatImage {
    pub height: u32,
    pub id: String,
    pub width: u32,
}
