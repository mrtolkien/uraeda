//! What a tool call acts on, for its line of the transcript: as `toolTarget` of the Node
//! server.

use std::path::{Component, Path, PathBuf};

use serde_json::{Map, Value};

/// The fields of a tool's input that say what it acts on, the first one found.
const TARGETS: [&str; 5] = ["command", "file_path", "url", "pattern", "path"];

/// Those of them that are a file's path.
const PATHS: [&str; 2] = ["file_path", "path"];

/// What a tool call acts on: its command, file, URL, or pattern, and for Uraeda's own
/// `run_agent`, the task its implementer builds, which names its sub-session. A file under
/// `cwd`, the session's directory, is relative to it.
pub(crate) fn tool_target(name: &str, input: &Map<String, Value>, cwd: &str) -> Option<String> {
    if name.ends_with("__run_agent")
        && let Some(task) = input.get("task").and_then(Value::as_str)
    {
        return Some(task.to_owned());
    }
    let (key, value) = TARGETS.iter().find_map(|key| {
        let value = input.get(*key)?.as_str()?;
        Some((*key, value))
    })?;
    if PATHS.contains(&key) {
        return Some(file_target(value, cwd));
    }
    Some(value.to_owned())
}

/// A file a tool call acts on: relative to `cwd`, the session's directory, when under it.
pub(in crate::runtimes) fn file_target(path: &str, cwd: &str) -> String {
    let inside = (!cwd.is_empty() && path.starts_with('/'))
        .then(|| inside(Path::new(cwd), Path::new(path)))
        .flatten();
    inside.unwrap_or_else(|| path.to_owned())
}

/// A path as it reads from a folder that holds it: none for the folder itself, or a path
/// outside it.
fn inside(folder: &Path, path: &Path) -> Option<String> {
    let (folder, path) = (plain(folder), plain(path));
    let rest = path.strip_prefix(&folder).ok()?;
    let rest = rest.to_string_lossy();
    (!rest.is_empty()).then(|| rest.into_owned())
}

/// A path without its `.` and `..`, read as text: no link is followed.
fn plain(path: &Path) -> PathBuf {
    let mut plain = PathBuf::new();
    for part in path.components() {
        match part {
            Component::CurDir => {}
            Component::ParentDir => {
                plain.pop();
            }
            part => plain.push(part),
        }
    }
    plain
}
