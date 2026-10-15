//! Starting a drafted feature, as the skill's start section says: on the default branch, its
//! `PRIORITIES.md` entry moves to the end of **Now** as a link and is committed; then its branch
//! is created, and the draft moves into the dated folder, unchanged, in a second commit.

use std::path::Path;

use crate::git::{Git, GitError};
use crate::today::Date;
use crate::workspace::Workspace;

use super::place;

mod commits;
mod plan;

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
}
