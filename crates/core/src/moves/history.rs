//! Where a file or folder of `specs/` missing at a commit went, read from that commit's history:
//! git's renames, a start's main file paired with the one it added, a change made a feature, a
//! finished folder's record, or the commit that deleted it, chained to the end.

use std::collections::{BTreeMap, BTreeSet};
use std::path::PathBuf;
use std::sync::{Arc, Mutex, PoisonError};

use super::Went;
use crate::git::{CommitPaths, Git, GitError, ObjectId};
use crate::today::Date;

/// What one commit did to a path.
#[derive(Clone, Debug, PartialEq, Eq)]
enum Change {
    Added,
    Went(Went),
}

/// The history of a commit, as what each commit did to each path of `specs/`.
#[derive(Debug)]
pub struct History {
    /// Each path's changes, newest first, with their commit's place in the history, 0 the newest.
    paths: BTreeMap<String, Vec<(usize, Change)>>,
}

/// A history read, by repository root and tip.
type Read = (PathBuf, ObjectId, Arc<History>);

/// The latest histories read, the most recently used last.
static READ: Mutex<Vec<Read>> = Mutex::new(Vec::new());

/// How many histories [`READ`] keeps: the server reads a feature's checkout and the default
/// branch's in turn.
const KEPT: usize = 4;

impl History {
    /// The history of `tip`, read once with `git log`. The last few histories read are kept, by
    /// repository root and tip, and returned again for them; the one used least recently leaves
    /// first.
    pub fn read(git: &Git, tip: ObjectId) -> Result<Arc<History>, GitError> {
        let root = git.root().to_path_buf();
        let mut read = READ.lock().unwrap_or_else(PoisonError::into_inner);
        if let Some(at) = read
            .iter()
            .position(|(read_root, read_tip, _)| *read_root == root && *read_tip == tip)
        {
            let used = read.remove(at);
            let history = Arc::clone(&used.2);
            read.push(used);
            return Ok(history);
        }
        let history = Arc::new(History::from_commits(&git.path_events(tip)?));
        if read.len() == KEPT {
            read.remove(0);
        }
        read.push((root, tip, Arc::clone(&history)));
        Ok(history)
    }

    fn from_commits(commits: &[CommitPaths]) -> History {
        let mut paths: BTreeMap<String, Vec<(usize, Change)>> = BTreeMap::new();
        for (index, commit) in commits.iter().enumerate() {
            for (path, change) in pair(commit) {
                paths.entry(path).or_default().push((index, change));
            }
        }
        History { paths }
    }

    /// Where the file or folder `path`, from the top level and missing at the tip, went, chained
    /// to its end. `None` when no commit removed it, or when it is back at the tip. A folder went
    /// where its files went, when the commit that removed the last of them sent them all to one
    /// folder, one record, or one deletion.
    pub fn went(&self, path: &str) -> Option<Went> {
        let path = path.trim_end_matches('/');
        match self.paths.get(path) {
            Some(changes) => self.chain(path, changes),
            None => self.folder(path),
        }
    }

    /// Follows `path`'s newest removal, then each new path's first removal after the commit that
    /// brought it there: a chain only moves forward in time, so a path moved away and back ends.
    /// It stops at a path whose newest change adds it, which is there at the tip.
    fn chain(&self, path: &str, changes: &[(usize, Change)]) -> Option<Went> {
        let (mut at, Change::Went(mut went)) = changes.first()?.clone() else {
            return None;
        };
        while let Went::Moved { path: next, .. } = &went {
            let Some(next) = self.paths.get(next) else {
                break;
            };
            if next
                .first()
                .is_some_and(|(_, change)| *change == Change::Added)
            {
                break;
            }
            let Some((index, Change::Went(further))) =
                next.iter().rev().find(|(index, _)| *index < at).cloned()
            else {
                break;
            };
            at = index;
            went = further;
        }
        let back = matches!(&went, Went::Moved { path: end, .. } if end == path);
        (!back).then_some(went)
    }

    fn folder(&self, folder: &str) -> Option<Went> {
        let prefix = format!("{folder}/");
        let files: Vec<(&String, &Vec<(usize, Change)>)> = self
            .paths
            .range(prefix.clone()..)
            .take_while(|(file, _)| file.starts_with(&prefix))
            .collect();
        if files
            .iter()
            .any(|(_, changes)| changes[0].1 == Change::Added)
        {
            return None;
        }
        let last = files.iter().map(|(_, changes)| changes[0].0).min()?;
        let mut ends = files
            .iter()
            .filter(|(_, changes)| changes[0].0 == last)
            .map(|(file, changes)| match self.chain(file, changes)? {
                Went::Moved { path, .. } => Some(Went::Moved {
                    path: moved_folder(&path, file, folder)?.to_string(),
                    anchor: None,
                }),
                went => Some(went),
            });
        let first = ends.next()??;
        ends.all(|end| end.as_ref() == Some(&first))
            .then_some(first)
    }
}

