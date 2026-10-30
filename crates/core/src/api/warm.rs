//! What a watch reads ahead, on its own thread, once it starts: what the core keeps for the
//! process by the commits it was read from, the ledger's dates and each feature's figures, which
//! the first read of a page would otherwise read from the whole history. Nothing it reads can go
//! stale, so the read cache's generations are left alone.

use std::path::Path;

use super::ledger;
use crate::git::Git;
use crate::history;
use crate::workspace::Workspace;

/// Reads the ledger's dates, then each feature's history, of the repository holding `root`. A
/// read that fails is left for the page to read.
pub(crate) fn warm(root: &Path) {
    let Ok(git) = Git::discover(root) else {
        return;
    };
    ledger::warm_dates(&git);
    let Ok(workspace) = Workspace::read(&git) else {
        return;
    };
    let default = workspace.default_branch.as_deref();
    for feature in &workspace.features {
        let _ = history::read(&git, default, feature);
    }
}
