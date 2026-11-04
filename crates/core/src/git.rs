//! Every access to git: gix for reads, the system `git` binary for writes, so the user's hooks,
//! signing, and configuration apply to every commit (see `specs/decisions/git.md`).

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::time::SystemTime;

mod amend;
mod branches;
mod checkout;
mod commit;
mod diff;
mod history;
mod log;
pub(crate) mod process;
mod refresh;
mod remote;
mod resolve;
mod staging;
mod status;
mod stopped;
mod worktrees;

pub use amend::Latest;
pub use checkout::{CheckoutState, Conflict, ConflictKind, FileChange, FileState, Staged};
pub use commit::{OnOutput, Stage, others_staged};
pub use diff::{CommitFiles, DIFF_CAP, DiffOf, FileDiff};
pub use history::{CommitInfo, CommitPaths, Mark, Range};
pub use remote::FETCH_DEADLINE;
pub use resolve::Resolution;
pub use stopped::{Stopped, StoppedKind};
pub use worktrees::{Worktree, WorktreeRecord};

pub use gix::ObjectId;

/// Failing to read or write git.
#[derive(Debug, thiserror::Error)]
pub enum GitError {
    #[error("not in a git repository: run git init first")]
    NotARepository(PathBuf),
    #[error("cannot read {what}: {message}")]
    Read { what: String, message: String },
    /// `message` is the output's first line; `output`, all of it, like a hook's report.
    #[error("git {subcommand} failed: {message}")]
    Command {
        subcommand: String,
        message: String,
        output: String,
    },
    #[error("git not found: install git to commit")]
    GitNotFound,
    #[error("other files are staged: {}: commit or unstage them first", .0.join(", "))]
    OtherStagedFiles(Vec<String>),
    #[error("cannot create the worktree: {0} exists")]
    WorktreeExists(String),
    /// A write refused before running, its text the whole message, like "A pull is stopped:
    /// continue or abort it first."
    #[error("{0}")]
    Refused(String),
}

/// A branch, local, on `origin`, or both.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Branch {
    /// The name without `refs/heads/` or `origin/`, like `2026-10-10-cli-core`.
    pub name: String,
    pub local: Option<ObjectId>,
    pub remote: Option<ObjectId>,
}

/// A repository, opened at one of its working trees.
pub struct Git {
    repo: gix::Repository,
    root: PathBuf,
}

fn read_error<E: std::fmt::Display>(what: impl Into<String>) -> impl FnOnce(E) -> GitError {
    let what = what.into();
    move |error| GitError::Read {
        what,
        message: error.to_string(),
    }
}

impl Git {
    /// Opens the repository holding `start`, searching its parent folders.
    pub fn discover(start: &Path) -> Result<Git, GitError> {
        let repo = gix::discover(start).map_err(|_| GitError::NotARepository(start.into()))?;
        Git::from_repo(repo, start)
    }

    /// Opens the repository whose working tree is `worktree`.
    pub fn open(worktree: &Path) -> Result<Git, GitError> {
        let repo = gix::open(worktree).map_err(|_| GitError::NotARepository(worktree.into()))?;
        Git::from_repo(repo, worktree)
    }

    fn from_repo(repo: gix::Repository, start: &Path) -> Result<Git, GitError> {
        let root = repo
            .workdir()
            .ok_or_else(|| GitError::NotARepository(start.into()))?;
        let root = std::fs::canonicalize(root).unwrap_or_else(|_| root.to_path_buf());
        Ok(Git { repo, root })
    }

    /// The top level of this working tree.
    pub fn root(&self) -> &Path {
        &self.root
    }

    /// The folder git shares between working trees: `.git` of the main one.
    pub fn common_dir(&self) -> PathBuf {
        let common = self.repo.common_dir();
        std::fs::canonicalize(common).unwrap_or_else(|_| common.to_path_buf())
    }

    /// This working tree's own git folder: `.git` of the main one, `.git/worktrees/<name>` else.
    pub fn git_dir(&self) -> PathBuf {
        self.repo.git_dir().to_path_buf()
    }

    /// The top level of the main working tree, where `.worktrees/` lives.
    pub fn main_root(&self) -> PathBuf {
        let common = self.repo.common_dir();
        let common = std::fs::canonicalize(common).unwrap_or_else(|_| common.to_path_buf());
        common
            .parent()
            .map_or_else(|| self.root.clone(), Path::to_path_buf)
    }

    /// The branch checked out here, or `None` on a detached `HEAD`.
    pub fn current_branch(&self) -> Option<String> {
        let name = self.repo.head_name().ok()??;
        Some(name.shorten().to_string())
    }

