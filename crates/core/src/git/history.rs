//! The commits of a history, with their parents, subjects, and times, through gix's walk, and the
//! lines a diff between two of them changed.

use gix::revision::walk::Sorting;
use gix::traverse::commit::simple::CommitTimeOrder;

use std::path::Path;

use super::{Git, GitError, ObjectId, output_in, read_error};
use crate::changes::ChangedFile;

/// The commits a diff compares.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Range {
    /// From the first commit to the second.
    TwoDot,
    /// From the merge base of the two commits to the second.
    ThreeDot,
}

/// A commit of a history: times in Unix seconds.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct CommitInfo {
    pub id: ObjectId,
    pub parents: Vec<ObjectId>,
    /// The first line of its message.
    pub subject: String,
    /// When it was written: a rebase keeps it.
    pub authored: i64,
    /// When it was last committed: a rebase sets it.
    pub committed: i64,
}

impl Git {
    /// The commits reachable from `tip`, newest committed first, down to the first committed
    /// before `since`, in Unix seconds.
    pub fn history(&self, tip: ObjectId, since: i64) -> Result<Vec<CommitInfo>, GitError> {
        let walk = self
            .repo
            .rev_walk([tip])
            .sorting(Sorting::ByCommitTimeCutoff {
                order: CommitTimeOrder::NewestFirst,
                seconds: since,
            })
            .all()
            .map_err(read_error("the history"))?;
        let mut commits = Vec::new();
        for info in walk {
            let info = info.map_err(read_error("the history"))?;
            let commit = info.object().map_err(read_error("the history"))?;
            let author = commit.author().map_err(read_error("the history"))?;
            let committer = commit.committer().map_err(read_error("the history"))?;
            let message = commit.message_raw_sloppy();
            let subject = message
                .split(|byte| *byte == b'\n')
                .next()
                .unwrap_or_default();
            commits.push(CommitInfo {
                id: info.id,
                parents: info.parent_ids().map(|id| id.detach()).collect(),
                subject: String::from_utf8_lossy(subject).trim().to_string(),
                authored: author.seconds(),
                committed: committer.seconds(),
            });
        }
        Ok(commits)
    }

    /// `git diff --numstat` between two commits, renames followed.
    pub fn numstat(
        &self,
        base: ObjectId,
        tip: ObjectId,
        range: Range,
    ) -> Result<Vec<ChangedFile>, GitError> {
        numstat_in(&self.root, base, tip, range)
    }

    /// `numstat` of each of `diffs`, `(base, tip, range)`, their processes run at once.
    pub fn numstats(
        &self,
        diffs: &[(ObjectId, ObjectId, Range)],
    ) -> Result<Vec<Vec<ChangedFile>>, GitError> {
        let root = self.root.as_path();
        std::thread::scope(|scope| {
            let reads: Vec<_> = diffs
                .iter()
                .map(|&(base, tip, range)| scope.spawn(move || numstat_in(root, base, tip, range)))
                .collect();
            reads
                .into_iter()
                .map(|read| {
                    read.join()
                        .unwrap_or_else(|panic| std::panic::resume_unwind(panic))
                })
                .collect()
        })
    }
}

fn numstat_in(
    root: &Path,
    base: ObjectId,
    tip: ObjectId,
    range: Range,
) -> Result<Vec<ChangedFile>, GitError> {
    let (base, tip) = (base.to_string(), tip.to_string());
    let three_dot = format!("{base}...{tip}");
    let mut args = vec!["diff", "--numstat", "-z", "-M", "--no-ext-diff"];
    match range {
        Range::TwoDot => args.extend([base.as_str(), tip.as_str()]),
        Range::ThreeDot => args.push(&three_dot),
    }
    Ok(parse(&output_in(root, "diff", &args)?))
}

/// NUL-separated records: `added\tremoved\tpath`, or, for a rename, `added\tremoved\t` followed by
/// the old and the new path. A binary file counts `-` lines.
fn parse(output: &str) -> Vec<ChangedFile> {
    let mut fields = output.split('\0');
    let mut files = Vec::new();
    while let Some(record) = fields.next() {
        let mut parts = record.splitn(3, '\t');
        let (Some(added), Some(removed), Some(path)) = (parts.next(), parts.next(), parts.next())
        else {
            continue;
        };
        let path = if path.is_empty() {
            // A rename: the old path, then the new one.
            fields.next();
            fields.next().unwrap_or_default()
        } else {
            path
        };
        files.push(ChangedFile {
            path: path.to_string(),
            added: added.parse().ok(),
            removed: removed.parse().ok(),
        });
    }
    files
}
