//! The whole `specs/` folder across branches: the priorities from the default branch, each feature
//! and bug from its own branch, and the current branch from the working tree.

use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::path::{Path, PathBuf};

use serde::Serialize;

use crate::files::{frontmatter, markdown, priorities};
use crate::git::{Git, GitError, ObjectId};
use crate::steps::{self, PullRequest, Step};
use crate::today::{self, Date};

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
    Bug,
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
    Report,
    Discovery,
    Clarifications,
    Spec,
    Plan,
    Assessment,
    Rulings,
    DataModel,
    Review,
    /// The record of a finished feature or bug, `specs/done/<folder>.md`: decided by its folder,
    /// never by `FileKind::of`.
    Record,
}

impl FileKind {
    /// The kind of a file of a feature folder, and its round for discovery and clarifications.
    pub fn of(name: &str) -> Option<(FileKind, Option<u32>)> {
        let fixed = match name {
            "proposal.md" => Some(FileKind::Proposal),
            "report.md" => Some(FileKind::Report),
            "spec.md" => Some(FileKind::Spec),
            "plan.md" => Some(FileKind::Plan),
            "assessment.md" => Some(FileKind::Assessment),
            "rulings.md" => Some(FileKind::Rulings),
            "data-model.md" => Some(FileKind::DataModel),
            "spec-review.md" | "plan-review.md" | "assessment-review.md" => Some(FileKind::Review),
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
            FileKind::Spec | FileKind::Assessment => {
                &["awaiting-human", "approved", "changes-requested"]
            }
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

/// A started feature or bug.
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

/// A feature folder's name: `2026-10-10-cli-core`, with a real date and a slug.
pub fn folder_slug(folder: &str) -> Option<&str> {
    let (date, slug) = (folder.get(..10)?, folder.get(11..)?);
    (folder.as_bytes().get(10) == Some(&b'-') && Date::parse(date).is_some() && !slug.is_empty())
        .then_some(slug)
}

/// The feature or bug a branch is for: `2026-10-10-cli-core`, or `fix/2026-10-14-x`.
pub fn branch_folder(branch: &str) -> Option<(Kind, &str)> {
    match branch.strip_prefix("fix/") {
        Some(folder) => folder_slug(folder).map(|_| (Kind::Bug, folder)),
        None => folder_slug(branch).map(|_| (Kind::Feature, branch)),
    }
}

/// The branch of a feature or a bug.
pub fn folder_branch(kind: Kind, folder: &str) -> String {
    match kind {
        Kind::Feature => folder.to_string(),
        Kind::Bug => format!("fix/{folder}"),
    }
}

/// Where a finished feature's or bug's record lives.
pub fn record_path(folder: &str) -> String {
    format!("specs/done/{folder}.md")
}

/// A record's kind, from its frontmatter: a feature unless it says `bug`.
fn record_kind(text: &str) -> Kind {
    match frontmatter::parse(text)
        .ok()
        .and_then(|f| f.text("kind").map(String::from))
    {
        Some(kind) if kind == "bug" => Kind::Bug,
        _ => Kind::Feature,
    }
}

fn folder_path(kind: Kind, folder: &str) -> String {
    match kind {
        Kind::Feature => format!("specs/{folder}"),
        Kind::Bug => format!("specs/bugs/{folder}"),
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

    /// The feature and bug folders under `specs/`.
    fn folders(&self, from: ReadFrom) -> BTreeSet<(Kind, String)> {
        let mut folders = BTreeSet::new();
        for (kind, dir) in [(Kind::Feature, "specs"), (Kind::Bug, "specs/bugs")] {
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

impl Workspace {
    /// Reads the workspace of the repository `git` is open in.
    pub fn read(git: &Git) -> Result<Workspace, WorkspaceError> {
        let reader = Reader { git };
        let root = git.root().to_path_buf();
        let default_branch = git.default_branch();
        let current_branch = git.current_branch();
        let default_tip = default_branch.as_deref().and_then(|b| git.tip(b));
        let on_default = current_branch.is_some() && current_branch == default_branch;
        let head = git.head();

        let has_specs = root.join("specs").is_dir()
            || default_tip
                .is_some_and(|tip| !git.list_files(tip, "specs").unwrap_or_default().is_empty());
        if !has_specs {
            return Err(WorkspaceError::NoSpecs(root));
        }

        // The branches checked out in other working trees, read from their disk.
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
        // Merged: a folder or a record on the default branch, local or on `origin`, so a merge
        // made on the forge shows before the next pull.
        let remote_default_tip = default_branch.as_deref().and_then(|b| git.remote_tip(b));
        let tips: Vec<ObjectId> = [default_tip, remote_default_tip]
            .into_iter()
            .flatten()
            .collect();
        let merged_records: Vec<BTreeMap<(Kind, String), String>> = tips
            .iter()
            .map(|tip| reader.records(ReadFrom::Commit(*tip)))
            .collect();
        let merged_folders: Vec<(ObjectId, BTreeSet<(Kind, String)>)> = tips
            .iter()
            .map(|tip| (*tip, reader.folders(ReadFrom::Commit(*tip))))
            .collect();
        let merged: BTreeSet<(Kind, String)> = merged_records
            .iter()
            .flat_map(|records| records.keys().cloned())
            .chain(
                merged_folders
                    .iter()
                    .flat_map(|(_, folders)| folders.iter().cloned()),
            )
            .collect();

        let mut features: BTreeMap<(Kind, String), Feature> = BTreeMap::new();
        let main_root = git.main_root();
        let shown = |path: &Path| -> String {
            match path.strip_prefix(&main_root) {
                Ok(relative) if relative.as_os_str().is_empty() => ".".to_string(),
                Ok(relative) => relative.to_string_lossy().into_owned(),
                Err(_) => path.to_string_lossy().into_owned(),
            }
        };
        // The working tree: the current branch's feature, and folders not yet committed.
        let current_folder = current_branch.as_deref().and_then(branch_folder);
        let mut on_disk = reader.folders(ReadFrom::Disk);
        if let Some((kind, folder)) = current_folder {
            on_disk.insert((kind, folder.to_string()));
        }
        for (kind, folder) in on_disk {
            if merged.contains(&(kind, folder.clone())) {
                continue;
            }
            let branch = current_folder
                .filter(|(k, f)| *k == kind && *f == folder)
                .map(|_| folder_branch(kind, &folder));
            let on_branch = branch.is_some();
            let mut feature = read_feature(&reader, kind, &folder, branch, ReadFrom::Disk, head);
            if on_branch {
                feature.worktree = Some(shown(&root));
            }
            features.insert((kind, folder), feature);
        }
        // Every other feature branch, from its tip.
        for branch in git.branches()? {
            let Some((kind, folder)) = branch_folder(&branch.name) else {
                continue;
            };
            let key = (kind, folder.to_string());
            if merged.contains(&key) || features.contains_key(&key) {
                continue;
            }
            let (Some(tip), source) = (branch.local.or(branch.remote), {
                if branch.local.is_some() {
                    Source::Local
                } else {
                    Source::Remote
                }
            }) else {
                continue;
            };
            let opened = checked_out
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
                    feature.worktree = Some(shown(path));
                    feature
                }
                None => {
                    // Neither its folder nor its record, like a fix made outside the workflow:
                    // not a feature.
                    let from = From::Commit(tip);
                    if reader.files(from, &folder_path(kind, folder)).is_empty()
                        && reader.read(from, &record_path(folder)).is_none()
                    {
                        continue;
                    }
                    let mut feature = read_feature(
                        &reader,
                        kind,
                        folder,
                        Some(branch.name.clone()),
                        ReadFrom::Commit(tip),
                        Some(tip),
                    );
                    feature.source = source;
                    feature
                }
            };
            feature.behind = match (branch.local, branch.remote) {
                (Some(local), Some(remote)) => Some(git.behind(local, remote)),
                _ => None,
            };
            features.insert(key, feature);
        }
        let mut features: Vec<Feature> = features.into_values().collect();
        for feature in &mut features {
            feature.step = steps::step(feature, PullRequest::Unknown);
        }
        // Features merged into the default branch, read from it: the record first, local first.
        let local_branches: BTreeSet<String> = git
            .branches()?
            .into_iter()
            .filter(|branch| branch.local.is_some())
            .map(|branch| branch.name)
            .collect();
        let worktrees = git.worktrees().unwrap_or_default();
        for (kind, folder) in &merged {
            let key = (*kind, folder.clone());
            let mut feature = match merged_records.iter().find_map(|records| records.get(&key)) {
                Some(text) => Feature::from_record(*kind, folder, text.clone()),
                None => {
                    let Some((tip, _)) = merged_folders
                        .iter()
                        .find(|(_, folders)| folders.contains(&key))
                    else {
                        continue;
                    };
                    read_feature(
                        &reader,
                        *kind,
                        folder,
                        None,
                        ReadFrom::Commit(*tip),
                        Some(*tip),
                    )
                }
            };
            let branch = folder_branch(*kind, folder);
            feature.source = Source::DefaultBranch;
            feature.branch = None;
            feature.step = Step::done();
            feature.left_worktree = worktrees
                .iter()
                .find(|w| w.path != main_root && w.branch.as_deref() == Some(branch.as_str()))
                .map(|w| shown(&w.path));
            feature.left_branch = local_branches.contains(&branch).then_some(branch);
            features.push(feature);
        }

        let entries = priorities::parse(&priorities_text);
        let keys = priorities::keys(&entries);
        let priorities = entries
            .into_iter()
            .zip(keys)
            .map(|(entry, key)| {
                let feature = entry
                    .link
                    .as_deref()
                    .and_then(|link| match_feature(link, &features));
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
            .collect();
        let drafts = default_reader.drafts(priorities_from);
        let fetched = git.fetched_at();
        Ok(Workspace {
            root,
            default_branch,
            current_branch,
            fetched_at: fetched.map(today::rfc3339),
            fetched_ago: fetched.map(today::ago),
            priorities,
            features,
            drafts,
            problems: Vec::new(),
        })
    }

    /// The feature or bug in a folder.
    pub fn feature(&self, folder: &str) -> Option<&Feature> {
        self.features
            .iter()
            .find(|feature| feature.folder == folder)
    }

    /// The feature or bug a priorities entry's link points to.
    pub fn linked_feature(&self, link: &str) -> Option<&Feature> {
        match_feature(link, &self.features).and_then(|folder| self.feature(&folder))
    }
}

/// The draft a priorities entry's link points to, from the top level, when it links a file of
/// `specs/drafts/`.
pub fn linked_draft(link: &str) -> Option<String> {
    resolve("specs", link).filter(|path| path.starts_with("specs/drafts/"))
}

/// The feature an entry's link points to: a path component or file name equal to its folder or
/// its slug.
fn match_feature(link: &str, features: &[Feature]) -> Option<String> {
    let path = link.split('#').next().unwrap_or(link);
    let names: Vec<&str> = path
        .split('/')
        .map(|part| part.strip_suffix(".md").unwrap_or(part))
        .filter(|part| !part.is_empty() && *part != "proposal")
        .collect();
    features
        .iter()
        .find(|feature| {
            names
                .iter()
                .any(|name| *name == feature.folder || *name == feature.slug)
        })
        .map(|feature| feature.folder.clone())
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
    let mut texts = BTreeMap::new();
    let mut unreadable = Vec::new();
    for name in reader.files(from, &path) {
        if FileKind::of(&name).is_none() {
            continue;
        }
        match reader.read(from, &format!("{path}/{name}")) {
            Some(text) => {
                texts.insert(name, text);
            }
            None => unreadable.push(name),
        }
    }
    if texts.is_empty()
        && unreadable.is_empty()
        && let Some(text) = reader.read(from, &record_path(folder))
    {
        let committed_text = committed
            .and_then(|commit| reader.read(ReadFrom::Commit(commit), &record_path(folder)));
        let recorded = record_kind(&text);
        let mut feature = Feature::from_record(kind, folder, text);
        if recorded != kind && feature.problems.is_empty() {
            let (said, branch) = match kind {
                Kind::Feature => ("bug", "feature's"),
                Kind::Bug => ("feature", "bug's"),
            };
            feature.problems.push(Problem {
                file: record_path(folder),
                line: None,
                rule: "frontmatter.kind".into(),
                message: format!(
                    "kind is {said}, but {} is a {branch} branch",
                    folder_branch(kind, folder)
                ),
            });
            feature.step = Step::none();
        }
        feature.uncommitted = matches!(from, ReadFrom::Disk)
            && committed_text.as_deref() != feature.text(&format!("{folder}.md"));
        feature.branch = branch;
        feature.source = match from {
            ReadFrom::Disk => Source::WorkingTree,
            ReadFrom::Commit(_) => Source::Local,
        };
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
    feature.source = match from {
        ReadFrom::Disk => Source::WorkingTree,
        ReadFrom::Commit(_) => Source::Local,
    };
    let first_file = match kind {
        Kind::Feature => "proposal.md",
        Kind::Bug => "report.md",
    };
    let first_path = format!("{path}/{first_file}");
    feature.proposal_committed = committed.is_some_and(|commit| {
        reader
            .git
            .read_file(commit, &first_path)
            .ok()
            .flatten()
            .is_some()
    });
    // Git's changes add the deleted files to the texts that differ from the commit.
    let folder_prefix = format!("{path}/");
    feature.uncommitted = matches!(from, ReadFrom::Disk)
        && (feature.texts.iter().any(|(name, text)| {
            let committed_text = committed.and_then(|commit| {
                reader.read(ReadFrom::Commit(commit), &format!("{path}/{name}"))
            });
            committed_text.as_deref() != Some(text.as_str())
        }) || reader
            .git
            .changed_files()
            .is_ok_and(|files| files.iter().any(|file| file.starts_with(&folder_prefix))));
    feature.decisions_pending = feature
        .texts
        .get("spec.md")
        .is_some_and(|spec| decisions_pending(reader, from, &path, folder, spec));
    feature
}

impl Feature {
    /// A feature or bug from its files' texts, by name, with their statuses and problems. It is
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
        let first_file = match kind {
            Kind::Feature => "proposal.md",
            Kind::Bug => "report.md",
        };
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
            proposal_committed: texts.contains_key(first_file),
            decisions_pending: false,
            texts,
        };
        feature.step = steps::step(&feature, PullRequest::Unknown);
        feature
    }
}

impl Feature {
    /// A finished feature or bug, from its record's text: its only file.
    pub fn from_record(kind: Kind, folder: &str, text: String) -> Feature {
        let name = format!("{folder}.md");
        let path = record_path(folder);
        let mut problems = Vec::new();
        match frontmatter::parse(&text) {
            Ok(front) => {
                if !matches!(front.text("kind"), Some("feature" | "bug")) {
                    problems.push(Problem {
                        file: path.clone(),
                        line: front.line("kind"),
                        rule: "frontmatter.kind".into(),
                        message: "kind is not one of feature, bug".into(),
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

/// A link's file, from the top level, relative to the folder `dir` holding the linking file.
pub fn resolve(dir: &str, target: &str) -> Option<String> {
    let path = target.split('#').next()?;
    if path.is_empty() || path.contains("://") || path.starts_with("mailto:") {
        return None;
    }
    let joined = match path.strip_prefix('/') {
        Some(rooted) => PathBuf::from(rooted),
        None => Path::new(dir).join(path),
    };
    let mut parts: Vec<String> = Vec::new();
    for part in joined.components() {
        match part {
            std::path::Component::ParentDir => {
                parts.pop()?;
            }
            std::path::Component::Normal(name) => parts.push(name.to_str()?.to_string()),
            _ => {}
        }
    }
    Some(parts.join("/"))
}
