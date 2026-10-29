//! The latest commit, read to decide whether a commit amends it: its parents, its message, the
//! files it changed, and whether another branch holds it. The files and the branches come from
//! `git`, which gix does not give, its output parsed only in its `-z` and `--format` forms.

use super::{Git, GitError, ObjectId, read_error};

/// The commit `HEAD` points to.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Latest {
    pub id: ObjectId,
    pub parents: Vec<ObjectId>,
    /// The first line of its message.
    pub subject: String,
    /// The rest of its message, trimmed, `None` when empty.
    pub body: Option<String>,
    /// The files it changed against its first parent, from the top level, renames as their two
    /// paths.
    pub files: Vec<String>,
}

impl Git {
    /// The commit `HEAD` points to, `None` on an unborn branch.
    pub fn latest(&self) -> Result<Option<Latest>, GitError> {
        let Some(id) = self.head() else {
            return Ok(None);
        };
        let commit = self
            .repo
            .find_commit(id)
            .map_err(read_error("the latest commit"))?;
        let message = String::from_utf8_lossy(commit.message_raw_sloppy()).into_owned();
        let (subject, body) = message.split_once('\n').unwrap_or((&message, ""));
        let body = body.trim();
        let parents: Vec<ObjectId> = commit.parent_ids().map(|id| id.detach()).collect();
        let files = match parents.first() {
            Some(parent) => self.changed_between(*parent, id)?,
            None => Vec::new(),
        };
        Ok(Some(Latest {
            id,
            parents,
            subject: subject.trim().to_string(),
            body: (!body.is_empty()).then(|| body.to_string()),
            files,
        }))
    }

    /// The files that differ between two commits, renames as their two paths.
    fn changed_between(&self, base: ObjectId, tip: ObjectId) -> Result<Vec<String>, GitError> {
        let (base, tip) = (base.to_string(), tip.to_string());
        let output = self.output(
            "diff-tree",
            &[
                "diff-tree",
                "-r",
                "-z",
                "--no-renames",
                "--name-only",
                &base,
                &tip,
            ],
        )?;
        Ok(output
            .split('\0')
            .filter(|path| !path.is_empty())
            .map(String::from)
            .collect())
    }

    /// Whether a branch other than `branch`, local or remote, holds `commit`.
    pub fn held_elsewhere(&self, commit: ObjectId, branch: &str) -> Result<bool, GitError> {
        let commit = commit.to_string();
        let output = self.output(
            "for-each-ref",
            &[
                "for-each-ref",
                "--format=%(refname)",
                "--contains",
                &commit,
                "refs/heads/",
                "refs/remotes/",
            ],
        )?;
        let own = format!("refs/heads/{branch}");
        Ok(output
            .lines()
            .any(|name| name != own && !name.ends_with("/HEAD")))
    }
}
