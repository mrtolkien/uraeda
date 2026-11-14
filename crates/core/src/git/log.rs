//! Reads of the history: ancestry through gix, and through `git log` what gix does not give, its
//! output parsed only in its `--format` forms, as the git decision says.

use super::{Git, GitError, ObjectId};

impl Git {
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

    /// The commit that approved revision `revision` of the spec at `spec`, a path from the top
    /// level: the first commit of the last run of commits on the first-parent history from `base`
    /// to `tip` whose spec reads `status: approved` and that revision, so a spec reopened and
    /// approved again at the same revision is approved from its last approval. `None` when no
    /// commit there does, or when the spec at `base` does already: the approval was not on this
    /// branch.
    pub fn approval_commit(
        &self,
        tip: ObjectId,
        base: ObjectId,
        spec: &str,
        revision: Option<i64>,
    ) -> Result<Option<ObjectId>, GitError> {
        if self.approved_at(base, spec, revision)? {
            return Ok(None);
        }
        let range = format!("{base}..{tip}");
        let output = self.output(
            "log",
            &[
                "log",
                "--first-parent",
                "--format=%H",
                "--reverse",
                &range,
                "--",
                spec,
            ],
        )?;
        let mut approval = None;
        for line in output.lines() {
            let Ok(commit) = ObjectId::from_hex(line.trim().as_bytes()) else {
                continue;
            };
            if !self.approved_at(commit, spec, revision)? {
                approval = None;
            } else if approval.is_none() {
                approval = Some(commit);
            }
        }
        Ok(approval)
    }

    /// Whether the spec at `spec` reads `status: approved` and revision `revision` at a commit.
    fn approved_at(
        &self,
        commit: ObjectId,
        spec: &str,
        revision: Option<i64>,
    ) -> Result<bool, GitError> {
        let Some(bytes) = self.read_file(commit, spec)? else {
            return Ok(false);
        };
        let text = String::from_utf8_lossy(&bytes);
        Ok(crate::files::frontmatter::parse(&text).is_ok_and(|front| {
            front.text("status") == Some("approved") && front.integer("revision") == revision
        }))
    }
}