    /// The branch features start from: `origin/HEAD`'s target, else `init.defaultBranch` when it
    /// exists, else `main`, else `master`.
    pub fn default_branch(&self) -> Option<String> {
        if let Ok(Some(reference)) = self.repo.try_find_reference("refs/remotes/origin/HEAD")
            && let gix::refs::TargetRef::Symbolic(target) = reference.target()
        {
            let target = target.shorten().to_string();
            return Some(
                target
                    .strip_prefix("origin/")
                    .unwrap_or(&target)
                    .to_string(),
            );
        }
        let configured = self
            .repo
            .config_snapshot()
            .string("init.defaultBranch")
            .map(|name| name.to_string());
        configured
            .into_iter()
            .chain(["main".to_string(), "master".to_string()])
            .find(|name| self.tip(name).is_some())
    }

    /// Every local branch and every branch of `origin`.
    pub fn branches(&self) -> Result<Vec<Branch>, GitError> {
        let references = self.repo.references().map_err(read_error("branches"))?;
        let mut branches: BTreeMap<String, Branch> = BTreeMap::new();
        for reference in references.all().map_err(read_error("branches"))? {
            let Ok(mut reference) = reference else {
                continue;
            };
            let full = reference.name().as_bstr().to_string();
            let (name, local) = if let Some(name) = full.strip_prefix("refs/heads/") {
                (name.to_string(), true)
            } else if let Some(name) = full.strip_prefix("refs/remotes/origin/") {
                if name == "HEAD" {
                    continue;
                }
                (name.to_string(), false)
            } else {
                continue;
            };
            let Ok(id) = reference.peel_to_id() else {
                continue;
            };
            let entry = branches.entry(name.clone()).or_insert(Branch {
                name,
                local: None,
                remote: None,
            });
            if local {
                entry.local = Some(id.detach());
            } else {
                entry.remote = Some(id.detach());
            }
        }
        Ok(branches.into_values().collect())
    }

    /// The commit a revision names, like a short hash.
    pub fn resolve(&self, revision: &str) -> Option<ObjectId> {
        let id = self.repo.rev_parse_single(revision).ok()?;
        self.repo
            .find_commit(id.detach())
            .ok()
            .map(|commit| commit.id)
    }

    /// The commit a branch points to: the local branch, else `origin`'s.
    pub fn tip(&self, branch: &str) -> Option<ObjectId> {
        [
            format!("refs/heads/{branch}"),
            format!("refs/remotes/origin/{branch}"),
        ]
        .iter()
        .find_map(|name| {
            let mut reference = self.repo.try_find_reference(name.as_str()).ok()??;
            reference.peel_to_id().ok().map(|id| id.detach())
        })
    }

    /// The commit `origin`'s branch points to, without looking at the local branch.
    pub fn remote_tip(&self, branch: &str) -> Option<ObjectId> {
        let name = format!("refs/remotes/origin/{branch}");
        let mut reference = self.repo.try_find_reference(name.as_str()).ok()??;
        reference.peel_to_id().ok().map(|id| id.detach())
    }

    /// The commit `HEAD` points to, if any.
    pub fn head(&self) -> Option<ObjectId> {
        self.repo.head_id().ok().map(|id| id.detach())
    }

    /// The best common ancestor of two commits, or `None` when their histories share no commit.
    pub fn merge_base(&self, a: ObjectId, b: ObjectId) -> Result<Option<ObjectId>, GitError> {
        let base = self
            .repo
            .merge_base(a, b)
            .map_err(read_error("the merge base"))?;
        Ok(base.map(|id| id.detach()))
    }

    /// A file's content at a commit, or `None` when the commit has no such file.
    pub fn read_file(&self, commit: ObjectId, path: &str) -> Result<Option<Vec<u8>>, GitError> {
        let tree = self.tree(commit)?;
        let Some(entry) = tree.lookup_entry_by_path(path).map_err(read_error(path))? else {
            return Ok(None);
        };
        if !entry.mode().is_blob() {
            return Ok(None);
        }
        let object = entry.object().map_err(read_error(path))?;
        Ok(Some(object.data.clone()))
    }

    /// The id of the file or folder at `path` at a commit, which changes with its content: `None`
    /// when the commit has none.
    pub fn entry_id(&self, commit: ObjectId, path: &str) -> Option<ObjectId> {
        let tree = self.tree(commit).ok()?;
        let entry = tree.lookup_entry_by_path(path).ok()??;
        Some(entry.object_id())
    }

