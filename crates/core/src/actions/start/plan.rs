//! The plan of a start: every check, and everything it writes, settled before anything is
//! written.

use std::fs;
use std::path::{Path, PathBuf};

use crate::actions::draft::listed;
use crate::actions::place;
use crate::files::markdown::Document;
use crate::files::priorities::{self, Entry};
use crate::git::GitError;
use crate::target::draft_name;
use crate::today::Date;
use crate::workspace::{Kind, folder_branch, folder_path, resolve};

use super::typed::Typed;
use super::{Start, StartError};

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

/// Everything a start writes, settled before anything is written.
pub(super) struct Plan {
    /// Whether the draft is a postponed folder rather than a file.
    pub(super) folder_draft: bool,
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
    /// The proposal of a typed change.
    pub(super) typed: Option<Typed>,
}

impl Plan {
    /// The proposal commit, as the step left to do by hand.
    pub(super) fn commit_left(&self) -> String {
        if self.folder_draft {
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
    pub(super) fn plan(
        &self,
        draft: &str,
        slug: Option<&str>,
        today: Date,
    ) -> Result<Plan, StartError> {
        let folder_draft = self.root.join(draft).is_dir();
        let proposal_source = if folder_draft {
            format!("{draft}/proposal.md")
        } else {
            draft.to_string()
        };
        let files = draft_files(self.root, draft)?;
        let text = fs::read_to_string(self.root.join(&proposal_source))
            .map_err(|_| StartError::Refused(format!("{proposal_source}: no such draft")))?;
        let slug = slug.map_or_else(|| crate::slug::short(draft_name(draft)), str::to_string);
        let (folder, worktree) = self.claim(&slug, today)?;
        // Which of the draft's files are committed, read before any write of ours.
        let tracked = self.tracked(&files);
        self.check_clean(&files)?;
        let destination = folder_path(self.kind, &folder);
        let (name, priorities) =
            self.moved_entry(draft, &proposal_source, &text, &slug, &destination)?;
        Ok(Plan {
            folder_draft,
            files,
            tracked,
            start_subject: format!("chore({slug}): start {name}"),
            proposal_subject: format!("chore({slug}): proposal"),
            write_left: format!("move {draft} to {destination}"),
            destination,
            branch: folder_branch(self.kind, &folder),
            folder,
            worktree,
            priorities,
            typed: None,
        })
    }

    /// Every check of a change typed as a text, before anything is written.
    pub(super) fn plan_text(
        &self,
        text: &str,
        slug: Option<&str>,
        today: Date,
    ) -> Result<Plan, StartError> {
        let typed = Typed::read(text).ok_or_else(|| {
            StartError::Refused("a change needs a text: its first line is its title".into())
        })?;
        let slug = slug.map_or_else(|| crate::slug::propose(&typed.title), str::to_string);
        let (folder, worktree) = self.claim(&slug, today)?;
        self.check_clean(&[])?;
        let destination = folder_path(self.kind, &folder);
        let priorities_text =
            fs::read_to_string(self.root.join("specs/PRIORITIES.md")).unwrap_or_default();
        let priorities = priorities::add_to_now(
            &priorities_text,
            &typed.title,
            &format!("/{destination}/proposal.md"),
        );
        Ok(Plan {
            folder_draft: false,
            files: Vec::new(),
            tracked: Vec::new(),
            start_subject: format!("chore({slug}): start {}", typed.title),
            proposal_subject: format!("chore({slug}): proposal"),
            write_left: format!("write {destination}/proposal.md from the text"),
            destination,
            branch: folder_branch(self.kind, &folder),
            folder,
            worktree,
            priorities,
            typed: Some(typed),
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

    /// The feature's name, and `PRIORITIES.md` with its entry moved to the end of **Now** as a
    /// link to the proposal, or added there when no entry links the draft.
    fn moved_entry(
        &self,
        draft: &str,
        proposal_source: &str,
        text: &str,
        slug: &str,
        destination: &str,
    ) -> Result<(String, String), StartError> {
        let priorities_text =
            fs::read_to_string(self.root.join("specs/PRIORITIES.md")).unwrap_or_default();
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
        let target = format!("/{destination}/proposal.md");
        match linking.as_slice() {
            [] => {
                let name = Document::parse(text)
                    .headings
                    .into_iter()
                    .find(|h| h.level == 1)
                    .map_or_else(|| slug.to_string(), |h| h.text);
                let edited = priorities::add_to_now(&priorities_text, &name, &target);
                Ok((name, edited))
            }
            [entry] => {
                let edited =
                    priorities::move_to_now(&priorities_text, entry.line, &entry.text, &target)
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
}
