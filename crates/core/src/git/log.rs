//! Reads of the history: ancestry through gix, and through `git log` what gix does not give, its
//! output parsed only in its `--format` forms, as the git decision says.

use super::{Git, GitError, ObjectId};

impl Git {
    /// How many commits of `branch` are on none of `bases`, a commit counting as there when a base
    /// has it or a patch-equivalent one.
    pub fn unmerged_commits(&self, branch: &str, bases: &[&str]) -> Result<usize, GitError> {
        let mut lists: Vec<std::collections::BTreeSet<String>> = Vec::new();
        for base in bases {
            let range = format!("{base}...{branch}");
            let output = self.output(
                "log",
                &[
                    "log",
                    "--cherry-pick",
                    "--right-only",
                    "--format=%H",
                    &range,
                ],
            )?;
            lists.push(output.lines().map(String::from).collect());
        }
        let Some(first) = lists.first() else {
            return Ok(0);
        };
        Ok(first
            .iter()
            .filter(|commit| lists.iter().all(|list| list.contains(*commit)))
            .count())
    }

    /// Whether `ancestor` is `of` or one of its ancestors.
    pub fn is_ancestor(&self, ancestor: ObjectId, of: ObjectId) -> bool {
        ancestor == of
            || self
                .repo
                .merge_base(ancestor, of)
                .is_ok_and(|base| base.is_some_and(|base| base.detach() == ancestor))
    }

    /// How many commits `remote` has that `local` lacks.
    pub fn behind(&self, local: ObjectId, remote: ObjectId) -> usize {
        self.repo
            .rev_walk([remote])
            .with_hidden([local])
            .all()
            .map(|walk| walk.filter_map(Result::ok).count())
            .unwrap_or(0)
    }
}