    /// The mode of the entry at `path` in a commit's tree, `None` when it has none.
    fn entry_mode(&self, commit: ObjectId, path: &str) -> Option<gix::object::tree::EntryMode> {
        let tree = self.tree(commit).ok()?;
        let entry = tree.lookup_entry_by_path(path).ok()??;
        Some(entry.mode())
    }

    /// Every file under `dir` at a commit, with paths from the top level, sorted.
    pub fn list_files(&self, commit: ObjectId, dir: &str) -> Result<Vec<String>, GitError> {
        let tree = self.tree(commit)?;
        let dir = dir.trim_end_matches('/');
        let Some(entry) = tree.lookup_entry_by_path(dir).map_err(read_error(dir))? else {
            return Ok(Vec::new());
        };
        if !entry.mode().is_tree() {
            return Ok(Vec::new());
        }
        let mut files = Vec::new();
        let subtree = entry.object().map_err(read_error(dir))?.into_tree();
        self.collect_files(&subtree, dir, &mut files)?;
        files.sort();
        Ok(files)
    }

    fn collect_files(
        &self,
        tree: &gix::Tree<'_>,
        prefix: &str,
        files: &mut Vec<String>,
    ) -> Result<(), GitError> {
        for entry in tree.iter() {
            let entry = entry.map_err(read_error(prefix))?;
            let path = format!("{prefix}/{}", entry.filename());
            if entry.mode().is_tree() {
                let subtree = self
                    .repo
                    .find_tree(entry.oid())
                    .map_err(read_error(path.as_str()))?;
                self.collect_files(&subtree, &path, files)?;
            } else if entry.mode().is_blob() {
                files.push(path);
            }
        }
        Ok(())
    }

    fn tree(&self, commit: ObjectId) -> Result<gix::Tree<'_>, GitError> {
        let what = commit.to_hex_with_len(7).to_string();
        self.repo
            .find_commit(commit)
            .map_err(read_error(what.as_str()))?
            .tree()
            .map_err(read_error(what.as_str()))
    }

    /// Whether this working tree has changes to tracked files, staged or not, or untracked files.
    /// Ignored files do not count.
    pub fn has_local_changes(&self) -> Result<bool, GitError> {
        let mut items =
            self.status_items("the working tree", gix::status::UntrackedFiles::Files)?;
        Ok(items
            .next()
            .transpose()
            .map_err(read_error("the working tree"))?
            .is_some())
    }

    /// Deletes a local branch, once the caller checked its commits are merged.
    pub fn delete_branch(&self, branch: &str) -> Result<(), GitError> {
        self.run("branch", &["branch", "--quiet", "-D", branch])
    }

    /// The tracked files that differ from `HEAD` here, staged or not, sorted. Untracked files are
    /// not listed.
    pub fn changed_files(&self) -> Result<Vec<String>, GitError> {
        let mut files: Vec<String> = Vec::new();
        for item in self.status_items("the working tree", gix::status::UntrackedFiles::None)? {
            let item = item.map_err(read_error("the working tree"))?;
            files.push(item.location().to_string());
        }
        files.sort();
        files.dedup();
        Ok(files)
    }

    /// When `origin` was last fetched, from `FETCH_HEAD`.
    pub fn fetched_at(&self) -> Option<SystemTime> {
        std::fs::metadata(self.repo.common_dir().join("FETCH_HEAD"))
            .ok()?
            .modified()
            .ok()
    }

    /// Switches this working tree to an existing branch, local or on `origin`.
    pub fn switch(&self, branch: &str) -> Result<(), GitError> {
        self.run("switch", &["switch", branch])
    }

    /// Creates `branch` from `from`, and switches this working tree to it.
    pub fn switch_new(&self, branch: &str, from: &str) -> Result<(), GitError> {
        self.run("switch", &["switch", "--create", branch, from])
    }

    fn run(&self, subcommand: &str, args: &[&str]) -> Result<(), GitError> {
        self.output(subcommand, args).map(|_| ())
    }

    /// Runs `git`, and returns its stdout.
    pub(crate) fn output(&self, subcommand: &str, args: &[&str]) -> Result<String, GitError> {
        output_in(&self.root, subcommand, args)
    }
}

/// Runs `git` in `root`, and returns its stdout: `Git::output` for a thread, which cannot share a
/// `Git`.
fn output_in(root: &Path, subcommand: &str, args: &[&str]) -> Result<String, GitError> {
    process::run("git", args, root)
        .map(|stdout| String::from_utf8_lossy(&stdout).into_owned())
        .map_err(|failure| failure.into_git(subcommand))
}
