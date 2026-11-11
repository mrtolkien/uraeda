//! The events of Claude Code's stream-json output, one line at a time.

use std::collections::HashMap;
use std::time::SystemTime;

use jiff::tz::TimeZone;
use serde_json::Value;

use super::json::{self, Object, is_true, listed, nested, objects, string, text};
use super::time::{Clock, millis};
use super::tools::{self, SUBAGENT_TOOLS};
use super::{limits, results, stream, system, wakeups};
use crate::runner::{Event, Subagent};

/// The line types Claude Code prints in stream-json output. Those the runtime has no use for,
/// like hooks, give no event, nor do the answers to its control requests, which `control.rs`
/// reads; any other type is skipped and counted.
const KNOWN_TYPES: [&str; 13] = [
    "assistant",
    "auth_status",
    "command_lifecycle",
    "control_response",
    "conversation_reset",
    "prompt_suggestion",
    "rate_limit_event",
    "result",
    "stream_event",
    "system",
    "tool_progress",
    "tool_use_summary",
    "user",
];

/// What reads one process's lines: the session's directory, which makes the tools' targets
/// under it relative, the server's zone, and what the lines before left to the next ones.
pub(super) struct Parser {
    cwd: String,
    zone: TimeZone,
    /// The process's background tasks, by the tool calls that started them.
    pub(super) tasks: HashMap<String, String>,
    /// The main agent's tool calls being written.
    pub(super) blocks: stream::Blocks,
}

impl Parser {
    /// A parser of the lines of a process that runs in `cwd`, on a server in `zone`.
    pub(super) fn new(cwd: String, zone: TimeZone) -> Parser {
        Parser {
            cwd,
            zone,
            tasks: HashMap::new(),
            blocks: stream::Blocks::new(),
        }
    }

    /// The events of one line, read at `now`.
    pub(super) fn line(&mut self, line: &str, now: SystemTime) -> Vec<Event> {
        let message = json::read(line).unwrap_or_default();
        let Some(kind) = string(&message, "type").filter(|kind| KNOWN_TYPES.contains(kind)) else {
            return vec![Event::Skipped];
        };
        // A sub-agent's lines carry the tool call that started it; the main agent's carry null.
        let parent = string(&message, "parent_tool_use_id");
        let clock = Clock {
            now: millis(now),
            zone: self.zone.clone(),
        };
        match kind {
            "system" => system::events(&message, &mut self.tasks),
            "stream_event" if parent.is_none() => {
                let event = nested(&message, "event");
                stream::events(event, &mut self.blocks, &self.cwd)
            }
            "command_lifecycle" => lifecycle(&message).into_iter().collect(),
            "assistant" => self.assistant(&message, parent, &clock),
            "user" => tool_ends(&message),
            "result" => results::events(&message, line),
            "rate_limit_event" => {
                let info = nested(&message, "rate_limit_info");
                let limit = limits::of_info(info, None).map(|limit| Event::Limit { limit });
                limits::usage(info).into_iter().chain(limit).collect()
            }
            _ => Vec::new(),
        }
    }

    /// An assistant message's blocks: its text, tool calls, and thinking. The main agent's
    /// message also says when a usage limit refused its turn, and its tool calls when it set a
    /// wakeup.
    fn assistant(&self, message: &Value, parent: Option<&str>, clock: &Clock) -> Vec<Event> {
        let content = objects(nested(message, "message"), "content");
        let mut events = Vec::new();
        for block in &content {
            match string(block, "type") {
                // A sub-agent's text is not the main agent's: only its tools are shown.
                Some("text") if !text(block, "text").is_empty() => {
                    let text = text(block, "text").to_owned();
                    events.extend(parent.is_none().then_some(Event::Text { text }));
                }
                Some("tool_use") => {
                    let Some(id) = string(block, "id") else {
                        continue;
                    };
                    let input = json::object(block, "input").cloned().unwrap_or_default();
                    let name = text(block, "name");
                    // A sub-agent's wakeup does not keep the main agent's process open.
                    let wakeup = parent
                        .is_none()
                        .then(|| wakeups::of_tool(name, &input, clock));
                    events.push(self.tool_start(id, name, input, parent));
                    events.extend(wakeup.flatten());
                }
                // A thinking block comes whole once it ends, its text empty unless the agent
                // shows it.
                Some("thinking" | "redacted_thinking") => events.push(Event::Thought {
                    parent: parent.map(str::to_owned),
                    text: json::words(block, "thinking").map(str::to_owned),
                }),
                _ => {}
            }
        }
        if parent.is_none() {
            let texts = content
                .iter()
                .filter(|block| string(block, "type") == Some("text"));
            let said: Vec<&str> = texts.map(|block| text(block, "text")).collect();
            events.extend(limits::of_message(message, &said.join("\n"), clock));
        }
        events
    }

    fn tool_start(&self, id: &str, name: &str, input: Object, parent: Option<&str>) -> Event {
        let subagent = SUBAGENT_TOOLS.contains(&name).then(|| Subagent {
            description: text(&Value::Object(input.clone()), "description").to_owned(),
        });
        Event::ToolStart {
            id: id.to_owned(),
            kind: tools::kind(name),
            name: name.to_owned(),
            parent: parent.map(str::to_owned),
            subagent,
            target: tools::target(&input, &self.cwd),
            input,
        }
    }
}

/// A message the agent read, or one taken back. Queued and completed say nothing new.
fn lifecycle(message: &Value) -> Option<Event> {
    let id = string(message, "command_uuid")?.to_owned();
    match string(message, "state")? {
        "started" => Some(Event::Accepted { id }),
        "cancelled" => Some(Event::Cancelled { id }),
        _ => None,
    }
}

/// The tool calls a user message ends, each with its result's text.
fn tool_ends(message: &Value) -> Vec<Event> {
    let blocks = objects(nested(message, "message"), "content").into_iter();
    let ended = blocks.filter(|block| string(block, "type") == Some("tool_result"));
    let ends = ended.filter_map(|block| {
        Some(Event::ToolEnd {
            id: string(block, "tool_use_id")?.to_owned(),
            is_error: is_true(block, "is_error"),
            output: tool_output(json::field(block, "content")),
        })
    });
    ends.collect()
}

/// A tool result's content: a string, or text blocks.
fn tool_output(content: Option<&Value>) -> String {
    let Some(content) = content else {
        return String::new();
    };
    if let Some(text) = content.as_str() {
        return text.to_owned();
    }
    let blocks = listed(content).into_iter();
    let texts = blocks.filter(|block| string(block, "type") == Some("text"));
    let texts: Vec<&str> = texts.map(|block| text(block, "text")).collect();
    texts.join("\n")
}
