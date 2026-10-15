//! The whole `specs/` folder across branches: the priorities from the default branch, each feature
//! and change from its own branch, and the current branch from the working tree.

use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::path::{Path, PathBuf};

use serde::Serialize;

use crate::files::{frontmatter, markdown, priorities};
use crate::git::{Branch, Git, GitError, ObjectId};
use crate::steps::{self, PullRequest, Step};
use crate::today;

mod links;
mod paths;
mod read;

use read::{folder_uncommitted, read_record, read_texts, source_of};

pub use links::{linked_draft, resolve};

use links::match_feature;
pub(crate) use paths::folder_path;
pub use paths::{branch_folder, first_file, folder_branch, folder_slug, path_folder, record_path};

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
    /// The record of a finished feature or change, `specs/done/<folder>.md`: decided by its folder,
    /// never by `FileKind::of`.
    Record,
}

impl FileKind {
    /// The kind of a file of a feature folder, and its round for discovery and clarifications.
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

/// A problem in a workflow file.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub struct Problem {
    /// From the repository's top level.
    pub file: String,
    pub line: Option<usize>,
    /// A stable id, like `frontmatter.status`.
    pub rule: String,
    pub message: String,
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
    #[serde(skip)]
    pub decisions_pending: bool,
    #[serde(skip)]
    texts: BTreeMap<String, String>,
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

    /// Recomputes the step with the pull request's state, for the steps that depend on it.
    pub fn with_pull_request(&mut self, pull_request: PullRequest) {
        self.step = steps::step(self, pull_request);
    }
}

/// An entry of `PRIORITIES.md`, and the feature it matches.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub struct PriorityEntry {
    pub section: priorities::Section,
    pub position: usize,
    /// Its address, from [`priorities::keys`].
    pub key: String,
    pub text: String,
    pub link: Option<String>,
    pub feature: Option<String>,
    /// The draft it links, from the top level, when it links a file of `specs/drafts/`.
    pub draft: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "kebab-case")]
pub struct Workspace {
    pub root: PathBuf,
    pub default_branch: Option<String>,
    pub current_branch: Option<String>,
    /// When `origin` was last fetched, in RFC 3339.
    pub fetched_at: Option<String>,
    pub priorities: Vec<PriorityEntry>,
    pub features: Vec<Feature>,
    /// Drafts and postponed features, from the default branch: `specs/drafts/x.md`,
    /// `specs/backlog/y` for a folder.
    pub drafts: Vec<String>,
    pub problems: Vec<Problem>,
    #[serde(skip)]
    pub fetched_ago: Option<String>,
}

/// A record's kind, from its frontmatter: a feature unless it says `change`.
fn record_kind(text: &str) -> Kind {
    match frontmatter::parse(text)
        .ok()
        .and_then(|f| f.text("kind").map(String::from))
    {
        Some(kind) if kind == "change" => Kind::Change,
        _ => Kind::Feature,
    }
}

/// Where files are read from: a commit, or the working tree.
#[derive(Clone, Copy)]
enum ReadFrom {
    Commit(ObjectId),
    Disk,
}

struct Reader<'a> {
    git: &'a Git,
}

