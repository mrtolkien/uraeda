//! The whole `specs/` folder across branches: each feature and change from its own branch, and the
//! current branch from the working tree.

use std::collections::{BTreeMap, BTreeSet};
use std::path::{Path, PathBuf};
use std::time::SystemTime;

use serde::Serialize;

use crate::files::{frontmatter, markdown};
use crate::git::{Git, GitError, ObjectId};
use crate::steps::{self, PullRequest, Step};
use crate::today;

mod branches;
mod in_progress;
mod links;
mod merged;
mod paths;
mod problem;
mod read;
mod reader;
mod record;
mod tasks;

use merged::Merged;
use read::read_feature;
use reader::Reader;
use record::record_kind;

pub use in_progress::{InProgress, in_progress};
pub use links::resolve;
pub(crate) use paths::folder_path;
pub use paths::{branch_folder, first_file, folder_branch, folder_slug, path_folder, record_path};
pub use problem::{Problem, Severity};

#[derive(Debug, thiserror::Error)]
pub enum WorkspaceError {
    #[error("no specs/ folder at {}: run ura init", .0.display())]
    NoSpecs(PathBuf),
    #[error(transparent)]
    Git(#[from] GitError),
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum Kind {
    Feature,
    Change,
}

/// Where a feature's files were read from.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum Source {
    WorkingTree,
    Local,
    Remote,
    DefaultBranch,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum FileKind {
    Proposal,
    Discovery,
    Clarifications,
    Spec,
    Plan,
    Rulings,
    DataModel,
    Review,
    /// A review's findings, `findings-NN.md`, one per review of the branch or of a wave.
    Findings,
    /// The record of a finished feature or change, `specs/done/<folder>.md`: decided by its folder,
    /// never by `FileKind::of`.
    Record,
}

impl FileKind {
    /// The kind of a file of a feature folder, and its round for discovery, clarifications, and
    /// findings.
    pub fn of(name: &str) -> Option<(FileKind, Option<u32>)> {
        let fixed = match name {
            "proposal.md" => Some(FileKind::Proposal),
            "spec.md" => Some(FileKind::Spec),
            "plan.md" => Some(FileKind::Plan),
            "rulings.md" => Some(FileKind::Rulings),
            "data-model.md" => Some(FileKind::DataModel),
            "spec-review.md" | "plan-review.md" => Some(FileKind::Review),
            _ => None,
        };
        if let Some(kind) = fixed {
            return Some((kind, None));
        }
        for (prefix, kind) in [
            ("discovery-", FileKind::Discovery),
            ("clarifications-", FileKind::Clarifications),
            ("findings-", FileKind::Findings),
        ] {
            if let Some(round) = name
                .strip_prefix(prefix)
                .and_then(|r| r.strip_suffix(".md"))
                && round.len() == 2
                && round.bytes().all(|b| b.is_ascii_digit())
            {
                return Some((kind, round.parse().ok()));
            }
        }
        None
    }

    /// The statuses a human or an agent may set, from the skill's status table.
    pub fn statuses(&self) -> &'static [&'static str] {
        match self {
            FileKind::Clarifications => &["awaiting-human", "answered"],
            FileKind::Spec => &["awaiting-human", "approved", "changes-requested"],
            FileKind::Plan => &[
                "awaiting-human",
                "auto-approved",
                "approved",
                "changes-requested",
            ],
            _ => &[],
        }
    }
}

/// A file of a feature folder.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub struct WorkflowFile {
    pub name: String,
    pub kind: FileKind,
    pub round: Option<u32>,
    pub status: Option<String>,
    /// The first line of its `> [!IMPORTANT]` block: what is asked of the human.
    pub waiting_line: Option<String>,
}

/// A started feature or change.
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "kebab-case")]
pub struct Feature {
    pub kind: Kind,
    /// `2026-10-10-cli-core`.
    pub folder: String,
    /// `cli-core`.
    pub slug: String,
    pub branch: Option<String>,
    pub source: Source,
    /// The working tree its files were read from, from the main checkout (`.` for it), when its
    /// branch is checked out.
    pub worktree: Option<String>,
    pub uncommitted: bool,
    /// Commits behind its remote branch, when it has both.
    pub behind: Option<usize>,
    pub files: Vec<WorkflowFile>,
    /// The `.html` files of its `mockups/` folder, sorted.
    #[serde(skip)]
    pub mockups: Vec<String>,
    pub step: Step,
    /// Its branch's open pull request, from the latest snapshot of `gh`.
    #[serde(skip)]
    pub pull_request: Option<crate::pulls::PullRequestView>,
    pub problems: Vec<Problem>,
    /// For a merged feature, its worktree still there, from the main checkout.
    pub left_worktree: Option<String>,
    /// For a merged feature, its local branch still there.
    pub left_branch: Option<String>,
    /// The folder, from the top level: `specs/2026-10-10-cli-core`; `specs/done` for a finished
    /// feature, whose only file is its record.
    #[serde(skip)]
    pub path: String,
    #[serde(skip)]
    pub proposal_committed: bool,
    /// The tasks, by number and title, with every box checked on a task branch of its branch.
    #[serde(skip)]
    pub task_branch_done: BTreeSet<(u32, String)>,
    #[serde(skip)]
    texts: BTreeMap<String, String>,
    /// The same feature read from its latest commit, when its files were read from disk: its step
    /// is that one's.
    #[serde(skip)]
    at_tip: Option<Box<Feature>>,
}

