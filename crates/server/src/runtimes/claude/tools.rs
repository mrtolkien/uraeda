//! A tool call of Claude Code's, as the transcript names it: what it does, and what it acts on.

use serde_json::Value;

use super::json::Object;
use crate::runner::ToolKind;

/// The tools that start a sub-agent: `Task` in Claude Code 2.1.296, `Agent` in others.
pub(super) const SUBAGENT_TOOLS: [&str; 2] = ["Task", "Agent"];

/// What a Claude Code tool does, in the Agent Client Protocol's words.
pub(super) fn kind(name: &str) -> ToolKind {
    match name {
        "Bash" | "BashOutput" | "KillShell" => ToolKind::Execute,
        "Edit" | "MultiEdit" | "NotebookEdit" | "Write" => ToolKind::Edit,
        "Glob" | "Grep" | "LS" => ToolKind::Search,
        "Read" => ToolKind::Read,
        "WebFetch" | "WebSearch" => ToolKind::Fetch,
        _ => ToolKind::Other,
    }
}

/// The fields of a tool's input that say what it acts on, the first one given winning.
const TARGETS: [&str; 5] = ["command", "file_path", "url", "pattern", "path"];

/// Those that are a file's path.
const PATHS: [&str; 2] = ["file_path", "path"];

/// What a tool call acts on, for its log line: its command, file, URL, or pattern. A file under
/// `cwd`, the session's directory, is relative to it.
pub(super) fn target(input: &Object, cwd: &str) -> Option<String> {
    let (key, value) = TARGETS
        .iter()
        .find_map(|key| Some((key, input.get(*key)?.as_str()?)))?;
    let path = PATHS.contains(key) && value.starts_with('/') && cwd.starts_with('/');
    let inside = path
        .then(|| relative(cwd, value))
        .filter(|path| is_inside(path));
    Some(inside.unwrap_or_else(|| value.to_owned()))
}

/// The target of a tool call whose input is still being written, once it holds a file's path.
pub(super) fn file_target(path: &str, cwd: &str) -> Option<String> {
    let mut input = Object::new();
    input.insert("file_path".to_owned(), Value::String(path.to_owned()));
    target(&input, cwd)
}

/// Whether a relative path stays in the folder it is relative to, and is not the folder itself.
fn is_inside(path: &str) -> bool {
    !path.is_empty() && path != ".." && !path.starts_with("../")
}

/// The path from one absolute path to another, by their names alone: `.` and `..` are resolved,
/// and no link is followed.
fn relative(from: &str, to: &str) -> String {
    let (from, to) = (parts(from), parts(to));
    let shared = from.iter().zip(&to).take_while(|(a, b)| a == b).count();
    let up = std::iter::repeat_n("..", from.len() - shared);
    let path: Vec<&str> = up.chain(to[shared..].iter().copied()).collect();
    path.join("/")
}

/// The names of an absolute path, from the root.
fn parts(path: &str) -> Vec<&str> {
    let mut parts = Vec::new();
    for part in path.split('/') {
        match part {
            "" | "." => {}
            ".." => {
                parts.pop();
            }
            name => parts.push(name),
        }
    }
    parts
}