impl Reader<'_> {
    fn read(&self, from: ReadFrom, path: &str) -> Option<String> {
        let bytes = match from {
            ReadFrom::Commit(commit) => self.git.read_file(commit, path).ok()??,
            ReadFrom::Disk => fs::read(self.git.root().join(path)).ok()?,
        };
        String::from_utf8(bytes).ok()
    }

    /// The files directly inside a folder.
    fn files(&self, from: ReadFrom, dir: &str) -> Vec<String> {
        match from {
            ReadFrom::Commit(commit) => self
                .git
                .list_files(commit, dir)
                .unwrap_or_default()
                .into_iter()
                .filter_map(|path| {
                    let name = path.strip_prefix(dir)?.strip_prefix('/')?;
                    (!name.contains('/')).then(|| name.to_string())
                })
                .collect(),
            ReadFrom::Disk => {
                let mut names: Vec<String> = fs::read_dir(self.git.root().join(dir))
                    .into_iter()
                    .flatten()
                    .flatten()
                    .filter(|entry| entry.file_type().is_ok_and(|t| t.is_file()))
                    .filter_map(|entry| entry.file_name().into_string().ok())
                    .collect();
                names.sort();
                names
            }
        }
    }

    /// The drafts and postponed folders of `specs/drafts/` and `specs/backlog/`.
    fn drafts(&self, from: ReadFrom) -> Vec<String> {
        let mut drafts = BTreeSet::new();
        for dir in ["specs/drafts", "specs/backlog"] {
            let paths: Vec<String> = match from {
                ReadFrom::Commit(commit) => self.git.list_files(commit, dir).unwrap_or_default(),
                ReadFrom::Disk => fs::read_dir(self.git.root().join(dir))
                    .into_iter()
                    .flatten()
                    .flatten()
                    .filter_map(|entry| {
                        let name = entry.file_name().into_string().ok()?;
                        let is_dir = entry.file_type().is_ok_and(|t| t.is_dir());
                        Some(if is_dir {
                            format!("{dir}/{name}/")
                        } else {
                            format!("{dir}/{name}")
                        })
                    })
                    .collect(),
            };
            for path in paths {
                let Some(rest) = path.strip_prefix(dir).and_then(|r| r.strip_prefix('/')) else {
                    continue;
                };
                match rest.split_once('/') {
                    Some((folder, _)) => drafts.insert(format!("{dir}/{folder}")),
                    None if rest.ends_with(".md") => drafts.insert(path.clone()),
                    None => false,
                };
            }
        }
        drafts.into_iter().collect()
    }

    /// The records of `specs/done/`, by kind and folder, with their texts.
    fn records(&self, from: ReadFrom) -> BTreeMap<(Kind, String), String> {
        let mut records = BTreeMap::new();
        for name in self.files(from, "specs/done") {
            let Some(folder) = name.strip_suffix(".md") else {
                continue;
            };
            if folder_slug(folder).is_none() {
                continue;
            }
            if let Some(text) = self.read(from, &record_path(folder)) {
                records.insert((record_kind(&text), folder.to_string()), text);
            }
        }
        records
    }

    /// The feature and change folders under `specs/`.
    fn folders(&self, from: ReadFrom) -> BTreeSet<(Kind, String)> {
        let mut folders = BTreeSet::new();
        for (kind, dir) in [(Kind::Feature, "specs"), (Kind::Change, "specs/changes")] {
            let names: Vec<String> = match from {
                ReadFrom::Commit(commit) => self
                    .git
                    .list_files(commit, dir)
                    .unwrap_or_default()
                    .into_iter()
                    .filter_map(|path| {
                        let rest = path.strip_prefix(dir)?.strip_prefix('/')?;
                        let (folder, _) = rest.split_once('/')?;
                        Some(folder.to_string())
                    })
                    .collect(),
                ReadFrom::Disk => fs::read_dir(self.git.root().join(dir))
                    .into_iter()
                    .flatten()
                    .flatten()
                    .filter(|entry| entry.file_type().is_ok_and(|t| t.is_dir()))
                    .filter_map(|entry| entry.file_name().into_string().ok())
                    .collect(),
            };
            for name in names {
                if folder_slug(&name).is_some() {
                    folders.insert((kind, name));
                }
            }
        }
        folders
    }
}

/// What the default branch merged, local or on `origin`, so a merge made on the forge shows before
/// the next pull: the records and the folders of each tip.
struct Merged {
    records: Vec<BTreeMap<(Kind, String), String>>,
    folders: Vec<(ObjectId, BTreeSet<(Kind, String)>)>,
    /// Every feature and change with a folder or a record there.
    keys: BTreeSet<(Kind, String)>,
}

impl Merged {
    fn read(reader: &Reader<'_>, tips: &[ObjectId]) -> Merged {
        let records: Vec<BTreeMap<(Kind, String), String>> = tips
            .iter()
            .map(|tip| reader.records(ReadFrom::Commit(*tip)))
            .collect();
        let folders: Vec<(ObjectId, BTreeSet<(Kind, String)>)> = tips
            .iter()
            .map(|tip| (*tip, reader.folders(ReadFrom::Commit(*tip))))
            .collect();
        let keys = records
            .iter()
            .flat_map(|records| records.keys().cloned())
            .chain(
                folders
                    .iter()
                    .flat_map(|(_, folders)| folders.iter().cloned()),
            )
            .collect();
        Merged {
            records,
            folders,
            keys,
        }
    }
}