impl Feature {
    /// A file's text, by name.
    pub fn text(&self, name: &str) -> Option<&str> {
        self.texts.get(name).map(String::as_str)
    }

    pub fn file(&self, kind: FileKind) -> Option<&WorkflowFile> {
        self.files.iter().find(|file| file.kind == kind)
    }

    /// What `ura check` checks for it: its folder, or its record once finished.
    pub fn checked_path(&self) -> String {
        if self.is_finished() {
            record_path(&self.folder)
        } else {
            self.path.clone()
        }
    }

    /// Whether its folder was replaced by its record.
    pub fn is_finished(&self) -> bool {
        self.file(FileKind::Record).is_some()
    }

    /// The file name, when `path`, from the top level, is one of its files: `<path>/<name>` for a
    /// folder, only its record for a finished feature.
    pub fn owns<'p>(&self, path: &'p str) -> Option<&'p str> {
        if self.is_finished() {
            return (path == record_path(&self.folder)).then(|| &path["specs/done/".len()..]);
        }
        path.strip_prefix(self.path.as_str())?.strip_prefix('/')
    }

    /// Recomputes the step with the pull request's state, for the steps that depend on it, from its
    /// latest commit.
    pub fn with_pull_request(&mut self, pull_request: PullRequest) {
        self.step = self.current_step(pull_request);
    }

    /// The step from the committed files, the tip's. When the tip waits on the human and the
    /// disk does not, the human answered or reviewed without committing: the step is the disk's,
    /// committing their work first.
    pub(crate) fn current_step(&self, pull_request: PullRequest) -> Step {
        let Some(tip) = self.at_tip.as_deref() else {
            return steps::step(self, pull_request);
        };
        let at_tip = steps::step(tip, pull_request);
        if at_tip.waits_on != steps::WaitsOn::Human || at_tip.name != steps::StepName::HumanGate {
            return at_tip;
        }
        let on_disk = steps::step(self, pull_request);
        if on_disk.waits_on == steps::WaitsOn::Agent && on_disk.name != steps::StepName::None {
            return Step {
                commit_first: true,
                ..on_disk
            };
        }
        at_tip
    }
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "kebab-case")]
pub struct Workspace {
    pub root: PathBuf,
    pub default_branch: Option<String>,
    pub current_branch: Option<String>,
    /// When `origin` was last fetched, in RFC 3339.
    pub fetched_at: Option<String>,
    pub features: Vec<Feature>,
    pub problems: Vec<Problem>,
    /// When `origin` was last fetched: see `fetched_ago`.
    #[serde(skip)]
    pub fetched: Option<SystemTime>,
}

/// Where files are read from: a commit, or the working tree.
#[derive(Clone, Copy)]
enum ReadFrom {
    Commit(ObjectId),
    Disk,
}

/// A workspace being read: the repository, and what reading each feature shares.
struct Reading<'a> {
    git: &'a Git,
    reader: Reader<'a>,
    main_root: PathBuf,
    merged: Merged,
    /// The one folder read, when not the whole workspace.
    only: Option<&'a str>,
}

impl Reading<'_> {
    /// A working tree's path as shown: from the main checkout, or `.` for it.
    fn shown(&self, path: &Path) -> String {
        match path.strip_prefix(&self.main_root) {
            Ok(relative) if relative.as_os_str().is_empty() => ".".to_string(),
            Ok(relative) => relative.to_string_lossy().into_owned(),
            Err(_) => path.to_string_lossy().into_owned(),
        }
    }
}

impl Workspace {
    /// How long ago `origin` was last fetched, as of now: a workspace kept in memory says it
    /// later than when it was read.
    pub fn fetched_ago(&self) -> Option<String> {
        self.fetched.map(today::ago)
    }

    /// Reads the workspace of the repository `git` is open in.
    pub fn read(git: &Git) -> Result<Workspace, WorkspaceError> {
        Workspace::read_only(git, None)
    }

