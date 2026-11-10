//! Who works in a repository's checkouts: the Git page's writes wait while an agent writes the
//! same checkout, a chat's the main one, a feature's its worktree.

use std::path::Path;

use crate::live::Fault;
use crate::shared::Shared;

/// Why the main checkout's writes are refused while a chat's agent works in it.
const CHAT_WORKS: &str = "An agent works in this checkout: wait for its turn to end.";

/// Why a feature's writes are refused while its agent works.
const FEATURE_WORKS: &str = "An agent is working on this feature. Stop it first, or wait for it.";

/// Whether a chat's agent works in a repository's main checkout: a session without a feature
/// has a turn running, starting, or queued.
///
/// TEMPORARY: no session runs yet, so no agent works: the sessions answer (task 15).
pub(super) fn chat(_: &Shared, _repository: &Path) -> bool {
    false
}

/// The folders of a repository's features whose agent works.
///
/// TEMPORARY: no session runs yet, so no agent works: the sessions answer (task 15).
pub(super) fn folders(_: &Shared, _repository: &Path) -> Vec<String> {
    Vec::new()
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
        return Err(Fault::refused(CHAT_WORKS));
    }
    let works = |folder: &String| folders(shared, repository).contains(folder);
    if touches.folder.as_ref().is_some_and(works) {
        return Err(Fault::refused(FEATURE_WORKS));
    }
    Ok(())
}