/// A workspace being read: the repository, and what reading each feature shares.
struct Reading<'a> {
    git: &'a Git,
    reader: Reader<'a>,
    root: &'a Path,
    main_root: PathBuf,
    /// The branches checked out in other working trees, read from their disk.
    checked_out: BTreeMap<String, PathBuf>,
    merged: Merged,
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

    /// The working tree's features: the current branch's, and folders not yet committed.
    fn working_tree_features(
        &self,
        current_branch: Option<&str>,
    ) -> BTreeMap<(Kind, String), Feature> {
        let current_folder = current_branch.and_then(branch_folder);
        let mut on_disk = self.reader.folders(ReadFrom::Disk);
        if let Some((kind, folder)) = current_folder {
            on_disk.insert((kind, folder.to_string()));
        }
        let head = self.git.head();
        let mut features = BTreeMap::new();
        for (kind, folder) in on_disk {
            if self.merged.keys.contains(&(kind, folder.clone())) {
                continue;
            }
            let branch = current_folder
                .filter(|(k, f)| *k == kind && *f == folder)
                .map(|_| folder_branch(kind, &folder));
            let on_branch = branch.is_some();
            let mut feature =
                read_feature(&self.reader, kind, &folder, branch, ReadFrom::Disk, head);
            if on_branch {
                feature.worktree = Some(self.shown(self.root));
            }
            features.insert((kind, folder), feature);
        }
        features
    }

    /// Adds the feature of every other feature branch, from its tip.
    fn add_branch_features(
        &self,
        branches: &[Branch],
        features: &mut BTreeMap<(Kind, String), Feature>,
    ) {
        for branch in branches {
            let Some((kind, folder)) = branch_folder(&branch.name) else {
                continue;
            };
            let key = (kind, folder.to_string());
            if self.merged.keys.contains(&key) || features.contains_key(&key) {
                continue;
            }
            if let Some(feature) = self.branch_feature(branch, kind, folder) {
                features.insert(key, feature);
            }
        }
    }

    /// A branch's feature: from the working tree that has it, else from its tip, local first; none
    /// for a branch whose tip has neither its folder nor its record.
    fn branch_feature(&self, branch: &Branch, kind: Kind, folder: &str) -> Option<Feature> {
        let tip = branch.local.or(branch.remote)?;
        let opened = self
            .checked_out
            .get(&branch.name)
            .and_then(|path| Git::open(path).ok().map(|git| (path, git)));
        let mut feature = match &opened {
            Some((path, worktree_git)) => {
                let worktree_reader = Reader { git: worktree_git };
                let mut feature = read_feature(
                    &worktree_reader,
                    kind,
                    folder,
                    Some(branch.name.clone()),
                    ReadFrom::Disk,
                    worktree_git.head(),
                );
                feature.worktree = Some(self.shown(path));
                feature
            }
            None => {
                // Neither its folder nor its record, like a fix made outside the workflow:
                // not a feature.
                let from = ReadFrom::Commit(tip);
                if self
                    .reader
                    .files(from, &folder_path(kind, folder))
                    .is_empty()
                    && self.reader.read(from, &record_path(folder)).is_none()
                {
                    return None;
                }
                let mut feature = read_feature(
                    &self.reader,
                    kind,
                    folder,
                    Some(branch.name.clone()),
                    ReadFrom::Commit(tip),
                    Some(tip),
                );
                feature.source = if branch.local.is_some() {
                    Source::Local
                } else {
                    Source::Remote
                };
                feature
            }
        };
        feature.behind = match (branch.local, branch.remote) {
            (Some(local), Some(remote)) => Some(self.git.behind(local, remote)),
            _ => None,
        };
        Some(feature)
    }

    /// The features merged into the default branch, read from it: the record first, local first,
    /// with the branch and the worktree left behind.
    fn merged_features(&self, branches: &[Branch]) -> Vec<Feature> {
        let local_branches: BTreeSet<&str> = branches
            .iter()
            .filter(|branch| branch.local.is_some())
            .map(|branch| branch.name.as_str())
            .collect();
        let worktrees = self.git.worktrees().unwrap_or_default();
        let mut features = Vec::new();
        for (kind, folder) in &self.merged.keys {
            let key = (*kind, folder.clone());
            let record = self
                .merged
                .records
                .iter()
                .find_map(|records| records.get(&key));
            let mut feature = match record {
                Some(text) => Feature::from_record(*kind, folder, text.clone()),
                None => {
                    let Some((tip, _)) = self
                        .merged
                        .folders
                        .iter()
                        .find(|(_, folders)| folders.contains(&key))
                    else {
                        continue;
                    };
                    let from = ReadFrom::Commit(*tip);
                    read_feature(&self.reader, *kind, folder, None, from, Some(*tip))
                }
            };
            let branch = folder_branch(*kind, folder);
            feature.source = Source::DefaultBranch;
            feature.branch = None;
            feature.step = Step::done();
            feature.left_worktree = worktrees
                .iter()
                .find(|w| w.path != self.main_root && w.branch.as_deref() == Some(branch.as_str()))
                .map(|w| self.shown(&w.path));
            feature.left_branch = local_branches.contains(branch.as_str()).then_some(branch);
            features.push(feature);
        }
        features
    }
}