    /// Reads the workspace with only the feature or change in `folder`, as the whole read has it.
    pub fn read_folder(git: &Git, folder: &str) -> Result<Workspace, WorkspaceError> {
        Workspace::read_only(git, Some(folder))
    }

    fn read_only(git: &Git, only: Option<&str>) -> Result<Workspace, WorkspaceError> {
        let root = git.root();
        let default_branch = git.default_branch();
        let current_branch = git.current_branch();
        let default_tip = default_branch.as_deref().and_then(|b| git.tip(b));
        let _on_default = current_branch.is_some() && current_branch == default_branch;

        let has_specs = root.join("specs").is_dir()
            || default_tip
                .is_some_and(|tip| !git.list_files(tip, "specs").unwrap_or_default().is_empty());
        if !has_specs {
            return Err(WorkspaceError::NoSpecs(root.to_path_buf()));
        }

        let reader = Reader { git };
        let remote_default_tip = default_branch.as_deref().and_then(|b| git.remote_tip(b));
        let tips: Vec<ObjectId> = [default_tip, remote_default_tip]
            .into_iter()
            .flatten()
            .collect();
        let branches = git.branches()?;
        let reading = Reading {
            git,
            merged: Merged::read(&reader, &tips, only),
            reader,
            main_root: git.main_root(),
            only,
        };
        let mut features = reading.worktree_features(&branches);
        reading.add_task_branches(&branches, &mut features);
        let mut features: Vec<Feature> = features.into_values().collect();
        features.extend(reading.merged_features(&branches));
        let pull_requests = crate::pulls::latest(&reading.main_root);
        features
            .iter_mut()
            .for_each(|feature| pull_requests.apply(feature, git));

        let fetched = git.fetched_at();
        Ok(Workspace {
            root: root.to_path_buf(),
            default_branch,
            current_branch,
            fetched_at: fetched.map(today::rfc3339),
            fetched,
            features,
            problems: Vec::new(),
        })
    }

    /// The feature or change in a folder.
    pub fn feature(&self, folder: &str) -> Option<&Feature> {
        self.features
            .iter()
            .find(|feature| feature.folder == folder)
    }
}

impl Feature {
    /// A feature or change from its files' texts, by name, with their statuses and problems. It is
    /// taken as committed, on its own branch, with no pending decision.
    pub fn from_texts(kind: Kind, folder: &str, texts: BTreeMap<String, String>) -> Feature {
        let path = folder_path(kind, folder);
        let mut files = Vec::new();
        let mut problems = Vec::new();
        for (name, text) in &texts {
            let Some((file_kind, round)) = FileKind::of(name) else {
                continue;
            };
            let file_path = format!("{path}/{name}");
            let mut status = None;
            if !file_kind.statuses().is_empty() {
                match frontmatter::parse(text) {
                    Ok(front) => match front.text("status") {
                        Some(value) if file_kind.statuses().contains(&value) => {
                            status = Some(value.to_string());
                        }
                        other => problems.push(Problem {
                            file: file_path.clone(),
                            line: front.line("status"),
                            rule: "frontmatter.status".into(),
                            message: match other {
                                Some(value) => format!(
                                    "status \"{value}\" is not one of {}",
                                    file_kind.statuses().join(", ")
                                ),
                                None => "no status field".into(),
                            },
                            severity: Severity::Error,
                            fixable: false,
                        }),
                    },
                    Err(error) => problems.push(Problem {
                        file: file_path.clone(),
                        line: Some(1),
                        rule: "frontmatter.parse".into(),
                        message: error.to_string(),
                        severity: Severity::Error,
                        fixable: false,
                    }),
                }
            }
            let waiting_line = markdown::Document::parse(text)
                .callout
                .filter(|callout| callout.kind == markdown::CalloutKind::Important)
                .map(|callout| callout.first_line);
            files.push(WorkflowFile {
                name: name.clone(),
                kind: file_kind,
                round,
                status,
                waiting_line,
            });
        }
        files.sort_by_key(|file| (file.kind, file.round));
        let mut feature = Feature {
            kind,
            folder: folder.to_string(),
            slug: folder_slug(folder).unwrap_or(folder).to_string(),
            branch: Some(folder_branch(kind, folder)),
            source: Source::Local,
            worktree: None,
            uncommitted: false,
            behind: None,
            files,
            mockups: Vec::new(),
            step: Step::none(),
            pull_request: None,
            problems,
            left_worktree: None,
            left_branch: None,
            path,
            proposal_committed: texts.contains_key(first_file(kind)),
            task_branch_done: BTreeSet::new(),
            texts,
            at_tip: None,
        };
        feature.step = steps::step(&feature, PullRequest::Unknown);
        feature
    }
}
