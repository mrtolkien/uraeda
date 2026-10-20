//! Making a change a feature, in place, as the skill's change section says: on the default branch,
//! its **Now** entry links the feature's folder and is committed; then its branch loses its
//! `change/` prefix, and on it, its folder moves from `specs/changes/` to `specs/`, and each
//! decision it applied is proposed again, in a second commit. Its worktree and its commits stay,
//! and a pushed branch is renamed locally only.

use std::fs;
use std::path::Path;

use crate::decisions::{BranchSides, branch_changes};
use crate::files::{frontmatter, priorities};
use crate::git::Git;
use crate::workspace::{Feature, Kind, Workspace, folder_branch, folder_path, resolve};

use super::place;
use super::start::{StartError, check_clean, check_free, partial};

/// The refusal of a change with an open pull request, whose branch the move would rename.
pub const PULL_REQUEST: &str =
    "This change has a pull request: close it first, since its branch would be renamed";

/// What a move did.
pub struct Promoted {
    /// The dated folder's name, the same before and after.
    pub folder: String,
    /// The feature's branch, the folder's name.
    pub branch: String,
    /// The commit relinking the **Now** entry, on the default branch.
    pub default_subject: String,
    /// The commit moving the folder, on the branch.
    pub subject: String,
    /// The decisions the change applied, proposed again for the feature's spec.
    pub decisions: Vec<String>,
}

/// Makes the change in `folder` a feature, in place: refused, before anything is written, for a
/// feature, a change with a pull request, uncommitted changes, or a feature's name already taken.
pub fn run(git: &Git, workspace: &Workspace, folder: &str) -> Result<Promoted, StartError> {
    let refused = |message: String| StartError::Refused(message);
    let change = workspace
        .features
        .iter()
        .find(|item| item.folder == folder && item.kind == Kind::Change && !item.is_finished())
        .ok_or_else(|| refused(format!("{folder} is not a change")))?;
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
        check_clean(&Git::open(&worktree.path)?, &[])?;
    }
    let place = place::reach(git, &default)?;
    let at = Git::open(&place.root)?;
    check_free(&place.root, &at, workspace, folder, &[Kind::Feature])?;
    check_clean(&at, &[])?;
    let (name, edited) = relinked(&place.root, change)?;
    let move_ = Move {
        git,
        folder,
        slug: &change.slug,
        from,
        to: folder_branch(Kind::Feature, folder),
        default: &default,
    };
    move_.run(&at, &name, &edited)
}

/// A move under way: the change, and its branch's names before and after.
struct Move<'a> {
    git: &'a Git,
    folder: &'a str,
    slug: &'a str,
    from: String,
    to: String,
    default: &'a str,
}

impl Move<'_> {
    /// The two commits and the rename between them: a failure after the first commit says what
    /// was done and what is left.
    fn run(&self, at: &Git, name: &str, edited: &str) -> Result<Promoted, StartError> {
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
        fs::write(at.root().join(PRIORITIES), edited)?;
        if let Err(error) = at.commit(&[PRIORITIES.to_string()], &default_subject, None) {
            let left = vec![
                format!(
                    "commit {PRIORITIES} on {} as \"{default_subject}\"",
                    self.default
                ),
                rename_left,
                move_left,
                commit_left,
            ];
            return Err(partial(&[], left, error));
        }
        let mut done = vec![format!("the entry in Now, relinked on {}", self.default)];
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

/// The entry's name, and `PRIORITIES.md` with the entry linking the change's proposal linking the
/// feature's, or a new one on top of **Now** when none links it.
fn relinked(root: &Path, change: &Feature) -> Result<(String, String), StartError> {
    let text = fs::read_to_string(root.join(PRIORITIES)).unwrap_or_default();
    let old = format!("{}/proposal.md", folder_path(Kind::Change, &change.folder));
    let target = format!(
        "/{}/proposal.md",
        folder_path(Kind::Feature, &change.folder)
    );
    let entry = priorities::parse(&text).into_iter().find(|entry| {
        entry
            .link
            .as_deref()
            .and_then(|link| resolve("specs", link))
            == Some(old.clone())
    });
    match entry {
        Some(entry) => {
            let edited = priorities::link(&text, entry.line, &target)
                .ok_or_else(|| StartError::Refused("cannot relink the entry".into()))?;
            Ok((entry.text, edited))
        }
        None => {
            let name = change.slug.clone();
            let edited = priorities::add_started(&text, &name, &target);
            Ok((name, edited))
        }
    }
}