/// The priorities' entries, each with the feature or the draft it links to.
fn priority_entries(text: &str, features: &[Feature]) -> Vec<PriorityEntry> {
    let entries = priorities::parse(text);
    let keys = priorities::keys(&entries);
    entries
        .into_iter()
        .zip(keys)
        .map(|(entry, key)| {
            let feature = entry
                .link
                .as_deref()
                .and_then(|link| match_feature(link, features));
            let draft = entry.link.as_deref().and_then(linked_draft);
            PriorityEntry {
                section: entry.section,
                position: entry.position,
                key,
                text: entry.text,
                link: entry.link,
                feature,
                draft,
            }
        })
        .collect()
}

impl Workspace {
    /// Reads the workspace of the repository `git` is open in.
    pub fn read(git: &Git) -> Result<Workspace, WorkspaceError> {
        let root = git.root();
        let default_branch = git.default_branch();
        let current_branch = git.current_branch();
        let default_tip = default_branch.as_deref().and_then(|b| git.tip(b));
        let on_default = current_branch.is_some() && current_branch == default_branch;

        let has_specs = root.join("specs").is_dir()
            || default_tip
                .is_some_and(|tip| !git.list_files(tip, "specs").unwrap_or_default().is_empty());
        if !has_specs {
            return Err(WorkspaceError::NoSpecs(root.to_path_buf()));
        }

        let checked_out: BTreeMap<String, PathBuf> = git
            .worktrees()
            .unwrap_or_default()
            .into_iter()
            .filter(|worktree| worktree.path != root && worktree.path.exists())
            .filter_map(|worktree| Some((worktree.branch?, worktree.path)))
            .collect();
        // The priorities and drafts: from this checkout on the default branch, else from the
        // worktree that has it, uncommitted edits included, else from its tip.
        let default_worktree = default_branch
            .as_ref()
            .filter(|_| !on_default)
            .and_then(|branch| checked_out.get(branch))
            .and_then(|path| Git::open(path).ok());
        let default_reader = default_worktree
            .as_ref()
            .map_or(Reader { git }, |git| Reader { git });
        let priorities_from = match default_tip {
            Some(tip) if !on_default && default_worktree.is_none() => ReadFrom::Commit(tip),
            _ => ReadFrom::Disk,
        };
        let priorities_text = default_reader
            .read(priorities_from, "specs/PRIORITIES.md")
            .unwrap_or_default();

        let reader = Reader { git };
        let remote_default_tip = default_branch.as_deref().and_then(|b| git.remote_tip(b));
        let tips: Vec<ObjectId> = [default_tip, remote_default_tip]
            .into_iter()
            .flatten()
            .collect();
        let reading = Reading {
            git,
            merged: Merged::read(&reader, &tips),
            reader,
            root,
            main_root: git.main_root(),
            checked_out,
        };
        let branches = git.branches()?;
        let mut features = reading.working_tree_features(current_branch.as_deref());
        reading.add_branch_features(&branches, &mut features);
        let mut features: Vec<Feature> = features.into_values().collect();
        for feature in &mut features {
            feature.step = steps::step(feature, PullRequest::Unknown);
        }
        features.extend(reading.merged_features(&branches));

        let fetched = git.fetched_at();
        Ok(Workspace {
            root: root.to_path_buf(),
            default_branch,
            current_branch,
            fetched_at: fetched.map(today::rfc3339),
            fetched_ago: fetched.map(today::ago),
            priorities: priority_entries(&priorities_text, &features),
            features,
            drafts: default_reader.drafts(priorities_from),
            problems: Vec::new(),
        })
    }

    /// The feature or change in a folder.
    pub fn feature(&self, folder: &str) -> Option<&Feature> {
        self.features
            .iter()
            .find(|feature| feature.folder == folder)
    }

    /// The feature or change a priorities entry's link points to.
    pub fn linked_feature(&self, link: &str) -> Option<&Feature> {
        match_feature(link, &self.features).and_then(|folder| self.feature(&folder))
    }
}

