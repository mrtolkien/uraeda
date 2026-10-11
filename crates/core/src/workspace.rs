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
    pub uncommitted: bool,
    /// Commits behind its remote branch, when it has both.
    pub behind: Option<usize>,
    pub files: Vec<WorkflowFile>,
    pub step: Step,
    pub problems: Vec<Problem>,
    /// The folder, from the top level: `specs/2026-10-10-cli-core`.
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
    pub text: String,
    pub link: Option<String>,
    pub feature: Option<String>,
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

fn folder_path(kind: Kind, folder: &str) -> String {
    match kind {
        Kind::Feature => format!("specs/{folder}"),
        Kind::Bug => format!("specs/bugs/{folder}"),
    }
}

/// Where files are read from: a commit, or the working tree.
#[derive(Clone, Copy)]
enum From {
    Commit(ObjectId),
    Disk,
}

struct Reader<'a> {
    git: &'a Git,
}

impl Reader<'_> {
    fn read(&self, from: From, path: &str) -> Option<String> {
        let bytes = match from {
            From::Commit(commit) => self.git.read_file(commit, path).ok()??,
            From::Disk => fs::read(self.git.root().join(path)).ok()?,
        };
        String::from_utf8(bytes).ok()
    }

    /// The files directly inside a folder.
    fn files(&self, from: From, dir: &str) -> Vec<String> {
        match from {
            From::Commit(commit) => self
                .git
                .list_files(commit, dir)
                .unwrap_or_default()
                .into_iter()
                .filter_map(|path| {
                    let name = path.strip_prefix(dir)?.strip_prefix('/')?;
                    (!name.contains('/')).then(|| name.to_string())
                })
                .collect(),
            From::Disk => {
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
    fn drafts(&self, from: From) -> Vec<String> {
        let mut drafts = BTreeSet::new();
        for dir in ["specs/drafts", "specs/backlog"] {
            let paths: Vec<String> = match from {
                From::Commit(commit) => self.git.list_files(commit, dir).unwrap_or_default(),
                From::Disk => fs::read_dir(self.git.root().join(dir))
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

    /// The feature and bug folders under `specs/`.
    fn folders(&self, from: From) -> BTreeSet<(Kind, String)> {
        let mut folders = BTreeSet::new();
        for (kind, dir) in [(Kind::Feature, "specs"), (Kind::Bug, "specs/bugs")] {
            let names: Vec<String> = match from {
                From::Commit(commit) => self
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
                From::Disk => fs::read_dir(self.git.root().join(dir))
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

        let priorities_from = match default_tip {
            Some(tip) if !on_default => From::Commit(tip),
            _ => From::Disk,
        };
        let priorities_text = reader
            .read(priorities_from, "specs/PRIORITIES.md")
            .unwrap_or_default();
        let merged = default_tip
            .map(|tip| reader.folders(From::Commit(tip)))
            .unwrap_or_default();

        let mut features: BTreeMap<(Kind, String), Feature> = BTreeMap::new();
        // The working tree: the current branch's feature, and folders not yet committed.
        let current_folder = current_branch.as_deref().and_then(branch_folder);
        let mut on_disk = reader.folders(From::Disk);
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
            let feature = read_feature(&reader, kind, &folder, branch, From::Disk, head);
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
            let mut feature = read_feature(
                &reader,
                kind,
                folder,
                Some(branch.name.clone()),
                From::Commit(tip),
                Some(tip),
            );
            feature.source = source;
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

        let priorities = priorities::parse(&priorities_text)
            .into_iter()
            .map(|entry| {
                let feature = entry
                    .link
                    .as_deref()
                    .and_then(|link| match_feature(link, &features));
                PriorityEntry {
                    section: entry.section,
                    position: entry.position,
                    text: entry.text,
                    link: entry.link,
                    feature,
                }
            })
            .collect();
        let drafts = reader.drafts(priorities_from);
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
    from: From,
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
    let mut feature = Feature::from_texts(kind, folder, texts);
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
        From::Disk => Source::WorkingTree,
        From::Commit(_) => Source::Local,
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
    feature.uncommitted = matches!(from, From::Disk)
        && (feature.texts.iter().any(|(name, text)| {
            let committed_text = committed
                .and_then(|commit| reader.read(From::Commit(commit), &format!("{path}/{name}")));
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
            uncommitted: false,
            behind: None,
            files,
            step: Step::none(),
            problems,
            path,
            proposal_committed: texts.contains_key(first_file),
            decisions_pending: false,
            texts,
        };
        feature.step = steps::step(&feature, PullRequest::Unknown);
        feature
    }
}

/// Whether a decision the spec links is `proposed`, or has a proposed change for this folder.
fn decisions_pending(reader: &Reader<'_>, from: From, dir: &str, folder: &str, spec: &str) -> bool {
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
