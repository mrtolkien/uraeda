//! Making a change a feature, in place, as the skill's change section says: on the default branch,
//! its **Now** proposal links the feature's folder, and the folder the start put there moves from
//! `specs/changes/` to `specs/`, in one commit; then its branch loses its `change/` prefix, and on
//! it, its folder moves the same way, and each decision it applied is proposed again, in a second
//! commit. Its worktree and its commits stay,
//! and a pushed branch is renamed locally only.

use std::fs;
use std::path::Path;

use crate::decisions::{BranchSides, branch_changes};
use crate::files::{frontmatter, priorities};
use crate::git::Git;
use crate::steps::StepName;
use crate::workspace::{Feature, Kind, Workspace, folder_branch, folder_path, resolve};

use super::place;
use super::start::{StartError, check_free, partial};

/// The refusal of a change with an open pull request, whose branch the move would rename.
pub const PULL_REQUEST: &str =
    "This change has a pull request: close it first, since its branch would be renamed";

/// What a move did.
pub struct Promoted {
    /// The dated folder's name, the same before and after.
    pub folder: String,
    /// The feature's branch, the folder's name.
    pub branch: String,
    /// The commit relinking the **Now** proposal, and moving the folder there, on the default
    /// branch.
    pub default_subject: String,
    /// The commit moving the folder, on the branch.
    pub subject: String,
    /// The decisions the change applied, proposed again for the feature's spec.
    pub decisions: Vec<String>,
}

/// Makes the change in `folder` a feature, in place: refused, before anything is written, for a
/// feature, a change done or with a pull request, uncommitted changes in its worktree or in its
/// folder on the default branch, or a feature's name already taken.
pub fn run(git: &Git, workspace: &Workspace, folder: &str) -> Result<Promoted, StartError> {
    let refused = |message: String| StartError::Refused(message);
    let change = workspace
        .features
        .iter()
        .find(|item| item.folder == folder && item.kind == Kind::Change && !item.is_finished())
        .ok_or_else(|| refused(format!("{folder} is not a change")))?;
    if change.step.name == StepName::Done {
        return Err(refused(format!("{folder} is done: ura clean removes it")));
    }
    if change.pull_request.is_some() {
        return Err(refused(PULL_REQUEST.into()));
    }
    let default = workspace
        .default_branch
        .clone()
        .ok_or_else(|| refused("no default branch: commit on main first".into()))?;
    let from = folder_branch(Kind::Change, folder);
    if let Some(worktree) = git
        .worktrees()?
        .into_iter()
        .find(|worktree| worktree.branch.as_deref() == Some(from.as_str()))
    {
        check_worktree(git, &worktree.path, folder)?;
    }
    let place = place::reach(git, &default)?;
    let at = Git::open(&place.root)?;
    let hint = "rename or remove that branch or folder first";
    let on_default = check_on_default(&at, folder, &default)?;
    let (name, edited) = relinked(&place.root, change)?;
    // A move run again after its first commit: the default branch holds the feature's folder and
    // proposal already, so only the branch's name must be free.
    let resumed = edited.is_none()
        && !on_default
        && place.root.join(folder_path(Kind::Feature, folder)).exists();
    let to = folder_branch(Kind::Feature, folder);
    if !resumed {
        check_free(&place.root, &at, workspace, folder, &[Kind::Feature], hint)?;
    } else if at.branches()?.iter().any(|branch| branch.name == to) {
        return Err(refused(format!("{folder} exists: {hint}")));
    }
    let move_ = Move {
        git,
        folder,
        slug: &change.slug,
        from,
        to,
        default: &default,
        on_default,
    };
    move_.run(&at, &name, edited.as_deref())
}

/// Refuses the move while the change's worktree, at `path`, has uncommitted changes, or untracked
/// files in the change's folder or the decisions: its commit would carry them. The main checkout's
/// do not refuse it: its commit takes `PRIORITIES.md` alone.
fn check_worktree(git: &Git, path: &Path, folder: &str) -> Result<(), StartError> {
    let at = Git::open(path)?;
    let mut changed = at.changed_files()?;
    let committed = [folder_path(Kind::Change, folder), "specs/decisions".into()];
    changed.extend(at.untracked(&committed.each_ref().map(String::as_str))?);
    if changed.is_empty() {
        return Ok(());
    }
    let main_root = git.main_root();
    let shown = path.strip_prefix(&main_root).unwrap_or(path);
    Err(StartError::Refused(format!(
        "cannot move: the change's worktree {} has uncommitted changes in {}",
        shown.display(),
        changed.join(", ")
    )))
}

