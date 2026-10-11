//! Every access to git: gix for reads, the system `git` binary for writes, so the user's hooks,
//! signing, and configuration apply to every commit (see `specs/decisions/git.md`).

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::SystemTime;

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
}

/// A branch, local, on `origin`, or both.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Branch {
    /// The name without `refs/heads/` or `origin/`, like `2026-10-10-cli-core`.
    pub name: String,
    pub local: Option<ObjectId>,
    pub remote: Option<ObjectId>,
}

/// A working tree of the repository, and the branch checked out in it.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Worktree {
    pub path: PathBuf,
    pub branch: Option<String>,
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

    /// The top level of the main working tree, where `.worktrees/` lives.
    pub fn main_root(&self) -> PathBuf {
        let common = self.repo.common_dir();
        let common = std::fs::canonicalize(common).unwrap_or_else(|_| common.to_path_buf());
        common
            .parent()
            .map_or_else(|| self.root.clone(), Path::to_path_buf)
    }

    /// Checks out an existing branch, local or only on `origin`, in a new worktree at `path`,
    /// after pruning the worktrees whose folder is gone.
    pub fn add_worktree(&self, path: &Path, branch: &str) -> Result<(), GitError> {
        self.run("worktree", &["worktree", "prune"])?;
        let path = path.to_string_lossy();
        let local = self
            .repo
            .try_find_reference(format!("refs/heads/{branch}").as_str())
            .ok()
            .flatten()
            .is_some();
        if local {
            self.run("worktree", &["worktree", "add", "--quiet", &path, branch])
        } else {
            let remote = format!("origin/{branch}");
            self.run(
                "worktree",
                &[
                    "worktree", "add", "--quiet", "--track", "-b", branch, &path, &remote,
                ],
            )
        }
    }

    /// Creates `branch` from `from`, checked out in a new worktree at `path`.
    pub fn add_worktree_new(&self, path: &Path, branch: &str, from: &str) -> Result<(), GitError> {
        self.run("worktree", &["worktree", "prune"])?;
        let path = path.to_string_lossy();
        self.run(
            "worktree",
            &["worktree", "add", "--quiet", "-b", branch, &path, from],
        )
    }

    /// Keeps `.worktrees/` out of `git status`, through `.git/info/exclude`, once.
    pub fn exclude_worktrees(&self) -> Result<(), GitError> {
        let info = self.repo.common_dir().join("info");
        let exclude = info.join("exclude");
        let text = std::fs::read_to_string(&exclude).unwrap_or_default();
        if text.lines().any(|line| line.trim() == "/.worktrees/") {
            return Ok(());
        }
        let write = || -> std::io::Result<()> {
            std::fs::create_dir_all(&info)?;
            let mut text = text.clone();
            if !text.is_empty() && !text.ends_with('\n') {
                text.push('\n');
            }
            text.push_str("/.worktrees/\n");
            std::fs::write(&exclude, text)
        };
        write().map_err(read_error(".git/info/exclude"))
    }

    /// The configured `core.hooksPath`, made absolute from the main working tree when it is
    /// relative and this is a linked worktree, where git would resolve it from here instead.
    fn hooks_override(&self) -> Option<String> {
        let configured = self
            .repo
            .config_snapshot()
            .string("core.hooksPath")
            .map(|value| value.to_string())?;
        let main = self.main_root();
        (Path::new(&configured).is_relative() && main != self.root)
            .then(|| main.join(configured).to_string_lossy().into_owned())
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

    /// The commit `HEAD` points to, if any.
    pub fn head(&self) -> Option<ObjectId> {
        self.repo.head_id().ok().map(|id| id.detach())
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

    /// Every working tree of the repository, the main one first.
    pub fn worktrees(&self) -> Result<Vec<Worktree>, GitError> {
        let mut worktrees = Vec::new();
        for repo in self
            .repo
            .worktrees_including_main()
            .map_err(read_error("worktrees"))?
        {
            let Ok(repo) = repo else {
                continue;
            };
            let Some(path) = repo.workdir() else {
                continue;
            };
            let path = std::fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf());
            let branch = repo
                .head_name()
                .ok()
                .flatten()
                .map(|name| name.shorten().to_string());
            worktrees.push(Worktree { path, branch });
        }
        Ok(worktrees)
    }

    /// The tracked files that differ from `HEAD` here, staged or not, sorted. Untracked files are
    /// not listed.
    pub fn changed_files(&self) -> Result<Vec<String>, GitError> {
        let status = self
            .repo
            .status(gix::progress::Discard)
            .map_err(read_error("the working tree"))?
            .untracked_files(gix::status::UntrackedFiles::None)
            .index_worktree_rewrites(None);
        let mut files: Vec<String> = Vec::new();
        for item in status
            .into_iter(None)
            .map_err(read_error("the working tree"))?
        {
            let item = item.map_err(read_error("the working tree"))?;
            files.push(item.location().to_string());
        }
        files.sort();
        files.dedup();
        Ok(files)
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

    /// The files staged here: those whose index entry differs from `HEAD`, sorted.
    pub fn staged_files(&self) -> Result<Vec<String>, GitError> {
        let status = self
            .repo
            .status(gix::progress::Discard)
            .map_err(read_error("the index"))?
            .untracked_files(gix::status::UntrackedFiles::None)
            .index_worktree_rewrites(None);
        let mut files = Vec::new();
        for item in status.into_iter(None).map_err(read_error("the index"))? {
            let item = item.map_err(read_error("the index"))?;
            if let gix::status::Item::TreeIndex(change) = &item {
                files.push(change.location().to_string());
            }
        }
        files.sort();
        files.dedup();
        Ok(files)
    }

    /// Commits `paths` as they are in the working tree, running the hooks, which may reformat
    /// them. Refuses when other files are staged, which the commit would carry along.
    pub fn commit(
        &self,
        paths: &[String],
        subject: &str,
        body: Option<&str>,
    ) -> Result<(), GitError> {
        let others = others_staged(&self.staged_files()?, paths);
        if !others.is_empty() {
            return Err(GitError::OtherStagedFiles(others));
        }
        let mut add = vec!["add", "--all", "--"];
        add.extend(paths.iter().map(String::as_str));
        self.run("add", &add)?;
        let hooks = self
            .hooks_override()
            .map(|path| format!("core.hooksPath={path}"));
        let mut commit = Vec::new();
        if let Some(hooks) = &hooks {
            commit.extend(["-c", hooks.as_str()]);
        }
        commit.extend(["commit", "--quiet", "--message", subject]);
        if let Some(body) = body {
            commit.extend(["--message", body]);
        }
        self.run("commit", &commit)
    }

    fn run(&self, subcommand: &str, args: &[&str]) -> Result<(), GitError> {
        let output = Command::new("git")
            .args(args)
            .current_dir(&self.root)
            .output()
            .map_err(|error| match error.kind() {
                std::io::ErrorKind::NotFound => GitError::GitNotFound,
                _ => GitError::Command {
                    subcommand: subcommand.to_string(),
                    message: error.to_string(),
                    output: error.to_string(),
                },
            })?;
        if output.status.success() {
            return Ok(());
        }
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        let message = stderr
            .lines()
            .chain(stdout.lines())
            .map(str::trim)
            .find(|line| !line.is_empty())
            .unwrap_or("no output")
            .to_string();
        let output = format!("{stdout}{stderr}").trim_end().to_string();
        Err(GitError::Command {
            subcommand: subcommand.to_string(),
            message,
            output,
        })
    }
}

/// The staged files that are neither one of `paths` nor inside a folder of `paths`.
pub fn others_staged(staged: &[String], paths: &[String]) -> Vec<String> {
    staged
        .iter()
        .filter(|file| {
            !paths.iter().any(|path| {
                *file == path || file.starts_with(&format!("{}/", path.trim_end_matches('/')))
            })
        })
        .cloned()
        .collect()
}
