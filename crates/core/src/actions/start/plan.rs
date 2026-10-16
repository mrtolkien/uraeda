//! The plan of a start: every check, and everything it writes, settled before anything is
//! written.

use std::fs;
use std::path::{Path, PathBuf};

use crate::actions::draft::listed;
use crate::actions::place;
use crate::check::change_holds;
use crate::files::markdown::Document;
use crate::files::priorities::{self, Entry};
use crate::git::GitError;
use crate::target::draft_name;
use crate::today::Date;
use crate::workspace::{Kind, folder_branch, folder_path, resolve};

use super::typed::Typed;
use super::{Source, Start, StartError};

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

/// A draft, read: its file or postponed folder, its files, its proposal, and the proposal's text.
struct Drafted<'a> {
    draft: &'a str,
    folder_draft: bool,
    files: Vec<String>,
    /// The proposal's path: the draft's file, or the postponed folder's `proposal.md`.
    proposal_source: String,
    text: String,
}

impl<'a> Drafted<'a> {
    fn read(root: &Path, draft: &'a str) -> Result<Drafted<'a>, StartError> {
        let folder_draft = root.join(draft).is_dir();
        let proposal_source = if folder_draft {
            format!("{draft}/proposal.md")
        } else {
            draft.to_string()
        };
        let files = draft_files(root, draft)?;
        let text = fs::read_to_string(root.join(&proposal_source))
            .map_err(|_| StartError::Refused(format!("{proposal_source}: no such draft")))?;
        Ok(Drafted {
            draft,
            folder_draft,
            files,
            proposal_source,
            text,
        })
    }

    /// Refuses a postponed folder holding files a change's folder has no place for, like a
    /// feature's `spec.md`, which `ura check` would report once the folder is a change's.
    fn check_change(&self) -> Result<(), StartError> {
        let prefix = format!("{}/", self.draft);
        let mut misplaced: Vec<String> = Vec::new();
        for file in &self.files {
            let Some(inside) = file.strip_prefix(&prefix) else {
                continue;
            };
            let (entry, is_dir) = match inside.split_once('/') {
                Some((folder, _)) => (folder, true),
                None => (inside, false),
            };
            let shown = if is_dir {
                format!("{entry}/")
            } else {
                entry.to_string()
            };
            if !entry.starts_with('.')
                && !change_holds(entry, is_dir)
                && !misplaced.contains(&shown)
            {
                misplaced.push(shown);
            }
        }
        misplaced.sort();
        let (verb, list) = match misplaced.as_slice() {
            [] => return Ok(()),
            [one] => ("has", one.clone()),
            [first, second] => ("have", format!("{first} and {second}")),
            [rest @ .., last] => ("have", format!("{}, and {last}", rest.join(", "))),
        };
        Err(StartError::Refused(format!(
            "{} holds {list}, which {verb} no place in a change: start it as a feature, without \
             --change",
            self.draft
        )))
    }
}

/// What a start starts from, read: a draft, or a typed change and its number of images.
enum Origin<'a> {
    Draft(Drafted<'a>),
    Text(&'a Typed, usize),
}

/// Everything a start writes, settled before anything is written.
pub(super) struct Plan {
    /// Whether the draft is a postponed folder rather than a file.
    pub(super) folder_draft: bool,
    /// Whether the proposal commit takes the whole destination folder: a postponed folder's, or a
    /// typed change's, its images included.
    pub(super) whole_folder: bool,
    pub(super) files: Vec<String>,
    /// The draft's files that are committed.
    pub(super) tracked: Vec<String>,
    /// The dated folder.
    pub(super) folder: String,
    /// The folder for a feature, `change/<folder>` for a change.
    pub(super) branch: String,
    /// Where the branch's worktree goes, unless `switch`.
    pub(super) worktree: PathBuf,
    /// `PRIORITIES.md` with the entry moved to **Now**.
    pub(super) priorities: String,
    pub(super) start_subject: String,
    pub(super) proposal_subject: String,
    /// `specs/<folder>`, or `specs/changes/<folder>` for a change.
    pub(super) destination: String,
    /// What puts the proposal in `destination`, as the step left to do by hand.
    pub(super) write_left: String,
}

impl Plan {
    /// The proposal commit, as the step left to do by hand.
    pub(super) fn commit_left(&self) -> String {
        if self.whole_folder {
            format!(
                "commit {}/ as \"{}\"",
                self.destination, self.proposal_subject
            )
        } else {
            format!(
                "commit {}/proposal.md as \"{}\"",
                self.destination, self.proposal_subject
            )
        }
    }
}

impl Start<'_> {
    /// Every check, before anything is written.
    pub(super) fn plan(&self, slug: Option<&str>, today: Date) -> Result<Plan, StartError> {
        let origin = match self.source {
            Source::Draft(draft) => Origin::Draft(Drafted::read(self.root, draft)?),
            Source::Text { typed, images } => Origin::Text(typed, images.len()),
        };
        if let Origin::Draft(drafted) = &origin
            && self.kind == Kind::Change
        {
            drafted.check_change()?;
        }
        let slug = slug.map_or_else(
            || match &origin {
                Origin::Draft(drafted) => crate::slug::short(draft_name(drafted.draft)),
                Origin::Text(typed, _) => typed.proposed_slug(),
            },
            str::to_string,
        );
        let (folder, worktree) = self.claim(&slug, today)?;
        let files = match &origin {
            Origin::Draft(drafted) => drafted.files.clone(),
            Origin::Text(..) => Vec::new(),
        };
        // Which of the draft's files are committed, read before any write of ours.
        let tracked = self.tracked(&files);
        self.check_clean(&files)?;
        let destination = folder_path(self.kind, &folder);
        let target = format!("/{destination}/proposal.md");
        let priorities_text =
            fs::read_to_string(self.root.join("specs/PRIORITIES.md")).unwrap_or_default();
        let (name, priorities, write_left) = match &origin {
            Origin::Draft(drafted) => {
                let (name, priorities) = moved_entry(&priorities_text, drafted, &slug, &target)?;
                let write_left = format!("move {} to {destination}", drafted.draft);
                (name, priorities, write_left)
            }
            Origin::Text(typed, images) => {
                let name = typed.title.clone();
                let priorities = priorities::add_started(&priorities_text, &name, &target);
                (name, priorities, typed_write_left(&destination, *images))
            }
        };
        let folder_draft = matches!(&origin, Origin::Draft(drafted) if drafted.folder_draft);
        Ok(Plan {
            folder_draft,
            whole_folder: folder_draft || matches!(origin, Origin::Text(..)),
            files,
            tracked,
            start_subject: format!("chore({slug}): start {name}"),
            proposal_subject: format!("chore({slug}): proposal"),
            write_left,
            destination,
            branch: folder_branch(self.kind, &folder),
            folder,
            worktree,
            priorities,
        })
    }

    /// The dated folder for a slug, and where its worktree goes: refused when the folder is taken,
    /// or when its worktree's folder exists.
    fn claim(&self, slug: &str, today: Date) -> Result<(String, PathBuf), StartError> {
        let folder = self.free_folder(slug, today)?;
        let worktree = place::worktree_path(self.git, &folder);
        if !self.switch && worktree.exists() {
            return Err(GitError::WorktreeExists(format!(".worktrees/{folder}")).into());
        }
        Ok((folder, worktree))
    }

    /// The dated folder for a slug, refused when the slug is not one, or when a record, a branch,
    /// or a folder already holds the name, as a feature's or as a change's.
    fn free_folder(&self, slug: &str, today: Date) -> Result<String, StartError> {
        if !valid_slug(slug) {
            return Err(StartError::Refused(format!(
                "\"{slug}\" is not a slug: lowercase letters, digits, and hyphens; choose one with --slug"
            )));
        }
        let folder = format!("{today}-{slug}");
        let features = &self.workspace.features;
        let record = crate::workspace::record_path(&folder);
        let recorded = self.root.join(&record).exists()
            || features
                .iter()
                .any(|feature| feature.folder == folder && feature.is_finished());
        if recorded {
            return Err(StartError::Refused(format!(
                "{record} exists: choose another slug with --slug"
            )));
        }
        let kinds = [Kind::Feature, Kind::Change];
        let branches = self.at.branches()?;
        let taken = kinds.iter().any(|&kind| {
            let branch_name = folder_branch(kind, &folder);
            branches.iter().any(|branch| branch.name == branch_name)
                || self.root.join(folder_path(kind, &folder)).exists()
        }) || features.iter().any(|feature| feature.folder == folder);
        if taken {
            return Err(StartError::Refused(format!(
                "{folder} exists: choose another slug with --slug"
            )));
        }
        Ok(folder)
    }

    /// The files committed at `HEAD`, among `files`.
    fn tracked(&self, files: &[String]) -> Vec<String> {
        let head = self.at.head();
        files
            .iter()
            .filter(|file| {
                head.is_some_and(|head| self.at.read_file(head, file).ok().flatten().is_some())
            })
            .cloned()
            .collect()
    }

    /// Refuses uncommitted changes outside the draft and `PRIORITIES.md`, and staged files the
    /// start commit would carry.
    fn check_clean(&self, files: &[String]) -> Result<(), StartError> {
        let others: Vec<String> = self
            .at
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
        let staged =
            crate::git::others_staged(&self.at.staged_files()?, &["specs/PRIORITIES.md".into()]);
        if !staged.is_empty() {
            return Err(GitError::OtherStagedFiles(staged).into());
        }
        Ok(())
    }
}

/// What puts a typed change's proposal, and its images, in `destination`, as the step left to do
/// by hand.
fn typed_write_left(destination: &str, images: usize) -> String {
    let proposal = format!("write {destination}/proposal.md from the text");
    if images == 0 {
        proposal
    } else {
        format!("{proposal}, and its images in {destination}/images/")
    }
}

/// The feature's name, and `PRIORITIES.md` with its entry moved to the top of **Now** as a link
/// to `target`, or added there when no entry links the draft.
fn moved_entry(
    priorities_text: &str,
    drafted: &Drafted<'_>,
    slug: &str,
    target: &str,
) -> Result<(String, String), StartError> {
    let Drafted {
        draft,
        proposal_source,
        text,
        ..
    } = drafted;
    let linking: Vec<Entry> = priorities::parse(priorities_text)
        .into_iter()
        .filter(|entry| {
            entry
                .link
                .as_deref()
                .and_then(|link| resolve("specs", link))
                .is_some_and(|path| path == *draft || path == *proposal_source)
        })
        .collect();
    match linking.as_slice() {
        [] => {
            let name = Document::parse(text)
                .headings
                .into_iter()
                .find(|h| h.level == 1)
                .map_or_else(|| slug.to_string(), |h| h.text);
            let edited = priorities::add_started(priorities_text, &name, target);
            Ok((name, edited))
        }
        [entry] => {
            let edited =
                priorities::move_to_started(priorities_text, entry.line, &entry.text, target)
                    .ok_or_else(|| StartError::Refused("cannot move the entry".into()))?;
            Ok((entry.text.clone(), edited))
        }
        several => {
            let entries: Vec<&Entry> = several.iter().collect();
            Err(StartError::Refused(format!(
                "{} lines link {draft}:{}",
                several.len(),
                listed(&entries)
            )))
        }
    }
}
