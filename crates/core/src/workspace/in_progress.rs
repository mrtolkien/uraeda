//! The one rule for what is in progress, as the skill states it: every worktree on a branch of its
//! own, whatever its name, holds the features and changes it has folders of, `specs/<date>-<slug>/`
//! and `specs/changes/<date>-<slug>/`, and the records its own finish wrote,
//! `specs/done/<folder>.md`, the folder gone. The default branch's checkout and a detached one hold
//! none, and neither does a folder or a record the default branch holds too: those are merged. A
//! branch without a worktree is postponed, and holds nothing in progress.

use std::path::{Path, PathBuf};
use std::time::SystemTime;

use super::{Kind, folder_slug, record_path};
use crate::git::Git;

/// A feature's or a change's folder in a worktree.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct InProgress {
    pub kind: Kind,
    /// Its folder's name, `2026-11-14-tags`.
    pub folder: String,
    /// The worktree's branch.
    pub branch: String,
    /// The worktree, absolute.
    pub worktree: PathBuf,
    /// Whether its branch replaced the folder with its record: finished, not merged yet.
    pub finished: bool,
}

impl InProgress {
    /// The folder on disk.
    pub fn dir(&self) -> PathBuf {
        let under = match self.kind {
            Kind::Feature => "specs",
            Kind::Change => "specs/changes",
        };
        self.worktree.join(under).join(&self.folder)
    }
}

/// What every worktree of the repository holds in progress. A folder in two worktrees is the one
/// changed last's.
pub fn in_progress(git: &Git) -> Vec<InProgress> {
    let default = git.default_branch();
    let default_tip = default.as_deref().and_then(|branch| git.tip(branch));
    let on_default = |path: &str| default_tip.is_some_and(|tip| git.entry_id(tip, path).is_some());
    let mut found: Vec<(SystemTime, InProgress)> = Vec::new();
    for worktree in git.worktrees().unwrap_or_default() {
        let Some(branch) = worktree
            .branch
            .filter(|branch| Some(branch) != default.as_ref())
        else {
            continue;
        };
        if !worktree.path.exists() {
            continue;
        }
        let mut seen = |item: InProgress, changed: SystemTime| match found
            .iter_mut()
            .find(|(_, other)| other.folder == item.folder)
        {
            Some(other) if changed > other.0 => *other = (changed, item),
            Some(_) => {}
            None => found.push((changed, item)),
        };
        for (kind, under) in [(Kind::Feature, "specs"), (Kind::Change, "specs/changes")] {
            let Ok(entries) = std::fs::read_dir(worktree.path.join(under)) else {
                continue;
            };
            for entry in entries.flatten() {
                let folder = entry.file_name().to_string_lossy().into_owned();
                let record = record_path(&folder);
                if folder_slug(&folder).is_none()
                    || !entry.path().is_dir()
                    || on_default(&format!("{under}/{folder}"))
                    || on_default(&record)
                {
                    continue;
                }
                let item = InProgress {
                    kind,
                    folder,
                    branch: branch.clone(),
                    worktree: worktree.path.clone(),
                    finished: worktree.path.join(&record).exists(),
                };
                seen(item, newest(&entry.path()));
            }
        }
        let Ok(records) = std::fs::read_dir(worktree.path.join("specs/done")) else {
            continue;
        };
        for entry in records.flatten() {
            let name = entry.file_name().to_string_lossy().into_owned();
            let Some(folder) = name.strip_suffix(".md") else {
                continue;
            };
            let record = record_path(folder);
            let kind = match std::fs::read_to_string(entry.path()) {
                Ok(text) if text.contains("\nkind: change") => Kind::Change,
                _ => Kind::Feature,
            };
            if folder_slug(folder).is_none() || on_default(&record) {
                continue;
            }
            let item = InProgress {
                kind,
                folder: folder.to_string(),
                branch: branch.clone(),
                worktree: worktree.path.clone(),
                finished: true,
            };
            seen(item, newest(&entry.path()));
        }
    }
    found.sort_by(|a, b| a.1.folder.cmp(&b.1.folder));
    found.into_iter().map(|(_, item)| item).collect()
}

/// When a folder or a file in it last changed.
fn newest(dir: &Path) -> SystemTime {
    let at = |path: &Path| {
        std::fs::metadata(path)
            .and_then(|meta| meta.modified())
            .unwrap_or(SystemTime::UNIX_EPOCH)
    };
    std::fs::read_dir(dir)
        .into_iter()
        .flatten()
        .flatten()
        .map(|entry| at(&entry.path()))
        .fold(at(dir), SystemTime::max)
}
