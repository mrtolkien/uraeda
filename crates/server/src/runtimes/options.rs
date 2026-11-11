//! What crosses the runtime contract besides events: how a process opens, a message sent to it,
//! a review asked of it, and why a runtime could not answer. Each is written as JSON the way
//! the adapter of `uraeda/server` names it, for a runtime that lives in an extension's VM.

use std::fmt;
use std::path::PathBuf;
use std::time::Duration;

use serde::ser::SerializeStruct as _;
use serde::{Deserialize, Serialize, Serializer};

/// The name of Uraeda's MCP server, as the agents name its tools: `mcp__uraeda__run_agent`.
pub const TOOLS_SERVER: &str = "uraeda";

/// The environment variable that holds a process's token for Uraeda's tools: in the
/// environment, unlike the arguments, no other user of the machine reads it.
pub const TOKEN_VARIABLE: &str = "URAEDA_MCP_TOKEN";

/// The longest a call of Uraeda's tools may take before the agent gives it up.
pub const TOOL_TIMEOUT: Duration = Duration::from_secs(2 * 60 * 60);

/// How to open a session's process.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Options {
    /// The feature's worktree, or the main checkout.
    pub cwd: PathBuf,
    /// The agent's own session id. An agent that picks its own, when not resuming, reports it
    /// in its first `init`, which the session adopts.
    pub native_id: String,
    /// Resume `native_id`, or start a new session with it.
    pub resume: bool,
    /// The model to run on, by the agent's id: none for the agent's default.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    /// The effort to run on, by the agent's id: none for the agent's default.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub effort: Option<String>,
    /// The allow rules for this process only, from "Allow and retry" or "Allow all".
    pub allowed: Vec<String>,
    /// The skill folders to give the agent, beside Uraeda's own.
    pub skills: Vec<PathBuf>,
    /// Whose sub-agents the process gets.
    #[serde(skip_serializing_if = "Tools::are_own")]
    pub tools: Tools,
}

/// The sub-agents a process gets: a workflow's are sessions Uraeda starts, never the agent's
/// own, as the run options decision asks.
#[derive(Clone, Default, PartialEq, Eq)]
pub enum Tools {
    /// A chat: the agent keeps its own sub-agents, and gets none of Uraeda's tools.
    #[default]
    Own,
    /// A workflow session: Uraeda's MCP endpoint, `<server>/mcp`, and the token of this process
    /// there, given in place of the agent's own sub-agents. The token goes to the agent in its
    /// environment, as [`TOKEN_VARIABLE`], never in its arguments.
    Uraeda { url: String, token: String },
    /// A sub-session: neither the agent's own sub-agents nor Uraeda's tools.
    None,
}

impl Tools {
    /// Whether the agent keeps its own sub-agents: the adapter's `tools` left out.
    pub fn are_own(&self) -> bool {
        *self == Tools::Own
    }

    /// The variables a process gets besides the server's environment: its token, when it gets
    /// Uraeda's tools.
    pub fn env(&self) -> Vec<(String, String)> {
        match self {
            Tools::Uraeda { token, .. } => vec![(TOKEN_VARIABLE.to_owned(), token.clone())],
            Tools::Own | Tools::None => Vec::new(),
        }
    }
}

/// Without the token: what is printed reaches a log.
impl fmt::Debug for Tools {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Tools::Own => formatter.write_str("Own"),
            Tools::Uraeda { url, .. } => write!(formatter, "Uraeda {{ url: {url:?}, token: .. }}"),
            Tools::None => formatter.write_str("None"),
        }
    }
}

/// As the adapter's `tools`: `{ url, token }`, or `"none"`.
impl Serialize for Tools {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        match self {
            Tools::Own => serializer.serialize_none(),
            Tools::Uraeda { url, token } => {
                let mut tools = serializer.serialize_struct("Tools", 2)?;
                tools.serialize_field("url", url)?;
                tools.serialize_field("token", token)?;
                tools.end()
            }
            Tools::None => serializer.serialize_str("none"),
        }
    }
}

/// A message sent to an agent, with the paths of its chat images, which the runtime writes to
/// its agent in the agent's own way.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Outgoing {
    /// The message's id, which its `accepted` or `cancelled` names.
    pub id: String,
    pub text: String,
    pub images: Vec<SentImage>,
    pub when: When,
    /// The text is the instructions of a review the agent runs as its own: set from a
    /// [`ReviewMessage`] only.
    #[serde(skip_serializing_if = "std::ops::Not::not")]
    pub review: bool,
}

/// A chat image of a message, by its file.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct SentImage {
    pub path: PathBuf,
}

/// When the agent reads a message sent during a turn.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum When {
    /// It joins the running turn.
    Steer,
    /// It waits for the next one.
    Queue,
}

/// A review an agent runs: the commits `<base>..<head>`, at the reviewer's effort, else its
/// model's default, with instructions added to the agent's own review prompt.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReviewAsk {
    pub base: String,
    pub head: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub effort: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub instructions: Option<String>,
}

/// The message that runs a review in the agent's own way: its text, and whether the runtime
/// reads it as a review's instructions, [`Outgoing::review`].
#[derive(Clone, Debug, Default, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReviewMessage {
    pub text: String,
    #[serde(default)]
    pub review: bool,
}

/// Why the runtimes could not do what was asked.
#[derive(Clone, Debug, PartialEq, Eq, thiserror::Error)]
pub enum RuntimeError {
    /// A runtime is registered under that name already.
    #[error("a runtime is registered as {0} already")]
    Taken(String),
    /// A runtime could not answer, in its own words: its agent is gone, too slow, or said no.
    #[error("{0}")]
    Failed(String),
}
