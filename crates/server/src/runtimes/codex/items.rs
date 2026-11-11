//! Codex's thread items as the transcript shows them: the tool call an item is, how it ended,
//! its reviewer's verdict, and the thread's tokens. The field names follow the protocol's
//! generated types, `ThreadItem` (Codex 0.163.0).

use std::sync::LazyLock;

use regex::Regex;
use serde_json::{Value, json};

use super::super::built_in::{file_target, tool_target};
use super::json::{Object, filled, number, object, objects, text};
use crate::runner::{Event, Subagent, TokenCounts, ToolKind};

/// A shell's command line, `bash -lc '…'`, as Codex runs each command.
static SHELL: LazyLock<Regex> =
    LazyLock::new(|| pattern(r"(?s)^(?:\S*/)?(?:bash|zsh|sh) -lc (.+)$"));
static SINGLE: LazyLock<Regex> = LazyLock::new(|| pattern(r"(?s)^'((?:[^']|'\\'')*)'$"));
static DOUBLE: LazyLock<Regex> = LazyLock::new(|| pattern(r#"(?s)^"((?:[^"\\]|\\.)*)"$"#));
static ESCAPED: LazyLock<Regex> = LazyLock::new(|| pattern(r#"\\([\\"$`])"#));

fn pattern(pattern: &str) -> Regex {
    Regex::new(pattern).expect("a pattern written here")
}

/// The command a shell runs, its quotes undone: Codex reports `/usr/bin/bash -lc "git commit"`,
/// shown as `git commit`. Any other command line is kept whole.
pub(super) fn shell_command(command: &str) -> String {
    let Some(argument) = SHELL.captures(command).and_then(|found| found.get(1)) else {
        return command.to_owned();
    };
    let argument = argument.as_str();
    if let Some(single) = SINGLE.captures(argument).and_then(|found| found.get(1)) {
        return single.as_str().replace(r"'\''", "'");
    }
    let double = DOUBLE.captures(argument).and_then(|found| found.get(1));
    double.map_or_else(
        || command.to_owned(),
        |double| ESCAPED.replace_all(double.as_str(), "$1").into_owned(),
    )
}

/// A tool call's start: the fields of `toolStart` an item gives.
pub(super) struct Tool {
    pub input: Object,
    pub kind: ToolKind,
    pub name: String,
    pub subagent: Option<Subagent>,
    pub target: Option<String>,
}

impl Tool {
    fn new(name: &str, kind: ToolKind, input: Value, target: Option<String>) -> Tool {
        Tool {
            input: input.as_object().cloned().unwrap_or_default(),
            kind,
            name: name.to_owned(),
            subagent: None,
            target: target.filter(|target| !target.is_empty()),
        }
    }
}

/// A file change's paths, relative to the session's directory when under it.
fn changed_paths(changes: &[&Value], cwd: &str) -> Option<String> {
    let paths = changes.iter().filter_map(|change| {
        let path = file_target(text(change, "path"), cwd);
        (!path.is_empty()).then_some(path)
    });
    let paths: Vec<String> = paths.collect();
    (!paths.is_empty()).then(|| paths.join(", "))
}

/// The files of a file change, each with its kind when it has one.
fn changed_files(changes: &[&Value]) -> Vec<Value> {
    let files = changes.iter().map(|change| {
        let mut file = Object::new();
        if let Some(kind) = change.get("kind") {
            file.insert("kind".to_owned(), kind.clone());
        }
        file.insert("path".to_owned(), json!(text(change, "path")));
        Value::Object(file)
    });
    files.collect()
}

/// The tool call an item is, Codex's item types under the names the transcript shows: none for
/// an item that is no tool call.
pub(super) fn tool_of(item: &Value, cwd: &str) -> Option<Tool> {
    match text(item, "type") {
        "commandExecution" => {
            let command = text(item, "command");
            let input = json!({ "command": command, "cwd": text(item, "cwd") });
            let target = Some(shell_command(command));
            Some(Tool::new("Shell", ToolKind::Execute, input, target))
        }
        "fileChange" => {
            let changes = objects(item, "changes");
            let input = json!({ "changes": changed_files(&changes) });
            let target = changed_paths(&changes, cwd);
            Some(Tool::new("Edit", ToolKind::Edit, input, target))
        }
        kind @ ("mcpToolCall" | "dynamicToolCall") => {
            let input = object(item, "arguments").cloned().unwrap_or(json!({}));
            let name = if kind == "mcpToolCall" {
                format!("mcp__{}__{}", text(item, "server"), text(item, "tool"))
            } else {
                text(item, "tool").to_owned()
            };
            let target = input
                .as_object()
                .and_then(|input| tool_target(&name, input, cwd));
            Some(Tool::new(&name, ToolKind::Other, input, target))
        }
        "webSearch" => {
            let none = Value::Null;
            let action = object(item, "action").unwrap_or(&none);
            let query = filled(item, "query")
                .or_else(|| filled(action, "query"))
                .unwrap_or_else(|| text(action, "url"));
            let input = json!({ "query": query });
            Some(Tool::new(
                "WebSearch",
                ToolKind::Fetch,
                input,
                Some(query.to_owned()),
            ))
        }
        "collabAgentToolCall" => Some(collab(item)),
        _ => None,
    }
}

/// A call of Codex's own sub-agents: a spawned agent's prompt says what it does.
fn collab(item: &Value) -> Tool {
    let mut input = Object::new();
    for key in ["model", "prompt"] {
        if let Some(value) = item.get(key) {
            input.insert(key.to_owned(), value.clone());
        }
    }
    let name = text(item, "tool");
    let mut tool = Tool::new(name, ToolKind::Other, Value::Object(input), None);
    tool.subagent = (name == "spawnAgent").then(|| Subagent {
        description: text(item, "prompt").to_owned(),
    });
    tool
}

/// The text of a tool result's content blocks.
fn text_blocks(value: &Value, key: &str) -> String {
    let blocks = objects(value, key).into_iter();
    let texts = blocks.filter_map(|block| block.get("text")?.as_str());
    texts.collect::<Vec<_>>().join("\n")
}

/// A completed tool item's end: whether it failed, and its output.
pub(super) fn end_of(item: &Value) -> (bool, String) {
    let failed = text(item, "status") != "completed";
    match text(item, "type") {
        "commandExecution" => {
            let code = number(item, "exitCode").unwrap_or(0.0);
            let output = text(item, "aggregatedOutput").to_owned();
            (failed || code != 0.0, output)
        }
        "fileChange" => {
            let changes = objects(item, "changes");
            let diffs: Vec<&str> = changes.iter().map(|change| text(change, "diff")).collect();
            (failed, diffs.join("\n"))
        }
        "mcpToolCall" => {
            let error = object(item, "error").map_or("", |error| text(error, "message"));
            if !error.is_empty() {
                return (failed, error.to_owned());
            }
            let none = Value::Null;
            let result = object(item, "result").unwrap_or(&none);
            (failed, text_blocks(result, "content"))
        }
        "dynamicToolCall" => {
            let refused = item.get("success") == Some(&Value::Bool(false));
            (refused || failed, text_blocks(item, "contentItems"))
        }
        "collabAgentToolCall" => {
            let states = object(item, "agentsStates").and_then(Value::as_object);
            let states = states.into_iter().flat_map(|states| states.values());
            let said: Vec<&str> = states
                .filter_map(|state| filled(state, "message"))
                .collect();
            (text(item, "status") == "failed", said.join("\n"))
        }
        _ => (false, String::new()),
    }
}

/// Codex's automatic review of an escalated action, as a line for the transcript, once it
/// ends: a decision carries its risk, a review that ended without one does not.
pub(super) fn review_notice(review: Option<&Value>) -> Option<Event> {
    let review = review.filter(|review| review.is_object())?;
    let (said, risky) = match text(review, "status") {
        "aborted" => ("aborted", false),
        "approved" => ("approved", true),
        "denied" => ("denied", true),
        "timedOut" => ("timed out", false),
        _ => return None,
    };
    let risk = filled(review, "riskLevel").or(risky.then_some("unknown"));
    let risk = risk
        .map(|risk| format!(" (risk: {risk})"))
        .unwrap_or_default();
    let verdict = format!("Automatic review {said}{risk}");
    let text = match filled(review, "rationale") {
        Some(rationale) => format!("{verdict}: {rationale}"),
        None => verdict,
    };
    Some(Event::Notice { text })
}

/// The thread's running total: input read for the first time, less what the cache gave back,
/// as Claude Code counts it. None for an all-zero total, which would read as a new agent
/// session.
pub(super) fn tokens_of(total: Option<&Value>) -> Option<Event> {
    let total = total.filter(|total| total.is_object())?;
    let count = |key: &str| {
        let count = number(total, key).filter(|count| count.is_finite());
        count.unwrap_or(0.0).max(0.0)
    };
    #[allow(
        clippy::cast_possible_truncation,
        clippy::cast_sign_loss,
        reason = "a count of tokens, never below zero"
    )]
    let whole = |count: f64| count as u64;
    let counts = TokenCounts {
        cache_read: whole(count("cachedInputTokens")),
        cache_write: whole(count("cacheWriteInputTokens")),
        input: whole((count("inputTokens") - count("cachedInputTokens")).max(0.0)),
        output: whole(count("outputTokens")),
    };
    let any = counts.cache_read + counts.cache_write + counts.input + counts.output > 0;
    any.then_some(Event::Tokens { total: counts })
}