/// Whether the change's folder is on the default branch, checked out at `at`, as a start puts it:
/// refused while it has uncommitted changes there, which its move would carry.
fn check_on_default(at: &Git, folder: &str, default: &str) -> Result<bool, StartError> {
    let old = folder_path(Kind::Change, folder);
    if !at.root().join(&old).exists() {
        return Ok(false);
    }
    let inside = format!("{old}/");
    let mut changed: Vec<String> = at
        .changed_files()?
        .into_iter()
        .filter(|path| path.starts_with(&inside))
        .collect();
    changed.extend(at.untracked(&[old.as_str()])?);
    if changed.is_empty() {
        return Ok(true);
    }
    Err(StartError::Refused(format!(
        "cannot move: {default} has uncommitted changes in {}",
        changed.join(", ")
    )))
}

/// A move under way: the change, its branch's names before and after, and whether its folder is
/// on the default branch.
struct Move<'a> {
    git: &'a Git,
    folder: &'a str,
    slug: &'a str,
    from: String,
    to: String,
    default: &'a str,
    on_default: bool,
}

impl Move<'_> {
    /// The two commits and the rename between them: a failure after the first commit says what
    /// was done and what is left.
    fn run(&self, at: &Git, name: &str, edited: Option<&str>) -> Result<Promoted, StartError> {
        let (folder, slug) = (self.folder, self.slug);
        let default_subject = format!("chore({slug}): start {name} as a feature");
        let subject = format!("chore({slug}): upgrade to a feature");
        let (old, new) = (
            folder_path(Kind::Change, folder),
            folder_path(Kind::Feature, folder),
        );
        let rename_left = format!("rename the branch {} to {}", self.from, self.to);
        let move_left = format!("move {old} to {new} on {}", self.to);
        let commit_left = format!(
            "set each decision the change applied back to proposed, and commit them with both \
             folders as \"{subject}\""
        );
        if edited.is_some() || self.on_default {
            self.relink(
                at,
                edited,
                &default_subject,
                [&rename_left, &move_left, &commit_left],
            )?;
        }
        let mut done = vec![if self.on_default {
            format!(
                "the proposal in Now relinked, and {old} moved to {new}, on {}",
                self.default
            )
        } else {
            format!("the proposal in Now, relinked on {}", self.default)
        }];
        if let Err(error) = self.git.rename_branch(&self.from, &self.to) {
            return Err(partial(
                &done,
                vec![rename_left, move_left, commit_left],
                error,
            ));
        }
        done.push(format!("the branch renamed to {}", self.to));
        let root = place::reach(self.git, &self.to)
            .map_err(|error| partial(&done, vec![move_left.clone(), commit_left.clone()], error))?
            .root;
        if let Err(error) = fs::rename(root.join(&old), root.join(&new)) {
            return Err(partial(&done, vec![move_left, commit_left], error));
        }
        done.push(format!("the move of {old} to {new}"));
        let on_branch = Git::open(&root)?;
        let decisions = self
            .propose_again(&on_branch, &root)
            .map_err(|error| partial(&done, vec![commit_left.clone()], error))?;
        let mut paths = vec![old, new];
        paths.extend(decisions.iter().map(|name| decision_path(name)));
        if let Err(error) = on_branch.commit(&paths, &subject, None) {
            let left = vec![format!(
                "commit {} as \"{subject}\"",
                crate::actions::list(&paths)
            )];
            return Err(partial(&done, left, error));
        }
        Ok(Promoted {
            folder: folder.to_string(),
            branch: self.to.clone(),
            default_subject,
            subject,
            decisions,
        })
    }

    /// Writes the relinked priorities, when they change, and moves the change's folder, when the
    /// default branch has it, then commits them there: a refused commit puts both back as they
    /// were, so a move run again relinks and commits them, and leaves every step.
    fn relink(
        &self,
        at: &Git,
        edited: Option<&str>,
        subject: &str,
        rest: [&String; 3],
    ) -> Result<(), StartError> {
        let root = at.root();
        let (old, new) = (
            folder_path(Kind::Change, self.folder),
            folder_path(Kind::Feature, self.folder),
        );
        // The priorities as they were, the main checkout's own edits kept: `None` when absent.
        let before = fs::read_to_string(root.join(PRIORITIES)).ok();
        let restore = || {
            if edited.is_some() {
                let _ = match &before {
                    Some(text) => fs::write(root.join(PRIORITIES), text),
                    None => fs::remove_file(root.join(PRIORITIES)),
                };
            }
        };
        let mut paths = Vec::new();
        if let Some(edited) = edited {
            fs::write(root.join(PRIORITIES), edited)?;
            paths.push(PRIORITIES.to_string());
        }
        if self.on_default {
            fs::rename(root.join(&old), root.join(&new)).inspect_err(|_| restore())?;
            paths.extend([old.clone(), new.clone()]);
        }
        at.commit(&paths, subject, None).map_err(|error| {
            restore();
            if self.on_default {
                let _ = fs::rename(root.join(&new), root.join(&old));
            }
            let (what, them, back) = match (edited.is_some(), self.on_default) {
                (true, true) => (
                    format!("relink the proposal in Now, and move {old} to {new},"),
                    "them",
                    format!("{PRIORITIES} and the folder"),
                ),
                (false, true) => (format!("move {old} to {new}"), "it", "the folder".into()),
                _ => (
                    "relink the proposal in Now".into(),
                    "it",
                    PRIORITIES.to_string(),
                ),
            };
            let mut left = vec![format!(
                "{what} on {}, and commit {them} as \"{subject}\": the refused commit put {back} \
                 back",
                self.default
            )];
            left.extend(rest.into_iter().cloned());
            partial(&[], left, error)
        })
    }

    /// Sets each decision the branch changed, and that reads `active`, back to `proposed`, its
    /// `approved-by` emptied: their names.
    fn propose_again(&self, on_branch: &Git, root: &Path) -> Result<Vec<String>, StartError> {
        let sides = BranchSides {
            git: on_branch,
            disk: Some(root),
            tip: on_branch.head(),
            default: self.git.tip(self.default),
        };
        let mut proposed = Vec::new();
        for change in branch_changes(&sides, &[]) {
            let path = root.join(decision_path(&change.name));
            let Ok(text) = fs::read_to_string(&path) else {
                continue;
            };
            let active = frontmatter::parse(&text)
                .is_ok_and(|fields| fields.text("status") == Some("active"));
            if !active {
                continue;
            }
            let mut edited = frontmatter::set(&text, "status", "proposed");
            if frontmatter::parse(&text).is_ok_and(|fields| fields.get("approved-by").is_some()) {
                edited = frontmatter::set(&edited, "approved-by", "");
            }
            fs::write(&path, edited)?;
            proposed.push(change.name);
        }
        Ok(proposed)
    }
}

