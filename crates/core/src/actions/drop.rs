//! Dropping a started feature or change the human gives up: its **Now** entry leaves the
//! priorities, on the default branch, and its worktree is removed unless that would lose work. Its
//! branch always stays, so nothing is lost (see `specs/decisions/git.md`).

use std::fs;

use crate::actions::ActionError;
use crate::actions::clean::{self, Left};
use crate::actions::commit::add_alone;
use crate::actions::place::{self, Place};
use crate::actions::priorities::PATH;
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
    /// Whether the entry's removal was committed: not when no entry linked it, or when it stays
    /// written, uncommitted, beside the priorities' other changes or after a hook refused it.
    pub committed: bool,
}

/// Drops the started feature or change of `folder`: removes the entry linking its proposal, and
/// commits that alone when the priorities had no other change, then removes its worktree, never
/// forced. Refused for a folder not started, or done.
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
    let removed = remove_entry(&place, feature)?;
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

/// Removes the entry linking the feature's proposal, `chore(<slug>): drop <entry>`: whether the
/// removal was committed, or `None` when no entry links it.
fn remove_entry(place: &Place, feature: &Feature) -> Result<Option<bool>, ActionError> {
    let file = place.root.join(PATH);
    let text = fs::read_to_string(&file).unwrap_or_default();
    let proposal = format!("{}/proposal.md", folder_path(feature.kind, &feature.folder));
    let Some((without, name)) = priorities::remove_linked(&text, &proposal) else {
        return Ok(None);
    };
    let slug = folder_slug(&feature.folder).unwrap_or(&feature.folder);
    let subject = format!("chore({slug}): drop {name}");
    let ((), added) = add_alone(place, PATH, subject, || Ok(fs::write(&file, without)?))?;
    Ok(Some(added.committed))
}
