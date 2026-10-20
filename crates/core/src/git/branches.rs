//! The writes to branches: renaming one, through the system `git` binary, as the git decision
//! says.

use super::{Git, GitError};

impl Git {
    /// Renames the local branch `from` to `to`, wherever it is checked out: its remote branch, if
    /// pushed, keeps its name.
    pub fn rename_branch(&self, from: &str, to: &str) -> Result<(), GitError> {
        self.run("branch", &["branch", "--move", from, to])
    }
}