const PRIORITIES: &str = "specs/PRIORITIES.md";

fn decision_path(name: &str) -> String {
    format!("specs/decisions/{name}.md")
}

/// The proposal's name, and `PRIORITIES.md` with its line linking the change's proposal linking the
/// feature's, or a new one on top of **Now** when none links it. Nothing to write when a proposal
/// already links the feature's: a move run again after a failure relinked it.
fn relinked(root: &Path, change: &Feature) -> Result<(String, Option<String>), StartError> {
    let text = fs::read_to_string(root.join(PRIORITIES)).unwrap_or_default();
    let old = format!("{}/proposal.md", folder_path(Kind::Change, &change.folder));
    let target = format!(
        "/{}/proposal.md",
        folder_path(Kind::Feature, &change.folder)
    );
    let proposals = priorities::parse(&text);
    let linking = |path: &str| {
        proposals.iter().find(|proposal| {
            proposal
                .link
                .as_deref()
                .and_then(|link| resolve("specs", link))
                .as_deref()
                == Some(path)
        })
    };
    if let Some(proposal) = linking(&target[1..]) {
        return Ok((proposal.text.clone(), None));
    }
    match linking(&old) {
        Some(proposal) => {
            let edited = priorities::link(&text, proposal.line, &target)
                .ok_or_else(|| StartError::Refused("cannot relink the proposal".into()))?;
            Ok((proposal.text.clone(), Some(edited)))
        }
        None => {
            let name = change.slug.clone();
            let edited = priorities::add_started(&text, &name, &target);
            Ok((name, Some(edited)))
        }
    }
}
