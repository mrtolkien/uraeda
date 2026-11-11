//! Who works in a repository's checkouts: the Git page's writes wait while an agent writes the
//! same checkout, a chat's the main one, a feature's its worktree.

use std::path::Path;

use crate::live::Fault;
use crate::shared::Shared;

use crate::runner::{Runner, refusals};

/// Whether a chat's agent works in a repository's main checkout: a session without a feature
/// has a turn running, starting, or queued.
pub(super) fn chat(shared: &Shared, repository: &Path) -> bool {
    let runner = Runner::find(shared);
    runner.is_some_and(|runner| runner.chat_working(&repository.to_string_lossy()))
}

/// The folders of a repository's features whose agent works.
pub(super) fn folders(shared: &Shared, repository: &Path) -> Vec<String> {
    let runner = Runner::find(shared);
    runner.map_or_else(Vec::new, |runner| {
        runner.working(&repository.to_string_lossy())
    })
}

/// The checkouts a write of the page writes.
pub(super) struct Touches {
    /// The main checkout.
    main: bool,
    /// The worktree of the feature in this folder.
    folder: Option<String>,
}

impl Touches {
    /// The main checkout alone.
    pub(super) fn main() -> Touches {
        Touches::group(None)
    }

    /// A group's checkout: the main one for no folder, else the feature's worktree.
    pub(super) fn group(folder: Option<&str>) -> Touches {
        Touches {
            main: folder.is_none(),
            folder: folder.map(str::to_owned),
        }
    }

    /// The main checkout, and a feature's worktree when there is one.
    pub(super) fn both(folder: Option<&str>) -> Touches {
        Touches {
            main: true,
            ..Touches::group(folder)
        }
    }
}

/// Whether a write may land in the checkouts it touches.
///
/// # Errors
///
/// `refused` while an agent works in one of them.
pub(super) fn writable(shared: &Shared, repository: &Path, touches: &Touches) -> Result<(), Fault> {
    if touches.main && chat(shared, repository) {
        return Err(Fault::refused(refusals::CHAT_WORKS));
    }
    let works = |folder: &String| folders(shared, repository).contains(folder);
    if touches.folder.as_ref().is_some_and(works) {
        return Err(Fault::refused(refusals::WORKING));
    }
    Ok(())
}
