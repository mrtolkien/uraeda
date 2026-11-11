//! What the main agent writes before it shows: its text in pieces, a thinking block, and a tool
//! call, named again once its input holds a file's path.

use std::collections::HashMap;
use std::sync::LazyLock;

use regex::Regex;
use serde_json::Value;

use super::json::{self, nested, number, string, words};
use super::tools;
use crate::runner::{Activity, Event};

/// The main agent's tool calls being written, by their block's index.
pub(super) type Blocks = HashMap<u64, Block>;

/// A tool call being written: its name, and its input so far, until it gave its target.
pub(super) struct Block {
    name: String,
    input: String,
    target: Option<String>,
}

/// A file path, whole, in a tool call's input still being written.
static FILE_PATH: LazyLock<Regex> = LazyLock::new(|| {
    let pattern = r#""file_path"[\s\x{FEFF}]*:[\s\x{FEFF}]*("(?:[^"\\]|\\.)*")"#;
    Regex::new(pattern).expect("a pattern")
});

/// An activity, as the one event it makes.
fn activity(activity: Activity) -> Vec<Event> {
    vec![Event::Activity { activity }]
}

/// The main agent's text deltas, from `--include-partial-messages`, and what it writes that
/// shows nothing yet: a thinking block, or a tool call, named again once its input holds a file
/// path. Thinking deltas say nothing new.
pub(super) fn events(event: &Value, blocks: &mut Blocks, cwd: &str) -> Vec<Event> {
    let Some(index) = number(event, "index") else {
        return Vec::new();
    };
    // A block is found by its number, however it is written: 1 is 1.0.
    let index = (index + 0.0).to_bits();
    match string(event, "type") {
        Some("content_block_start") => started(nested(event, "content_block"), index, blocks),
        Some("content_block_stop") => {
            blocks.remove(&index);
            Vec::new()
        }
        Some("content_block_delta") => written(nested(event, "delta"), index, blocks, cwd),
        _ => Vec::new(),
    }
}

/// A block starts: a thinking block, or a tool call, which is kept until it stops.
fn started(block: &Value, index: u64, blocks: &mut Blocks) -> Vec<Event> {
    match (string(block, "type"), string(block, "name")) {
        (Some("thinking" | "redacted_thinking"), _) => activity(Activity::Thinking),
        (Some("tool_use"), Some(name)) => {
            let block = Block {
                name: name.to_owned(),
                input: String::new(),
                target: None,
            };
            blocks.insert(index, block);
            activity(Activity::Tool {
                name: name.to_owned(),
                target: None,
            })
        }
        _ => Vec::new(),
    }
}

/// A piece of a block: of the text, or of a tool call's input.
fn written(delta: &Value, index: u64, blocks: &mut Blocks, cwd: &str) -> Vec<Event> {
    if let (Some("text_delta"), Some(text)) = (string(delta, "type"), words(delta, "text")) {
        let text = text.to_owned();
        return vec![Event::TextDelta { text }];
    }
    let piece = string(delta, "partial_json").filter(|_| is_input(delta));
    let (Some(piece), Some(tool)) = (piece, blocks.get_mut(&index)) else {
        return Vec::new();
    };
    if tool.target.is_some() {
        return Vec::new();
    }
    tool.input.push_str(piece);
    let Some(target) = path_in(&tool.input).and_then(|path| tools::file_target(&path, cwd)) else {
        return Vec::new();
    };
    tool.target = Some(target.clone());
    tool.input.clear();
    activity(Activity::Tool {
        name: tool.name.clone(),
        target: Some(target),
    })
}

fn is_input(delta: &Value) -> bool {
    string(delta, "type") == Some("input_json_delta")
}

/// The file path an input being written holds whole, if it holds one yet.
fn path_in(input: &str) -> Option<String> {
    let written = FILE_PATH.captures(input)?.get(1)?.as_str();
    json::read(written)?.as_str().map(str::to_owned)
}
