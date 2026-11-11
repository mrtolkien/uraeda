//! What a tool call acts on, for its line of the transcript, and the names for people of what
//! agents share: as `toolTarget` and `effortName` of the Node server.

use std::path::{Component, Path, PathBuf};

use serde_json::Value;

/// The fields of a tool's input that say what it acts on, the first one found.
const TARGETS: [&str; 5] = ["command", "file_path", "url", "pattern", "path"];

/// Those of them that are paths.
const PATHS: [&str; 2] = ["file_path", "path"];

/// What a tool call acts on: its command, file, URL, or pattern. A file under `cwd`, the
/// session's directory, is relative to it.
pub(super) fn tool_target(input: &Value, cwd: &str) -> Option<String> {
    let (key, value) = TARGETS.iter().find_map(|key| {
        let value = input.get(key)?.as_str()?;
        Some((*key, value))
    })?;
    let inside = (PATHS.contains(&key) && !cwd.is_empty() && value.starts_with('/'))
        .then(|| inside(Path::new(cwd), Path::new(value)))
        .flatten();
    Some(inside.unwrap_or_else(|| value.to_owned()))
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

/// An effort's name for people: "Extra high" for `xhigh`, any other id as given.
pub(super) fn effort_name(id: &str) -> &str {
    match id {
        "high" => "High",
        "low" => "Low",
        "max" => "Max",
        "medium" => "Medium",
        "ultra" => "Ultra",
        "xhigh" => "Extra high",
        other => other,
    }
}
