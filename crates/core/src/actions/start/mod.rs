//! Starting a feature or change from its proposal file, as the skill's start section says: on the
//! default branch, its proposal moves to the top of **Now** in `PRIORITIES.md` as a link, and the
//! proposal file moves into the dated folder, unchanged, in one commit; then its branch is created
//! from there. A change typed as a text starts the same way, its proposal written from the text.

use std::path::Path;

use crate::cache::WriteGuard;
use crate::git::{Git, GitError};
use crate::images::Encoded;
use crate::target;
use crate::today::Date;
use crate::workspace::{Kind, Workspace};

use super::place;

mod commits;
mod line;
mod plan;
mod restore;
mod typed;

pub(crate) use plan::check_free;

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
    /// The start commit refused by a hook, everything the start wrote put back as it was: only
    /// for a start that asked for it, see [`Run::restore`].
    #[error("git commit failed: {message}")]
    Hook { message: String, output: String },
    /// A slug whose dated folder a record, a branch, or a folder already holds.
    #[error("{message}")]
    Taken {
        slug: String,
        kind: Kind,
        message: String,
    },
    /// A failure after the first write: what was done, and what is left to do by hand.
    #[error("{cause}")]
    Partial {
        done: Vec<String>,
        left: Vec<String>,
        cause: String,
    },
}

/// A step of a start under way, as it reaches it.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum StartProgress {
    /// The start commit, its files written.
    Committing,
    /// A line the commit and its hooks printed.
    Output(String),
    /// The branch and its worktree.
    Branching,
    Done,
}

/// How a start runs: its day, where its branch goes, who hears its steps, and what a hook's
/// refusal of its commit leaves.
pub struct Run<'a> {
    pub today: Date,
    /// The branch in this working tree, switched to, rather than in a new worktree.
    pub switch: bool,
    /// Called with each step as the start reaches it, the commit's output streamed.
    pub on_step: Option<&'a dyn Fn(StartProgress)>,
    /// Whether a hook's refusal of the start commit puts back everything the start wrote, as
    /// [`StartError::Hook`], rather than leaving it to commit by hand, as [`StartError::Partial`].
    pub restore: bool,
    /// Takes the repository's write lock, when the start runs beside other writes: it is held to
    /// write and stage the start's files, to put them back on a refusal, and to create the branch,
    /// never while the start commit's hooks run.
    pub(crate) lock: Option<&'a dyn Fn() -> WriteGuard>,
}

impl Run<'_> {
    /// A start as `ura` runs it: no step reported, a refused commit's files left written, and no
    /// write lock.
    pub fn plain(today: Date, switch: bool) -> Run<'static> {
        Run {
            today,
            switch,
            on_step: None,
            restore: false,
            lock: None,
        }
    }

    /// The repository's write lock, held until dropped, when the start takes one.
    fn lock(&self) -> Option<WriteGuard> {
        self.lock.map(|lock| lock())
    }
}

/// What a start would make, every check made and nothing written.
pub struct Planned {
    pub folder: String,
    pub branch: String,
    pub slug: String,
    /// The feature's or the change's name, its line in the priorities.
    pub title: String,
}

/// Starts the feature or the change written in a proposal file: its branch in a worktree at
/// `.worktrees/<folder>/`, or, with `switch`, in this working tree, switched to it.
pub fn run(
    git: &Git,
    workspace: &Workspace,
    proposal_arg: &str,
    slug: Option<&str>,
    kind: Kind,
    today: Date,
    switch: bool,
) -> Result<Started, StartError> {
    let run = Run::plain(today, switch);
    run_with(git, workspace, proposal_arg, slug, kind, &run)
}

/// Starts the feature or the change written in a proposal file, as [`run`] does, the way `run`
/// says.
pub fn run_with(
    git: &Git,
    workspace: &Workspace,
    proposal_arg: &str,
    slug: Option<&str>,
    kind: Kind,
    run: &Run<'_>,
) -> Result<Started, StartError> {
    // A postponed folder's `proposal.md` starts the whole folder, images included.
    let proposal = target::proposal_to_start(proposal_arg);
    let source = Source::Proposal(proposal.as_deref().unwrap_or(proposal_arg));
    begin(git, workspace, source, kind, slug, run)
}

/// What starting the feature or the change written in a proposal file would make, from the
/// working tree at `root`, on the default branch: every check of [`run`] made but those of the
/// uncommitted and staged files, which a write queued before the start may have left and the start
/// makes in its turn, nothing written.
pub fn plan(
    git: &Git,
    root: &Path,
    workspace: &Workspace,
    proposal_arg: &str,
    slug: Option<&str>,
    kind: Kind,
    today: Date,
) -> Result<Planned, StartError> {
    let proposal = target::proposal_to_start(proposal_arg);
    let source = Source::Proposal(proposal.as_deref().unwrap_or(proposal_arg));
    let default = workspace
        .default_branch
        .as_deref()
        .ok_or_else(|| StartError::Refused("no default branch: commit on main first".into()))?;
    let run = Run::plain(today, false);
    let start = Start {
        git,
        workspace,
        root,
        at: Git::open(root)?,
        source,
        kind,
        default,
        run: &run,
    };
    let plan = start.plan(slug, today, false)?;
    Ok(Planned {
        folder: plan.folder,
        branch: plan.branch,
        slug: plan.slug,
        title: plan.name,
    })
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
    let run = Run::plain(today, switch);
    run_text_with(git, workspace, text, images, slug, None, &run)
}

