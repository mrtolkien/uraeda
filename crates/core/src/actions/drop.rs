//! Dropping a started feature or change the human gives up: its **Now** entry leaves the
//! priorities, and its folder the start put there leaves the default branch, in one commit, and its
//! worktree is removed unless that would lose work. Its branch always stays, so nothing is lost
//! (see `specs/decisions/git.md`).

use std::fs;

use crate::actions::clean::{self, Left};
use crate::actions::commit::{commit_only, is_clean};
use crate::actions::place::{self, Place};
use crate::actions::priorities::PATH;
use crate::actions::{ActionError, Change};
use crate::files::priorities;
use crate::git::Git;
use crate::steps::StepName;
use crate::workspace::{Feature, Workspace, folder_branch, folder_path, folder_slug};

/// A feature or a change dropped.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Dropped {
    /// Its branch, kept.
    pub branch: String,
    /// Its worktree, when it stays, and why.
    pub worktree: Option<Left>,
    /// Whether the entry's and the folder's removal was committed: not when neither was on the
    /// default branch, or when it stays written, uncommitted, beside the priorities' other changes
    /// or after a hook refused it.
    pub committed: bool,
}

/// Drops the started feature or change of `folder`: removes the entry linking its proposal, and its
/// folder on the default branch, and commits them alone when the priorities had no other change,
/// then removes its worktree, never forced. Refused for a folder not started, or done, or whose
/// folder on the default branch has uncommitted changes.
pub fn run(git: &Git, workspace: &Workspace, folder: &str) -> Result<Dropped, ActionError> {
    let feature = workspace
        .feature(folder)
        .ok_or_else(|| ActionError::Refused(format!("no feature or change {folder}")))?;
    if feature.step.name == StepName::Done {
        return Err(ActionError::Refused(format!(
            "{folder} is done: ura clean removes it"
        )));
    }
    let default = workspace
        .default_branch
        .as_deref()
        .ok_or_else(|| ActionError::Refused("no default branch: commit on main first".into()))?;
    // Every read and write goes through the main checkout: the caller's working tree may be the
    // worktree removed below.
    let here = git.root().to_path_buf();
    let main_root = git.main_root();
    let git = &Git::open(&main_root)?;
    let place = place::reach(git, default).map_err(|e| ActionError::Refused(e.to_string()))?;
    let removed = remove_from_default(&place, feature, default)?;
    let committed = removed == Some(true);
    let branch = folder_branch(feature.kind, folder);
    let worktree = match clean::worktree(git, &main_root, &here, &branch, false) {
        Ok(Some(Err(left))) => Some(left),
        Ok(Some(Ok(_)) | None) => None,
        Err(error) if removed.is_some() => {
            return Err(ActionError::Io(format!(
                "the entry was removed from {PATH}, but its worktree was not: {error}"
            )));
        }
        Err(error) => return Err(error),
    };
    Ok(Dropped {
        branch,
        worktree,
        committed,
    })
}

/// Removes the entry linking the feature's proposal, and its folder on the default branch, in
/// `chore(<slug>): drop <entry>`: whether the removal was committed, or `None` when the default
/// branch has neither.
fn remove_from_default(
    place: &Place,
    feature: &Feature,
    default: &str,
) -> Result<Option<bool>, ActionError> {
    let folder = folder_path(feature.kind, &feature.folder);
    let on_default = place.root.join(&folder).exists();
    if on_default {
        check_folder(place, &folder, default)?;
    }
    let file = place.root.join(PATH);
    let text = fs::read_to_string(&file).unwrap_or_default();
    let removed = priorities::remove_linked(&text, &format!("{folder}/proposal.md"));
    if removed.is_none() && !on_default {
        return Ok(None);
    }
    let slug = folder_slug(&feature.folder).unwrap_or(&feature.folder);
    let mut paths = Vec::new();
    // Other changes to the priorities are someone's work in progress: the removal stays beside
    // them, uncommitted.
    let mut clean = true;
    let name = match removed {
        Some((without, name)) => {
            clean = is_clean(place, PATH);
            fs::write(&file, without)?;
            paths.push(PATH.to_string());
            name
        }
        None => slug.to_string(),
    };
    if on_default {
        fs::remove_dir_all(place.root.join(&folder))?;
        paths.push(folder);
    }
    if !clean {
        return Ok(Some(false));
    }
    let change = Change {
        paths,
        subject: format!("chore({slug}): drop {name}"),
        body: None,
    };
    match commit_only(place, &change) {
        Ok(_) => Ok(Some(true)),
        Err(ActionError::Hook { .. }) => Ok(Some(false)),
        Err(error) => Err(error),
    }
}

/// Refuses the drop while the item's folder on the default branch has uncommitted changes: they
/// would be lost with it.
fn check_folder(place: &Place, folder: &str, default: &str) -> Result<(), ActionError> {
    let at = Git::open(&place.root)?;
    let inside = format!("{folder}/");
    let mut changed: Vec<String> = at
        .changed_files()?
        .into_iter()
        .filter(|path| path.starts_with(&inside))
        .collect();
    changed.extend(at.untracked(&[folder])?);
    if changed.is_empty() {
        return Ok(());
    }
    Err(ActionError::Refused(format!(
        "cannot drop: {default} has uncommitted changes in {}",
        changed.join(", ")
    )))
}
