//! Starting a drafted feature, as the skill's start section says: on the default branch, its
//! `PRIORITIES.md` entry moves to the end of **Now** as a link and is committed; then its branch
//! is created, and the draft moves into the dated folder, unchanged, in a second commit.

use std::fs;
use std::path::Path;

use crate::files::markdown::Document;
use crate::files::priorities::{self, Entry};
use crate::git::{Git, GitError};
use crate::target::draft_name;
use crate::today::Date;
use crate::workspace::{Workspace, resolve};

use super::draft::listed;
use super::place;

/// What a start did.
pub struct Started {
    pub default_branch: String,
    pub start_subject: String,
    pub branch: String,
    /// Each file moved, from and to, from the top level.
    pub moves: Vec<(String, String)>,
    pub proposal_subject: String,
}

#[derive(Debug, thiserror::Error)]
pub enum StartError {
    #[error("{0}")]
    Refused(String),
    /// A failure after the first commit: what was done, and what is left to do by hand.
    #[error("{cause}")]
    Partial {
        done: Vec<String>,
        left: Vec<String>,
        cause: String,
    },
}

impl From<GitError> for StartError {
    fn from(error: GitError) -> StartError {
        StartError::Refused(error.to_string())
    }
}

impl From<place::PlaceError> for StartError {
    fn from(error: place::PlaceError) -> StartError {
        StartError::Refused(error.to_string())
    }
}

impl From<std::io::Error> for StartError {
    fn from(error: std::io::Error) -> StartError {
        StartError::Refused(error.to_string())
    }
}

/// The placeholders of the proposal template a written draft no longer holds.
const PLACEHOLDERS: [&str; 2] = [
    "[What the feature does, from the user's point of view.]",
    "[The problem it solves, and for whom.]",
];

/// Whether a draft still holds the template's text: a placeholder, or an empty `## What` or
/// `## Why` section.
fn unwritten(text: &str) -> bool {
    if text.lines().any(|line| PLACEHOLDERS.contains(&line.trim())) {
        return true;
    }
    let lines: Vec<&str> = text.lines().collect();
    ["## What", "## Why"].iter().any(|heading| {
        let Some(start) = lines.iter().position(|line| line.trim_end() == *heading) else {
            return false;
        };
        lines[start + 1..]
            .iter()
            .take_while(|line| !line.starts_with('#'))
            .all(|line| line.trim().is_empty())
    })
}

fn valid_slug(slug: &str) -> bool {
    !slug.is_empty()
        && !slug.starts_with('-')
        && slug
            .chars()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
}

/// The files of a draft: the file itself, or every file of a postponed folder, from the top
/// level.
fn draft_files(root: &Path, draft: &str) -> Result<Vec<String>, StartError> {
    let path = root.join(draft);
    if path.is_file() {
        return Ok(vec![draft.to_string()]);
    }
    let mut files = Vec::new();
    let mut stack = vec![path.clone()];
    while let Some(dir) = stack.pop() {
        for entry in fs::read_dir(&dir)?.flatten() {
            if entry.file_type().is_ok_and(|t| t.is_dir()) {
                stack.push(entry.path());
            } else if let Ok(relative) = entry.path().strip_prefix(root) {
                files.push(relative.to_string_lossy().into_owned());
            }
        }
    }
    files.sort();
    if files.is_empty() {
        return Err(StartError::Refused(format!("{draft}: no such draft")));
    }
    Ok(files)
}

