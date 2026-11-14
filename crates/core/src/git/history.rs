//! The commits of a history, with their parents, subjects, and times, through gix's walk, the
//! lines a diff between two of them changed, and the paths of `specs/` each commit added, deleted,
//! or renamed.

use gix::revision::walk::Sorting;
use gix::traverse::commit::simple::CommitTimeOrder;

use super::{Git, GitError, ObjectId, output_in, read_error};

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

/// Where a commit of the checked-out branch's history is against its `origin` branch.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Mark {
    /// On both, or there is no `origin` branch to compare with.
    None,
    /// Only on `origin`: a pull brings it.
    ToPull,
    /// Only local: a push sends it.
    ToPush,
}

/// The paths of the `specs/` folders, the top level's and any nested one, one commit added,
/// deleted, or renamed, renames found by git's similarity.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct CommitPaths {
    /// Its first 7 characters.
    pub commit: String,
    /// The first line of its message.
    pub subject: String,
    /// Each renamed path, `(old, new)`.
    pub renamed: Vec<(String, String)>,
    pub deleted: Vec<String>,
    pub added: Vec<String>,
}

impl Git {
    /// The paths of `specs/` each commit reachable from `tip` added, deleted, or renamed, newest
    /// first, a commit always before its parents whatever their clocks say: one `git log -M
    /// --topo-order` through the system `git`, since gix is built without rename detection. A
    /// merge commit names none.
    pub fn path_events(&self, tip: ObjectId) -> Result<Vec<CommitPaths>, GitError> {
        let tip = tip.to_string();
        let args = [
            "log",
            tip.as_str(),
            "-M",
            "--diff-filter=ADR",
            "--name-status",
            "-z",
            "--topo-order",
            "--format=%H%x00%s",
            "--",
            ":(glob)**/specs/**",
        ];
        Ok(parse_paths(&output_in(&self.root, "log", &args)?))
    }

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
            commits.push(commit_info_of(&info.map_err(read_error("the history"))?)?);
        }
        Ok(commits)
    }

    /// Whether the history of the commit whose full hash is `head` holds `commit`: `head` is it,
    /// or one of its descendants. `None` when the repository does not have `head`, as a pull
    /// request's head pushed from elsewhere and never fetched, or when their history cannot be
    /// read.
    pub fn holds(&self, head: &str, commit: ObjectId) -> Option<bool> {
        let head = ObjectId::from_hex(head.as_bytes()).ok()?;
        if head == commit {
            return Some(true);
        }
        self.repo.find_commit(head).ok()?;
        let base = self.merge_base(head, commit).ok()?;
        Some(base == Some(commit))
    }
}

/// A walked commit's id, parents, subject, and times.
fn commit_info_of(info: &gix::revision::walk::Info<'_>) -> Result<CommitInfo, GitError> {
    let commit = info.object().map_err(read_error("the history"))?;
    let author = commit.author().map_err(read_error("the history"))?;
    let committer = commit.committer().map_err(read_error("the history"))?;
    let message = commit.message_raw_sloppy();
    let subject = message
        .split(|byte| *byte == b'\n')
        .next()
        .unwrap_or_default();
    Ok(CommitInfo {
        id: info.id,
        parents: info.parent_ids().map(|id| id.detach()).collect(),
        subject: String::from_utf8_lossy(subject).trim().to_string(),
        authored: author.seconds(),
        committed: committer.seconds(),
    })
}

/// NUL-separated fields, read by their place: each commit's full hash and subject, then each
/// change's status and its path, or a rename's status, `R<similarity>`, and its two paths. A
/// subject is the field after its hash, whatever characters it holds.
fn parse_paths(output: &str) -> Vec<CommitPaths> {
    let mut commits: Vec<CommitPaths> = Vec::new();
    let mut fields = output
        .split('\0')
        .map(|field| field.trim_start_matches('\n'));
    while let Some(field) = fields.next() {
        let commit = match commits.last_mut() {
            Some(commit) if is_status(field) => commit,
            _ if field.is_empty() => continue,
            _ => {
                commits.push(CommitPaths {
                    commit: field.chars().take(7).collect(),
                    subject: fields.next().unwrap_or_default().trim().to_string(),
                    renamed: Vec::new(),
                    deleted: Vec::new(),
                    added: Vec::new(),
                });
                continue;
            }
        };
        let mut path = || fields.next().unwrap_or_default().to_string();
        match field.chars().next() {
            Some('A') => commit.added.push(path()),
            Some('D') => commit.deleted.push(path()),
            Some('R') => {
                let old = path();
                commit.renamed.push((old, path()));
            }
            _ => {}
        }
    }
    commits
}

/// Whether a field of `git log --name-status` is a change's status, as `A`, `D`, or `R100`: an
/// upper case letter, then a similarity for a rename. A hash is long and lower case.
fn is_status(field: &str) -> bool {
    let mut chars = field.chars();
    chars.next().is_some_and(|first| first.is_ascii_uppercase())
        && chars.all(|char| char.is_ascii_digit())
}