/// Starts a change typed as a text, as [`run_text`] does, the way `run` says. `line` is the text
/// of a line of **Now** the change starts from, as it was read: the one line of **Now** with that
/// text and no link is replaced by the change's link, its nested lines going into the proposal
/// unless the text holds them. When no line, or several, have that text, the link is added and
/// the lines stay.
pub fn run_text_with(
    git: &Git,
    workspace: &Workspace,
    text: &str,
    images: &[Encoded],
    slug: Option<&str>,
    line: Option<&str>,
    run: &Run<'_>,
) -> Result<Started, StartError> {
    let typed = Typed::read(text).ok_or_else(|| {
        StartError::Refused("a change needs a text: its first line is its title".into())
    })?;
    let source = Source::Text {
        typed: &typed,
        images,
        line,
    };
    begin(git, workspace, source, Kind::Change, slug, run)
}

/// Reaches the default branch, starts there, and switches back when the start is refused before
/// its first write.
fn begin(
    git: &Git,
    workspace: &Workspace,
    source: Source<'_>,
    kind: Kind,
    slug: Option<&str>,
    run: &Run<'_>,
) -> Result<Started, StartError> {
    let default = workspace
        .default_branch
        .clone()
        .ok_or_else(|| StartError::Refused("no default branch: commit on main first".into()))?;
    // Held until the start commit runs, which releases it while its hooks run.
    let held = run.lock();
    let previous = git.current_branch();
    let place = if run.switch {
        place::reach_switching(git, &default)?
    } else {
        place::reach(git, &default)?
    };
    let result = Start::open(git, &place, workspace, source, kind, &default, run)
        .and_then(|start| start.run(slug, run.today, held));
    if matches!(&result, Err(error) if !matches!(error, StartError::Partial { .. })) {
        let _lock = run.lock();
        place::switch_back(git, &place, previous.as_deref());
    }
    result
}

/// What a start starts from.
#[derive(Clone, Copy)]
enum Source<'a> {
    /// A proposal file or postponed folder, from the top level.
    Proposal(&'a str),
    /// A change typed as a text, read, with its encoded images, and the text of the line of
    /// **Now** it starts from, if any.
    Text {
        typed: &'a Typed,
        images: &'a [Encoded],
        line: Option<&'a str>,
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
    run: &'a Run<'a>,
}

/// A failure after the first write.
pub(crate) fn partial(done: &[String], left: Vec<String>, cause: impl ToString) -> StartError {
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
        run: &'a Run<'a>,
    ) -> Result<Start<'a>, StartError> {
        Ok(Start {
            git,
            workspace,
            root: place.root.as_path(),
            at: Git::open(&place.root)?,
            source,
            kind,
            default,
            run,
        })
    }

    /// Tells whoever hears the start's steps that it reached `step`.
    fn report(&self, step: StartProgress) {
        if let Some(on_step) = self.run.on_step {
            on_step(step);
        }
    }

    /// Runs the start, `held` the write lock taken before it, if any: released once its files
    /// are staged, and taken again to create the branch.
    fn run(
        &self,
        slug: Option<&str>,
        today: Date,
        held: Option<WriteGuard>,
    ) -> Result<Started, StartError> {
        let plan = self.plan(slug, today, true)?;
        let ((moves, before), done) = match self.source {
            Source::Proposal(proposal) => {
                let moved = self.move_proposal(proposal, &plan)?;
                (moved, "the move of the proposal file".to_string())
            }
            Source::Text { typed, images, .. } => {
                self.write_text(typed, &plan, images)?;
                (
                    Default::default(),
                    format!("the proposal in {}", plan.destination),
                )
            }
        };
        self.commit_start(&plan, &done, (&moves, before), held)?;
        let done = vec![done, format!("the start commit on {}", self.default)];
        self.report(StartProgress::Branching);
        let lock = self.run.lock();
        self.create_branch(&plan, &done)?;
        drop(lock);
        self.report(StartProgress::Done);
        Ok(Started {
            default_branch: self.default.to_string(),
            start_subject: plan.start_subject,
            folder: plan.folder.clone(),
            branch: plan.branch.clone(),
            worktree: (!self.run.switch).then(|| format!(".worktrees/{}", plan.folder)),
            moves,
        })
    }
}