/// Starts the feature written in a draft.
pub fn run(
    git: &Git,
    workspace: &Workspace,
    draft: &str,
    slug: Option<&str>,
    today: Date,
) -> Result<Started, StartError> {
    let default = workspace
        .default_branch
        .clone()
        .ok_or_else(|| StartError::Refused("no default branch: commit on main first".into()))?;
    let place = place::reach(git, &default)?;
    let at = Git::open(&place.root)?;
    let root = place.root.as_path();

    // Every check, before anything is written.
    let folder_draft = root.join(draft).is_dir();
    let proposal_source = if folder_draft {
        format!("{draft}/proposal.md")
    } else {
        draft.to_string()
    };
    let files = draft_files(root, draft)?;
    let text = fs::read_to_string(root.join(&proposal_source))
        .map_err(|_| StartError::Refused(format!("{proposal_source}: no such draft")))?;
    if unwritten(&text) {
        return Err(StartError::Refused(format!(
            "{proposal_source} still holds the template's placeholders: write it first"
        )));
    }
    let slug = slug.unwrap_or_else(|| draft_name(draft)).to_string();
    if !valid_slug(&slug) {
        return Err(StartError::Refused(format!(
            "\"{slug}\" is not a slug: lowercase letters, digits, and hyphens"
        )));
    }
    let folder = format!("{today}-{slug}");
    let taken = at.branches()?.iter().any(|branch| branch.name == folder)
        || root.join("specs").join(&folder).exists()
        || workspace
            .features
            .iter()
            .any(|feature| feature.folder == folder);
    if taken {
        return Err(StartError::Refused(format!(
            "{folder} exists: choose another slug with --slug"
        )));
    }
    // Which of the draft's files are committed, read before any write of ours.
    let head = at.head();
    let tracked: Vec<String> = files
        .iter()
        .filter(|file| head.is_some_and(|head| at.read_file(head, file).ok().flatten().is_some()))
        .cloned()
        .collect();
    let others: Vec<String> = at
        .changed_files()?
        .into_iter()
        .filter(|file| file != "specs/PRIORITIES.md" && !files.contains(file))
        .collect();
    if !others.is_empty() {
        return Err(StartError::Refused(format!(
            "cannot start: uncommitted changes in {}",
            others.join(", ")
        )));
    }
    let priorities_path = root.join("specs/PRIORITIES.md");
    let priorities_text = fs::read_to_string(&priorities_path).unwrap_or_default();
    let linking: Vec<Entry> = priorities::parse(&priorities_text)
        .into_iter()
        .filter(|entry| {
            entry
                .link
                .as_deref()
                .and_then(|link| resolve("specs", link))
                .is_some_and(|path| path == draft || path == proposal_source)
        })
        .collect();
    let target = format!("/specs/{folder}/proposal.md");
    let title = Document::parse(&text)
        .headings
        .into_iter()
        .find(|h| h.level == 1)
        .map(|h| h.text);
    let (name, edited) = match linking.as_slice() {
        [] => {
            let name = title.unwrap_or_else(|| slug.clone());
            let edited = priorities::add_to_now(&priorities_text, &name, &target);
            (name, edited)
        }
        [entry] => {
            let edited =
                priorities::move_to_now(&priorities_text, entry.line, &entry.text, &target)
                    .ok_or_else(|| StartError::Refused("cannot move the entry".into()))?;
            (entry.text.clone(), edited)
        }
        several => {
            let entries: Vec<&Entry> = several.iter().collect();
            return Err(StartError::Refused(format!(
                "{} lines link {draft}:{}",
                several.len(),
                listed(&entries)
            )));
        }
    };

    // The start commit, on the default branch.
    fs::write(&priorities_path, edited)?;
    let start_subject = format!("chore({slug}): start {name}");
    at.commit(&["specs/PRIORITIES.md".to_string()], &start_subject, None)?;
    let mut done = vec![format!("the start commit on {default}")];
    let partial = |done: &[String], left: Vec<String>, cause: String| StartError::Partial {
        done: done.to_vec(),
        left,
        cause,
    };
    let proposal_subject = format!("chore({slug}): proposal");
    let destination = format!("specs/{folder}");
    let commit_left = if folder_draft {
        format!("commit {destination}/ as \"{proposal_subject}\"")
    } else {
        format!("commit {destination}/proposal.md as \"{proposal_subject}\"")
    };

    // The branch, and the draft moved into the dated folder.
    if let Err(error) = at.switch_new(&folder, &default) {
        let left = vec![
            format!("create the branch {folder}"),
            format!("move {draft} to {destination}"),
            commit_left,
        ];
        return Err(partial(&done, left, error.to_string()));
    }
    done.push(format!("the branch {folder}"));
    let mut moves = Vec::new();
    for file in &files {
        let to = if folder_draft {
            format!(
                "{destination}/{}",
                file.strip_prefix(&format!("{draft}/")).unwrap_or(file)
            )
        } else {
            format!("{destination}/proposal.md")
        };
        if let Some(parent) = root.join(&to).parent() {
            fs::create_dir_all(parent)?;
        }
        fs::rename(root.join(file), root.join(&to))?;
        moves.push((file.clone(), to));
    }
    if folder_draft {
        let _ = fs::remove_dir_all(root.join(draft));
    }
    done.push("the move of the draft".to_string());
    let mut paths: Vec<String> = Vec::new();
    for (from, to) in &moves {
        paths.push(to.clone());
        if tracked.contains(from) {
            paths.push(from.clone());
        }
    }
    paths.sort();
    if let Err(error) = at.commit(&paths, &proposal_subject, None) {
        return Err(partial(&done, vec![commit_left], error.to_string()));
    }
    Ok(Started {
        default_branch: default,
        start_subject,
        branch: folder,
        moves,
        proposal_subject,
    })
}
