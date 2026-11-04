//! The commits of a history, with their parents, subjects, and times, through gix's walk, the
//! lines a diff between two of them changed, and the paths of `specs/` each commit added, deleted,
//! or renamed.

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

    /// A page of `count` commits of the checked-out branch's history, after the commit `after`, or
    /// from the first: the commits its `origin` branch has that it lacks first, each `ToPull`,
    /// then those of `HEAD`, the ones `origin` lacks `ToPush`, each run newest first. During a
    /// stopped rebase, the branch replayed is the one compared.
    pub fn history_page(
        &self,
        after: Option<ObjectId>,
        count: usize,
    ) -> Result<Vec<(CommitInfo, Mark)>, GitError> {
        let Some(head) = self.head() else {
            return Ok(Vec::new());
        };
        let branch = self.current_branch().or_else(|| self.rebasing());
        let remote = branch.as_deref().and_then(|branch| self.remote_tip(branch));
        let to_push: std::collections::HashSet<ObjectId> = match remote {
            Some(remote) => self
                .walk(head, Some(remote))?
                .map(|info| info.map(|info| info.id))
                .collect::<Result<_, _>>()?,
            None => Default::default(),
        };
        let pulls = match remote {
            Some(remote) => Some(self.walk(remote, Some(head))?),
            None => None,
        };
        let pulls = pulls.into_iter().flatten().map(|info| (info, Mark::ToPull));
        let local = self.walk(head, None)?.map(|info| {
            let pushed = info.as_ref().is_ok_and(|info| to_push.contains(&info.id));
            (info, if pushed { Mark::ToPush } else { Mark::None })
        });
        let mut rows = pulls.chain(local);
        if let Some(after) = after {
            for (info, _) in rows.by_ref() {
                if info?.id == after {
                    break;
                }
            }
        }
        rows.take(count)
            .map(|(info, mark)| Ok((info?, mark)))
            .collect()
    }

    /// The commits of `tip` that `hidden` lacks, newest committed first.
    fn walk(
        &self,
        tip: ObjectId,
        hidden: Option<ObjectId>,
    ) -> Result<impl Iterator<Item = Result<CommitInfo, GitError>> + '_, GitError> {
        let walk = self
            .repo
            .rev_walk([tip])
            .with_hidden(hidden)
            .sorting(Sorting::ByCommitTime(CommitTimeOrder::NewestFirst))
            .all()
            .map_err(read_error("the history"))?;
        Ok(walk.map(|info| commit_info_of(&info.map_err(read_error("the history"))?)))
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

    /// `git diff --numstat` between two commits, renames followed.
    pub fn numstat(
        &self,
        base: ObjectId,
        tip: ObjectId,
        range: Range,
    ) -> Result<Vec<ChangedFile>, GitError> {
        numstat_in(&self.root, base, tip, range)
    }

    /// `numstat` of each of `diffs`, `(base, tip, range)`, their processes run at once, each with
    /// its own result.
    pub fn numstats(
        &self,
        diffs: &[(ObjectId, ObjectId, Range)],
    ) -> Vec<Result<Vec<ChangedFile>, GitError>> {
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_reads_plain_binary_renamed_and_unusual_paths() {
        let output = concat!(
            "3\t1\tsrc/a.rs\0",
            "-\t-\tshot.png\0",
            "0\t0\t\0old.txt\0new.txt\0",
            "2\t0\tdocs/a\tb é.md\0",
        );
        assert_eq!(
            parse(output),
            vec![
                ChangedFile {
                    path: "src/a.rs".into(),
                    added: Some(3),
                    removed: Some(1)
                },
                ChangedFile {
                    path: "shot.png".into(),
                    added: None,
                    removed: None
                },
                ChangedFile {
                    path: "new.txt".into(),
                    added: Some(0),
                    removed: Some(0)
                },
                ChangedFile {
                    path: "docs/a\tb é.md".into(),
                    added: Some(2),
                    removed: Some(0)
                },
            ]
        );
    }
}