/// What one commit did to each path it names: every added path is `Added`; a removed path is a
/// finished folder's `Record`, else `Moved` by git's rename, by a change made a feature, or as the
/// one main file the commit moved, as [`start`] pairs it, else `Deleted` by the commit.
fn pair(commit: &CommitPaths) -> Vec<(String, Change)> {
    let added: Vec<&str> = commit
        .added
        .iter()
        .chain(commit.renamed.iter().map(|(_, new)| new))
        .map(String::as_str)
        .collect();
    let records: Vec<(String, &str)> = added
        .iter()
        .filter_map(|path| {
            let (specs, rest) = split_specs(path)?;
            let name = rest.strip_prefix("done/")?.strip_suffix(".md")?;
            (!name.contains('/')).then(|| (format!("{specs}{name}/"), *path))
        })
        .collect();
    let record = |path: &str| {
        records.iter().find_map(|(folder, record)| {
            let changes = folder.replacen("specs/", "specs/changes/", 1);
            (path.starts_with(folder.as_str()) || path.starts_with(&changes)).then_some(*record)
        })
    };
    let mut changes: Vec<(String, Change)> = added
        .iter()
        .map(|path| (path.to_string(), Change::Added))
        .collect();
    let mut taken = BTreeSet::new();
    let mut unpaired = Vec::new();
    let removed = (commit.deleted.iter().map(|old| (old, None)))
        .chain(commit.renamed.iter().map(|(old, new)| (old, Some(new))));
    for (old, new) in removed {
        let went = match (record(old), new) {
            (Some(record), _) => Went::Record(record.to_string()),
            (None, Some(new)) => moved(new),
            (None, None) => match featured(old).filter(|new| added.contains(&new.as_str())) {
                Some(new) => {
                    taken.insert(new.clone());
                    moved(&new)
                }
                None => {
                    unpaired.push(old.as_str());
                    continue;
                }
            },
        };
        changes.push((old.to_string(), Change::Went(went)));
    }
    let fresh: Vec<&str> = (commit.added.iter())
        .map(String::as_str)
        .filter(|path| !taken.contains(*path))
        .collect();
    let start = start(&unpaired, &fresh);
    for old in unpaired {
        let went = match start {
            Some((main, new)) if main == old => moved(new),
            _ => Went::Deleted {
                commit: commit.commit.clone(),
                subject: commit.subject.clone(),
            },
        };
        changes.push((old.to_string(), Change::Went(went)));
    }
    changes
}

fn moved(path: &str) -> Went {
    Went::Moved {
        path: path.to_string(),
        anchor: None,
    }
}

/// `path` split after its `specs/` folder, the top level's or a nested one's: the folder with its
/// `/`, and the rest.
fn split_specs(path: &str) -> Option<(&str, &str)> {
    let end = if path.starts_with("specs/") {
        "specs/".len()
    } else {
        path.find("/specs/")? + "/specs/".len()
    };
    Some(path.split_at(end))
}

/// Where a change's file went when the change became a feature: `specs/changes/<d>/<rest>` to
/// `specs/<d>/<rest>`.
fn featured(path: &str) -> Option<String> {
    let (specs, rest) = split_specs(path)?;
    Some(format!("{specs}{}", rest.strip_prefix("changes/")?))
}

/// The one deleted main file of `unpaired` paired with the one path of `added` it can have gone
/// to: a dated folder's `proposal.md`, which a start adds, or a main file named as it was, or with
/// a number after, as a file made a folder or a note made a proposal is. Either side with none or
/// more than one pairs nothing.
fn start<'a>(unpaired: &[&'a str], added: &[&'a str]) -> Option<(&'a str, &'a str)> {
    let mains: Vec<(&str, &str)> = (unpaired.iter())
        .filter_map(|path| Some((*path, slug(path)?)))
        .collect();
    let [(main, old)] = mains[..] else {
        return None;
    };
    let named = |new: &str| {
        new == old
            || (new.strip_prefix(old))
                .and_then(|rest| rest.strip_prefix('-'))
                .is_some_and(|n| !n.is_empty() && n.bytes().all(|byte| byte.is_ascii_digit()))
    };
    let targets: Vec<&str> = (added.iter())
        .filter(|path| is_dated(path) || slug(path).is_some_and(named))
        .copied()
        .collect();
    let [target] = targets[..] else {
        return None;
    };
    Some((main, target))
}

/// The name of a proposal or note file's main file, `<x>` of `proposals/<x>.md`,
/// `proposals/<x>/proposal.md`, `notes/<x>.md`, or `notes/<x>/note.md` under `specs/`.
fn slug(path: &str) -> Option<&str> {
    let (_, rest) = split_specs(path)?;
    [("proposals/", "proposal.md"), ("notes/", "note.md")]
        .iter()
        .find_map(|(folder, main)| {
            let name = rest.strip_prefix(folder)?;
            match name.split_once('/') {
                Some((name, file)) => (file == *main).then_some(name),
                None => name.strip_suffix(".md"),
            }
        })
}

/// Whether `path` is a dated folder's `proposal.md`, a feature's or a change's.
fn is_dated(path: &str) -> bool {
    let dated = |rest: &str| {
        rest.strip_suffix("/proposal.md").is_some_and(|folder| {
            !folder.contains('/')
                && folder.get(10..11) == Some("-")
                && folder.get(..10).and_then(Date::parse).is_some()
        })
    };
    split_specs(path)
        .is_some_and(|(_, rest)| dated(rest) || rest.strip_prefix("changes/").is_some_and(dated))
}

/// Where the folder `folder` went, given that its file `file` went to `path`: `path` without the
/// file's place in the folder, or, for the folder's main file moved to another folder's main
/// file, as a note folder made a proposal folder, that main file's folder.
fn moved_folder<'a>(path: &'a str, file: &str, folder: &str) -> Option<&'a str> {
    fn main_folder(path: &str) -> Option<&str> {
        let folder =
            (path.strip_suffix("/proposal.md")).or_else(|| path.strip_suffix("/note.md"))?;
        (slug(path).is_some() || is_dated(path)).then_some(folder)
    }
    (path.strip_suffix(&file[folder.len()..]))
        .or_else(|| (main_folder(file) == Some(folder)).then(|| main_folder(path))?)
}
