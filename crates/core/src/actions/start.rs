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
    /// The worktree the branch is checked out in, from the main checkout, unless `--switch`.
    pub worktree: Option<String>,
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

/// A slug as `ura draft` makes them: lowercase letters, digits, and hyphens.
fn valid_slug(slug: &str) -> bool {
    !slug.is_empty()
        && !slug.starts_with('-')
        && slug
            .chars()
            .all(|c| (c.is_alphanumeric() && !c.is_uppercase()) || c == '-')
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

/// Starts the feature written in a draft: its branch in a worktree at `.worktrees/<folder>/`, or,
/// with `switch`, in this working tree, switched to it.
pub fn run(
    git: &Git,
    workspace: &Workspace,
    draft: &str,
    slug: Option<&str>,
    today: Date,
    switch: bool,
) -> Result<Started, StartError> {
    let default = workspace
        .default_branch
        .clone()
        .ok_or_else(|| StartError::Refused("no default branch: commit on main first".into()))?;
    let previous = git.current_branch();
    let place = if switch {
        place::reach_switching(git, &default)?
    } else {
        place::reach(git, &default)?
    };
    let result = start(git, &place, workspace, draft, slug, today, &default, switch);
    if let Err(StartError::Refused(_)) = &result {
        place::switch_back(git, &place, previous.as_deref());
    }
    result
}

#[allow(clippy::too_many_arguments)]
fn start(
    git: &Git,
    place: &place::Place,
    workspace: &Workspace,
    draft: &str,
    slug: Option<&str>,
    today: Date,
    default: &str,
    switch: bool,
) -> Result<Started, StartError> {
    let default = default.to_string();
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
    let slug = slug.unwrap_or_else(|| draft_name(draft)).to_string();
    if !valid_slug(&slug) {
        return Err(StartError::Refused(format!(
            "\"{slug}\" is not a slug: lowercase letters, digits, and hyphens; choose one with --slug"
        )));
    }
    let folder = format!("{today}-{slug}");
    let record = crate::workspace::record_path(&folder);
    let recorded = root.join(&record).exists()
        || workspace
            .features
            .iter()
            .any(|feature| feature.folder == folder && feature.is_finished());
    if recorded {
        return Err(StartError::Refused(format!(
            "{record} exists: choose another slug with --slug"
        )));
    }
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
    let worktree = place::worktree_path(git, &folder);
    if !switch && worktree.exists() {
        return Err(GitError::WorktreeExists(format!(".worktrees/{folder}")).into());
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
    let staged = crate::git::others_staged(&at.staged_files()?, &["specs/PRIORITIES.md".into()]);
    if !staged.is_empty() {
        return Err(GitError::OtherStagedFiles(staged).into());
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
    // Written, so a failed commit stays here: switching back could carry the staged file away.
    if let Err(error) = at.commit(&["specs/PRIORITIES.md".to_string()], &start_subject, None) {
        let left = vec![
            format!("commit specs/PRIORITIES.md on {default} as \"{start_subject}\""),
            format!("create the branch {folder}"),
            format!("move {draft} to {destination}"),
            commit_left,
        ];
        return Err(partial(&[], left, error.to_string()));
    }
    let mut done = vec![format!("the start commit on {default}")];

    // The branch, and the draft moved into the dated folder.
    let target_root = if switch {
        if let Err(error) = at.switch_new(&folder, &default) {
            let left = vec![
                format!("create the branch {folder}"),
                format!("move {draft} to {destination}"),
                commit_left,
            ];
            return Err(partial(&done, left, error.to_string()));
        }
        root.to_path_buf()
    } else {
        let created = git
            .exclude_worktrees()
            .and_then(|()| at.add_worktree_new(&worktree, &folder, &default));
        if let Err(error) = created {
            let left = vec![
                format!("create the branch {folder} in .worktrees/{folder}"),
                format!("move {draft} to {destination}"),
                commit_left,
            ];
            return Err(partial(&done, left, error.to_string()));
        }
        std::fs::canonicalize(&worktree).unwrap_or(worktree.clone())
    };
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
        if let Some(parent) = target_root.join(&to).parent() {
            fs::create_dir_all(parent)?;
        }
        if switch {
            fs::rename(root.join(file), target_root.join(&to))?;
        } else {
            // The draft as it is here, uncommitted edits included, goes to the new branch; the
            // default branch keeps its committed version.
            fs::copy(root.join(file), target_root.join(&to))?;
            let _ = fs::remove_file(target_root.join(file));
            if tracked.contains(file) {
                at.restore(file)?;
            } else {
                fs::remove_file(root.join(file))?;
            }
        }
        moves.push((file.clone(), to));
    }
    if folder_draft {
        let _ = fs::remove_dir_all(target_root.join(draft));
        if !switch && tracked.is_empty() {
            let _ = fs::remove_dir_all(root.join(draft));
        }
    }
    done.push("the move of the draft".to_string());
    // Folders as pathspecs, so files git ignores, like `.DS_Store`, stay out of the commit.
    let mut paths: Vec<String> = Vec::new();
    if folder_draft {
        paths.push(destination.clone());
        if !tracked.is_empty() {
            paths.push(draft.to_string());
        }
    } else {
        for (from, to) in &moves {
            paths.push(to.clone());
            if tracked.contains(from) {
                paths.push(from.clone());
            }
        }
    }
    paths.sort();
    let on_branch = Git::open(&target_root)?;
    if let Err(error) = on_branch.commit(&paths, &proposal_subject, None) {
        return Err(partial(&done, vec![commit_left], error.to_string()));
    }
    Ok(Started {
        default_branch: default,
        start_subject,
        branch: folder.clone(),
        worktree: (!switch).then(|| format!(".worktrees/{folder}")),
        moves,
        proposal_subject,
    })
}
