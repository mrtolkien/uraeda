//! The commits of a history, with their parents, subjects, and times, through gix's walk.

use gix::revision::walk::Sorting;
use gix::traverse::commit::simple::CommitTimeOrder;

use super::{Git, GitError, ObjectId, read_error};

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
}
