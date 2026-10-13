//! Starting a drafted feature, as the skill's start section says: on the default branch, its
//! `PRIORITIES.md` entry moves to the end of **Now** as a link and is committed; then its branch
//! is created, and the draft moves into the dated folder, unchanged, in a second commit.

use std::fs;
use std::path::{Path, PathBuf};

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
    #[error(transparent)]
    Git(#[from] GitError),
    #[error(transparent)]
    Place(#[from] place::PlaceError),
    #[error(transparent)]
    Io(#[from] std::io::Error),
    /// A failure after the first commit: what was done, and what is left to do by hand.
    #[error("{cause}")]
    Partial {
        done: Vec<String>,
        left: Vec<String>,
        cause: String,
    },
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
    let result = Start::open(git, &place, workspace, draft, &default, switch)
        .and_then(|start| start.run(slug, today));
    if matches!(&result, Err(error) if !matches!(error, StartError::Partial { .. })) {
        place::switch_back(git, &place, previous.as_deref());
    }
    result
}

/// A start under way: where it runs, and the draft it starts.
struct Start<'a> {
    /// The repository the command runs in.
    git: &'a Git,
    workspace: &'a Workspace,
    /// The working tree on the default branch, and its repository.
    root: &'a Path,
    at: Git,
    draft: &'a str,
    default: &'a str,
    switch: bool,
}

/// Everything a start writes, settled before anything is written.
struct Plan {
    /// Whether the draft is a postponed folder rather than a file.
    folder_draft: bool,
    files: Vec<String>,
    /// The draft's files that are committed.
    tracked: Vec<String>,
    /// The dated folder, also the branch's name.
    folder: String,
    /// Where the branch's worktree goes, unless `switch`.
    worktree: PathBuf,
    /// `PRIORITIES.md` with the entry moved to **Now**.
    priorities: String,
    start_subject: String,
    proposal_subject: String,
    /// `specs/<folder>`.
    destination: String,
}

impl Plan {
    /// The proposal commit, as the step left to do by hand.
    fn commit_left(&self) -> String {
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

/// A failure after the first commit.
fn partial(done: &[String], left: Vec<String>, cause: impl ToString) -> StartError {
    StartError::Partial {
        done: done.to_vec(),
        left,
        cause: cause.to_string(),
    }
}

impl<'a> Start<'a> {
    fn open(
        git: &'a Git,
        place: &'a place::Place,
        workspace: &'a Workspace,
        draft: &'a str,
        default: &'a str,
        switch: bool,
    ) -> Result<Start<'a>, StartError> {
        Ok(Start {
            git,
            workspace,
            root: place.root.as_path(),
            at: Git::open(&place.root)?,
            draft,
            default,
            switch,
        })
    }

    fn run(&self, slug: Option<&str>, today: Date) -> Result<Started, StartError> {
        let plan = self.plan(slug, today)?;
        self.commit_start(&plan)?;
        let mut done = vec![format!("the start commit on {}", self.default)];
        let target_root = self.create_branch(&plan, &done)?;
        done.push(format!("the branch {}", plan.folder));
        let moves = self.move_draft(&plan, &target_root)?;
        done.push("the move of the draft".to_string());
        self.commit_proposal(&plan, &moves, &target_root, &done)?;
        Ok(Started {
            default_branch: self.default.to_string(),
            start_subject: plan.start_subject,
            branch: plan.folder.clone(),
            worktree: (!self.switch).then(|| format!(".worktrees/{}", plan.folder)),
            moves,
            proposal_subject: plan.proposal_subject,
        })
    }

    /// Every check, before anything is written.
    fn plan(&self, slug: Option<&str>, today: Date) -> Result<Plan, StartError> {
        let draft = self.draft;
        let folder_draft = self.root.join(draft).is_dir();
        let proposal_source = if folder_draft {
            format!("{draft}/proposal.md")
        } else {
            draft.to_string()
        };
        let files = draft_files(self.root, draft)?;
        let text = fs::read_to_string(self.root.join(&proposal_source))
            .map_err(|_| StartError::Refused(format!("{proposal_source}: no such draft")))?;
        let slug = slug.unwrap_or_else(|| draft_name(draft)).to_string();
        let folder = self.free_folder(&slug, today)?;
        let worktree = place::worktree_path(self.git, &folder);
        if !self.switch && worktree.exists() {
            return Err(GitError::WorktreeExists(format!(".worktrees/{folder}")).into());
        }
        // Which of the draft's files are committed, read before any write of ours.
        let tracked = self.tracked(&files);
        self.check_clean(&files)?;
        let (name, priorities) = self.moved_entry(&proposal_source, &text, &slug, &folder)?;
        Ok(Plan {
            folder_draft,
            files,
            tracked,
            start_subject: format!("chore({slug}): start {name}"),
            proposal_subject: format!("chore({slug}): proposal"),
            destination: format!("specs/{folder}"),
            folder,
            worktree,
            priorities,
        })
    }

    /// The dated folder for a slug, refused when the slug is not one, or when a record, a branch,
    /// or a folder already holds the name.
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
        let taken = self
            .at
            .branches()?
            .iter()
            .any(|branch| branch.name == folder)
            || self.root.join("specs").join(&folder).exists()
            || features.iter().any(|feature| feature.folder == folder);
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
        proposal_source: &str,
        text: &str,
        slug: &str,
        folder: &str,
    ) -> Result<(String, String), StartError> {
        let draft = self.draft;
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
        let target = format!("/specs/{folder}/proposal.md");
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

    /// The start commit, on the default branch.
    fn commit_start(&self, plan: &Plan) -> Result<(), StartError> {
        fs::write(self.root.join("specs/PRIORITIES.md"), &plan.priorities)?;
        // Written, so a failed commit stays here: switching back could carry the staged file away.
        if let Err(error) = self.at.commit(
            &["specs/PRIORITIES.md".to_string()],
            &plan.start_subject,
            None,
        ) {
            let left = vec![
                format!(
                    "commit specs/PRIORITIES.md on {} as \"{}\"",
                    self.default, plan.start_subject
                ),
                format!("create the branch {}", plan.folder),
                format!("move {} to {}", self.draft, plan.destination),
                plan.commit_left(),
            ];
            return Err(partial(&[], left, error));
        }
        Ok(())
    }

    /// The feature's branch, switched to or in its new worktree: the working tree it is in.
    fn create_branch(&self, plan: &Plan, done: &[String]) -> Result<PathBuf, StartError> {
        let folder = &plan.folder;
        let (created, branch_left) = if self.switch {
            (
                self.at.switch_new(folder, self.default),
                format!("create the branch {folder}"),
            )
        } else {
            (
                self.git.exclude_worktrees().and_then(|()| {
                    self.at
                        .add_worktree_new(&plan.worktree, folder, self.default)
                }),
                format!("create the branch {folder} in .worktrees/{folder}"),
            )
        };
        if let Err(error) = created {
            let left = vec![
                branch_left,
                format!("move {} to {}", self.draft, plan.destination),
                plan.commit_left(),
            ];
            return Err(partial(done, left, error));
        }
        Ok(if self.switch {
            self.root.to_path_buf()
        } else {
            fs::canonicalize(&plan.worktree).unwrap_or(plan.worktree.clone())
        })
    }

    /// Moves the draft's files into the dated folder of `target_root`: each move, from and to.
    fn move_draft(
        &self,
        plan: &Plan,
        target_root: &Path,
    ) -> Result<Vec<(String, String)>, StartError> {
        let (root, draft) = (self.root, self.draft);
        let mut moves = Vec::new();
        for file in &plan.files {
            let to = if plan.folder_draft {
                format!(
                    "{}/{}",
                    plan.destination,
                    file.strip_prefix(&format!("{draft}/")).unwrap_or(file)
                )
            } else {
                format!("{}/proposal.md", plan.destination)
            };
            if let Some(parent) = target_root.join(&to).parent() {
                fs::create_dir_all(parent)?;
            }
            if self.switch {
                fs::rename(root.join(file), target_root.join(&to))?;
            } else {
                // The draft as it is here, uncommitted edits included, goes to the new branch; the
                // default branch keeps its committed version.
                fs::copy(root.join(file), target_root.join(&to))?;
                let _ = fs::remove_file(target_root.join(file));
                if plan.tracked.contains(file) {
                    self.at.restore(file)?;
                } else {
                    fs::remove_file(root.join(file))?;
                }
            }
            moves.push((file.clone(), to));
        }
        if plan.folder_draft {
            let _ = fs::remove_dir_all(target_root.join(draft));
            if !self.switch && plan.tracked.is_empty() {
                let _ = fs::remove_dir_all(root.join(draft));
            }
        }
        Ok(moves)
    }

    /// The proposal commit, on the feature's branch.
    fn commit_proposal(
        &self,
        plan: &Plan,
        moves: &[(String, String)],
        target_root: &Path,
        done: &[String],
    ) -> Result<(), StartError> {
        // Folders as pathspecs, so files git ignores, like `.DS_Store`, stay out of the commit.
        let mut paths: Vec<String> = Vec::new();
        if plan.folder_draft {
            paths.push(plan.destination.clone());
            if !plan.tracked.is_empty() {
                paths.push(self.draft.to_string());
            }
        } else {
            for (from, to) in moves {
                paths.push(to.clone());
                if plan.tracked.contains(from) {
                    paths.push(from.clone());
                }
            }
        }
        paths.sort();
        let on_branch = Git::open(target_root)?;
        if let Err(error) = on_branch.commit(&paths, &plan.proposal_subject, None) {
            return Err(partial(done, vec![plan.commit_left()], error));
        }
        Ok(())
    }
}
