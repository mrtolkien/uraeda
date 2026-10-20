//! The writes to branches: renaming one, through the system `git` binary, as the git decision
//! says.

use super::{Git, GitError};

impl Git {
    /// Renames the local branch `from` to `to`, wherever it is checked out: its remote branch, if
    /// pushed, keeps its name, and is no longer its upstream, so that a later `git push -u` sets
    /// the new one.
    pub fn rename_branch(&self, from: &str, to: &str) -> Result<(), GitError> {
        let upstream = self.output(
            "for-each-ref",
            &[
                "for-each-ref",
                "--format=%(upstream)",
                &format!("refs/heads/{from}"),
            ],
        )?;
        self.run("branch", &["branch", "--move", from, to])?;
        if upstream.trim().is_empty() {
            return Ok(());
        }
        self.run("branch", &["branch", "--unset-upstream", to])
    }
}
