//! A path read as text, without the file system: the one home of `.` and `..` taken out of a
//! path, which an extension's imports, an agent's folders, and a preview's modules all need.

use std::path::{Component, Path, PathBuf};

/// A path without its `.` and `..` parts, as written: no link is followed. Above the root
/// there is nothing, and a relative path keeps its leading `..`.
pub(crate) fn normal(path: &Path) -> PathBuf {
    let mut normal = PathBuf::new();
    for part in path.components() {
        match part {
            Component::CurDir => {}
            Component::ParentDir => {
                let last = normal.components().next_back();
                match last {
                    Some(Component::Normal(_)) => drop(normal.pop()),
                    Some(Component::RootDir) => {}
                    _ => normal.push(".."),
                }
            }
            other => normal.push(other),
        }
    }
    normal
}

/// The parts of a path of an address, split at `/`, without its empty and `.` parts, each `..`
/// taking the part before it: `/a/./b/../c` is `["a", "c"]`.
pub(crate) fn address_parts(path: &str) -> Vec<&str> {
    let mut parts: Vec<&str> = Vec::new();
    for part in path.split('/') {
        match part {
            "" | "." => {}
            ".." => drop(parts.pop()),
            part => parts.push(part),
        }
    }
    parts
}
