//! Reads of the history: ancestry through gix, and through `git log` what gix does not give, its
//! output parsed only in its `--format` forms, as the git decision says.

use super::{CommitInfo, Git, GitError, ObjectId};

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

    /// The date of the last commit of `revision` touching each file under `dir`, as `YYYY-MM-DD`,
    /// by path from the top level, from one `git log`: a file no commit touched has none.
    pub fn last_changes(
        &self,
        revision: &str,
        dir: &str,
    ) -> Result<std::collections::BTreeMap<String, String>, GitError> {
        let output = self.output(
            "log",
            &[
                "-c",
                "core.quotepath=false",
                "log",
                "--format=%x01%cs",
                "--name-only",
                revision,
                "--",
                dir,
            ],
        )?;
        let mut dates = std::collections::BTreeMap::new();
        let mut date = "";
        for line in output.lines() {
            if let Some(committed) = line.strip_prefix('\u{1}') {
                date = committed;
            } else if !line.is_empty() {
                dates
                    .entry(line.to_string())
                    .or_insert_with(|| date.to_string());
            }
        }
        Ok(dates)
    }

    /// The commits of the history from `tip` that touch `path`, a path from the top level, the
    /// newest first, a child before its parents. The history of a merged branch is in it, and the
    /// merge commit itself only when it changes `path` against every parent.
    pub fn path_changes(&self, tip: ObjectId, path: &str) -> Result<Vec<ObjectId>, GitError> {
        let tip = tip.to_string();
        let output = self.output(
            "log",
            &["log", "--topo-order", "--format=%H", &tip, "--", path],
        )?;
        Ok(output
            .lines()
            .filter_map(|line| ObjectId::from_hex(line.trim().as_bytes()).ok())
            .collect())
    }

    /// The first-parent line from `tip`, newest first, of the commits committed from `since` to
    /// `until`, in Unix seconds: git stops at the first commit committed before `since`, and walks
    /// past those committed after `until`, which gix's walk cannot bound by both.
    pub fn first_parent_line(
        &self,
        tip: ObjectId,
        since: i64,
        until: i64,
    ) -> Result<Vec<CommitInfo>, GitError> {
        let (tip, since, until) = (
            tip.to_string(),
            format!("--since=@{since}"),
            format!("--until=@{until}"),
        );
        let args = [
            "log",
            "--first-parent",
            "--format=%H%x00%P%x00%at%x00%ct%x00%s",
            &since,
            &until,
            &tip,
        ];
        let output = self.output("log", &args)?;
        Ok(output.lines().filter_map(commit_info).collect())
    }

    /// The newest first-parent commit from `tip` that added `path`, a path from the top level: git
    /// stops there, so the commits older than it cost nothing.
    pub fn first_parent_addition(
        &self,
        tip: ObjectId,
        path: &str,
    ) -> Result<Option<ObjectId>, GitError> {
        let tip = tip.to_string();
        let args = [
            "log",
            "--first-parent",
            "--diff-filter=A",
            "-1",
            "--format=%H",
            &tip,
            "--",
            path,
        ];
        let output = self.output("log", &args)?;
        Ok(ObjectId::from_hex(output.trim().as_bytes()).ok())
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

/// A commit of `first_parent_line`'s format: its id, its parents, its author and committer times,
/// and its subject, separated by NULs.
fn commit_info(line: &str) -> Option<CommitInfo> {
    let mut fields = line.splitn(5, '\0');
    let id = ObjectId::from_hex(fields.next()?.as_bytes()).ok()?;
    let parents = fields
        .next()?
        .split_whitespace()
        .filter_map(|parent| ObjectId::from_hex(parent.as_bytes()).ok())
        .collect();
    let authored = fields.next()?.parse().ok()?;
    let committed = fields.next()?.parse().ok()?;
    Some(CommitInfo {
        id,
        parents,
        subject: fields.next()?.trim().to_string(),
        authored,
        committed,
    })
}