fn read_feature(
    reader: &Reader<'_>,
    kind: Kind,
    folder: &str,
    branch: Option<String>,
    from: ReadFrom,
    committed: Option<ObjectId>,
) -> Feature {
    let path = folder_path(kind, folder);
    let (texts, unreadable) = read_texts(reader, from, &path);
    if texts.is_empty()
        && unreadable.is_empty()
        && let Some(text) = reader.read(from, &record_path(folder))
    {
        let mut feature = read_record(reader, kind, folder, text, from, committed);
        feature.branch = branch;
        return feature;
    }
    let mut feature = Feature::from_texts(kind, folder, texts);
    feature.mockups = reader
        .files(from, &format!("{path}/mockups"))
        .into_iter()
        .filter(|name| name.ends_with(".html"))
        .collect();
    feature.mockups.sort();
    for name in unreadable {
        feature.problems.push(Problem {
            file: format!("{path}/{name}"),
            line: None,
            rule: "file.utf8".into(),
            message: "not UTF-8".into(),
        });
    }
    feature.branch = branch;
    feature.source = source_of(from);
    let first_path = format!("{path}/{}", first_file(kind));
    feature.proposal_committed = committed.is_some_and(|commit| {
        reader
            .git
            .read_file(commit, &first_path)
            .ok()
            .flatten()
            .is_some()
    });
    feature.uncommitted = folder_uncommitted(reader, &feature, &path, from, committed);
    feature.decisions_pending = feature
        .texts
        .get("spec.md")
        .is_some_and(|spec| decisions_pending(reader, from, &path, folder, spec));
    feature
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
                        }),
                    },
                    Err(error) => problems.push(Problem {
                        file: file_path.clone(),
                        line: Some(1),
                        rule: "frontmatter.parse".into(),
                        message: error.to_string(),
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
            problems,
            left_worktree: None,
            left_branch: None,
            path,
            proposal_committed: texts.contains_key(first_file(kind)),
            decisions_pending: false,
            texts,
        };
        feature.step = steps::step(&feature, PullRequest::Unknown);
        feature
    }
}

impl Feature {
    /// A finished feature or change, from its record's text: its only file.
    pub fn from_record(kind: Kind, folder: &str, text: String) -> Feature {
        let name = format!("{folder}.md");
        let path = record_path(folder);
        let mut problems = Vec::new();
        match frontmatter::parse(&text) {
            Ok(front) => {
                if !matches!(front.text("kind"), Some("feature" | "change")) {
                    problems.push(Problem {
                        file: path.clone(),
                        line: front.line("kind"),
                        rule: "frontmatter.kind".into(),
                        message: "kind is not one of feature, change".into(),
                    });
                }
            }
            Err(error) => problems.push(Problem {
                file: path.clone(),
                line: Some(1),
                rule: "frontmatter.parse".into(),
                message: error.to_string(),
            }),
        }
        let mut feature = Feature {
            kind,
            folder: folder.to_string(),
            slug: folder_slug(folder).unwrap_or(folder).to_string(),
            branch: Some(folder_branch(kind, folder)),
            source: Source::Local,
            worktree: None,
            uncommitted: false,
            behind: None,
            files: vec![WorkflowFile {
                name: name.clone(),
                kind: FileKind::Record,
                round: None,
                status: None,
                waiting_line: None,
            }],
            mockups: Vec::new(),
            step: Step::none(),
            problems,
            left_worktree: None,
            left_branch: None,
            path: "specs/done".to_string(),
            proposal_committed: true,
            decisions_pending: false,
            texts: BTreeMap::from([(name, text)]),
        };
        feature.step = steps::step(&feature, PullRequest::Unknown);
        feature
    }
}

/// Whether a decision the spec links is `proposed`, or has a proposed change for this folder.
fn decisions_pending(
    reader: &Reader<'_>,
    from: ReadFrom,
    dir: &str,
    folder: &str,
    spec: &str,
) -> bool {
    let document = markdown::Document::parse(spec);
    let start = document
        .headings
        .iter()
        .find(|h| h.level == 2 && h.text == "Decisions")
        .map(|h| h.line);
    let Some(start) = start else {
        return false;
    };
    let end = document
        .headings
        .iter()
        .find(|h| h.level <= 2 && h.line > start)
        .map_or(usize::MAX, |h| h.line);
    let change = format!("## Proposed change ({folder})");
    document
        .links
        .iter()
        .filter(|link| link.line > start && link.line < end && !link.wiki)
        .filter_map(|link| resolve(dir, &link.target))
        .filter(|path| path.starts_with("specs/decisions/"))
        .any(|path| {
            let Some(text) = reader.read(from, &path) else {
                return false;
            };
            let proposed = frontmatter::parse(&text)
                .is_ok_and(|front| front.text("status") == Some("proposed"));
            proposed || text.lines().any(|line| line.trim_end() == change)
        })
}
