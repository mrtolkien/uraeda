//! A start's writes put back as they were, once a hook refused its commit: nothing is made. A path
//! is put back only while it still holds what the start left there, never over a file someone
//! wrote meanwhile.

use std::collections::BTreeMap;
use std::fs;
use std::path::Path;

use super::Start;
use super::plan::Plan;

/// What the start left in its dated folder before its commit: each file's bytes, by path from the
/// top level.
pub(super) type Written = BTreeMap<String, Vec<u8>>;

/// What the files under `folder`, from `root`, hold, symbolic links not followed.
pub(super) fn written_in(root: &Path, folder: &str) -> Written {
    let mut files = Written::new();
    let mut stack = vec![folder.to_string()];
    while let Some(dir) = stack.pop() {
        let Ok(entries) = fs::read_dir(root.join(&dir)) else {
            continue;
        };
        for entry in entries.flatten() {
            let path = format!("{dir}/{}", entry.file_name().to_string_lossy());
            if entry.file_type().is_ok_and(|kind| kind.is_dir()) {
                stack.push(path);
            } else if let Ok(bytes) = fs::read(entry.path()) {
                files.insert(path, bytes);
            }
        }
    }
    files
}

impl Start<'_> {
    /// Puts back what the start wrote, each path only while it holds what the start left there:
    /// each moved file at its path, never over a file there, with `proposal_before` as the
    /// proposal's text when its nested lines were added; the files written in the dated folder
    /// gone, and the folder once empty; and `PRIORITIES.md` as it was read. The refused commit
    /// already took back what it staged. Returns the paths left as they are: changed since, or
    /// failing to be put back.
    pub(super) fn put_back(
        &self,
        plan: &Plan,
        moves: &[(String, String)],
        written: &Written,
        proposal_before: Option<&str>,
    ) -> Vec<String> {
        let root = self.root;
        let proposal = format!("{}/proposal.md", plan.destination);
        let mut left = Vec::new();
        let unchanged = |path: &str| {
            written
                .get(path)
                .is_some_and(|bytes| fs::read(root.join(path)).ok().as_ref() == Some(bytes))
        };
        for (from, to) in moves.iter().rev() {
            let moved_back = unchanged(to)
                && !fs::exists(root.join(from)).unwrap_or(true)
                && match proposal_before {
                    Some(text) if *to == proposal => fs::write(root.join(to), text).is_ok(),
                    _ => true,
                }
                && root
                    .join(from)
                    .parent()
                    .is_none_or(|parent| fs::create_dir_all(parent).is_ok())
                && fs::rename(root.join(to), root.join(from)).is_ok();
            if !moved_back {
                left.push(to.clone());
            }
        }
        // The files the start wrote rather than moved, as a typed change's proposal and images.
        for path in written.keys() {
            if moves.iter().any(|(_, to)| to == path) {
                continue;
            }
            if !unchanged(path) || fs::remove_file(root.join(path)).is_err() {
                left.push(path.clone());
            }
        }
        // The folder was free before the start, as its plan checked: a file it still holds and
        // not left above is someone's.
        remove_empty(&root.join(&plan.destination));
        let others = written_in(root, &plan.destination)
            .into_keys()
            .any(|path| !left.contains(&path));
        if others {
            left.push(plan.destination.clone());
        }
        let priorities = root.join("specs/PRIORITIES.md");
        let restored = fs::read_to_string(&priorities).ok().as_deref()
            == Some(plan.priorities.as_str())
            && match &plan.priorities_before {
                Some(text) => fs::write(&priorities, text).is_ok(),
                None => fs::remove_file(&priorities).is_ok(),
            };
        if !restored {
            left.push("specs/PRIORITIES.md".into());
        }
        left
    }
}

/// Removes the empty folders under `folder`, and `folder` itself once empty.
fn remove_empty(folder: &Path) {
    if let Ok(entries) = fs::read_dir(folder) {
        for entry in entries.flatten() {
            if entry.file_type().is_ok_and(|kind| kind.is_dir()) {
                remove_empty(&entry.path());
            }
        }
    }
    let _ = fs::remove_dir(folder);
}
