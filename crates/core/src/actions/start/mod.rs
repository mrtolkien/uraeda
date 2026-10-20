//! Starting a drafted feature or change, as the skill's start section says: on the default
//! branch, its `PRIORITIES.md` entry moves to the top of **Now** as a link, and the draft moves
//! into the dated folder, unchanged, in one commit; then its branch is created from there. A change
//! typed as a text starts the same way, its proposal written from the text.

use std::path::Path;

use crate::git::{Git, GitError};
use crate::images::Encoded;
use crate::target;
use crate::today::Date;
use crate::workspace::{Kind, Workspace};

use super::place;

mod commits;
mod plan;
mod typed;

use typed::Typed;

/// What a start did.
pub struct Started {
    pub default_branch: String,
    pub start_subject: String,
    /// The dated folder's name: `<date>-<slug>`.
    pub folder: String,
    /// The folder's name for a feature, `change/<folder>` for a change.
    pub branch: String,
    /// The worktree the branch is checked out in, from the main checkout, unless `--switch`.
    pub worktree: Option<String>,
    /// Each file moved, from and to, from the top level.
    pub moves: Vec<(String, String)>,
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
    /// A failure after the first write: what was done, and what is left to do by hand.
    #[error("{cause}")]
    Partial {
        done: Vec<String>,
        left: Vec<String>,
        cause: String,
    },
}

/// Starts the feature or the change written in a draft: its branch in a worktree at
/// `.worktrees/<folder>/`, or, with `switch`, in this working tree, switched to it.
pub fn run(
    git: &Git,
    workspace: &Workspace,
    draft_arg: &str,
    slug: Option<&str>,
    kind: Kind,
    today: Date,
    switch: bool,
) -> Result<Started, StartError> {
    // A postponed folder's `proposal.md` starts the whole folder, images included.
    let draft = target::draft_to_start(draft_arg);
    let source = Source::Draft(draft.as_deref().unwrap_or(draft_arg));
    begin(git, workspace, source, kind, slug, today, switch)
}

/// The slug proposed for a change typed as `text`, from the title [`run_text`] reads in it: empty
/// when no line holds more than spaces and heading marks.
pub fn propose_slug(text: &str) -> String {
    Typed::read(text).map_or_else(String::new, |typed| typed.proposed_slug())
}

/// Starts a change typed as a text: its first written line is the title, and its images are saved
/// in the change's `images/` folder, linked at the end of the proposal. `slug` defaults to the one
/// [`propose_slug`] gives for the text.
pub fn run_text(
    git: &Git,
    workspace: &Workspace,
    text: &str,
    images: &[Encoded],
    slug: Option<&str>,
    today: Date,
    switch: bool,
) -> Result<Started, StartError> {
    let typed = Typed::read(text).ok_or_else(|| {
        StartError::Refused("a change needs a text: its first line is its title".into())
    })?;
    let source = Source::Text {
        typed: &typed,
        images,
    };
    begin(git, workspace, source, Kind::Change, slug, today, switch)
}

/// Reaches the default branch, starts there, and switches back when the start is refused before
/// its first write.
fn begin(
    git: &Git,
    workspace: &Workspace,
    source: Source<'_>,
    kind: Kind,
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
    let result = Start::open(git, &place, workspace, source, kind, &default, switch)
        .and_then(|start| start.run(slug, today));
    if matches!(&result, Err(error) if !matches!(error, StartError::Partial { .. })) {
        place::switch_back(git, &place, previous.as_deref());
    }
    result
}

/// What a start starts from.
#[derive(Clone, Copy)]
enum Source<'a> {
    /// A draft's file or postponed folder, from the top level.
    Draft(&'a str),
    /// A change typed as a text, read, with its encoded images.
    Text {
        typed: &'a Typed,
        images: &'a [Encoded],
    },
}

/// A start under way: where it runs, and what it starts.
struct Start<'a> {
    /// The repository the command runs in.
    git: &'a Git,
    workspace: &'a Workspace,
    /// The working tree on the default branch, and its repository.
    root: &'a Path,
    at: Git,
    source: Source<'a>,
    kind: Kind,
    default: &'a str,
    switch: bool,
}

/// A failure after the first write.
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
        source: Source<'a>,
        kind: Kind,
        default: &'a str,
        switch: bool,
    ) -> Result<Start<'a>, StartError> {
        Ok(Start {
            git,
            workspace,
            root: place.root.as_path(),
            at: Git::open(&place.root)?,
            source,
            kind,
            default,
            switch,
        })
    }

    fn run(&self, slug: Option<&str>, today: Date) -> Result<Started, StartError> {
        let plan = self.plan(slug, today)?;
        let (moves, done) = match self.source {
            Source::Draft(draft) => {
                let moves = self.move_draft(draft, &plan)?;
                (moves, "the move of the draft".to_string())
            }
            Source::Text { typed, images } => {
                self.write_text(typed, &plan, images)?;
                (Vec::new(), format!("the proposal in {}", plan.destination))
            }
        };
        self.commit_start(&plan, &done)?;
        let done = vec![done, format!("the start commit on {}", self.default)];
        self.create_branch(&plan, &done)?;
        Ok(Started {
            default_branch: self.default.to_string(),
            start_subject: plan.start_subject,
            folder: plan.folder.clone(),
            branch: plan.branch.clone(),
            worktree: (!self.switch).then(|| format!(".worktrees/{}", plan.folder)),
            moves,
        })
    }
}
