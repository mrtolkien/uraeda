//! What the web UI reads, as napi-rs objects: the workspace, a feature, a file with its document
//! and items, a draft. Numbers are `u32` and enums are strings, as JavaScript receives them.

#[cfg(feature = "napi")]
use napi_derive::napi;
use serde::Serialize;

use crate::files::document::{Document, Span};
use crate::files::items::Items;
use crate::files::markdown;
use crate::steps::Step;
use crate::workspace::{Feature, Problem, Workspace};

#[cfg_attr(feature = "napi", napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProblemView {
    pub file: String,
    pub line: Option<u32>,
    pub rule: String,
    pub message: String,
}

impl From<&Problem> for ProblemView {
    fn from(problem: &Problem) -> ProblemView {
        ProblemView {
            file: problem.file.clone(),
            line: problem.line.map(|line| line as u32),
            rule: problem.rule.clone(),
            message: problem.message.clone(),
        }
    }
}

#[cfg_attr(feature = "napi", napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StepView {
    /// `human-gate`, `plan`, `implementation`, `done`, ...
    pub name: String,
    /// `human`, `agent`, or `nobody`.
    pub waits_on: String,
    /// The file waiting for the human, at a gate.
    pub file: Option<String>,
    /// The first unchecked task, for implementation.
    pub task: Option<String>,
}

#[cfg_attr(feature = "napi", napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileSummary {
    pub name: String,
    /// `proposal`, `clarifications`, `spec`, ...
    pub kind: String,
    pub round: Option<u32>,
    pub status: Option<String>,
    /// The first line of its `> [!IMPORTANT]` block.
    pub waiting_line: Option<String>,
}

#[cfg_attr(feature = "napi", napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FeatureView {
    /// `feature` or `bug`.
    pub kind: String,
    pub folder: String,
    pub slug: String,
    /// The title of its proposal or report.
    pub title: String,
    pub branch: Option<String>,
    /// `working-tree`, `local`, `remote`, or `default-branch`.
    pub source: String,
    pub worktree: Option<String>,
    pub uncommitted: bool,
    pub behind: Option<u32>,
    pub files: Vec<FileSummary>,
    pub step: StepView,
    pub problems: Vec<ProblemView>,
    /// For a merged feature, its worktree still there, from the main checkout.
    pub left_worktree: Option<String>,
    /// For a merged feature, its local branch still there.
    pub left_branch: Option<String>,
}

#[cfg_attr(feature = "napi", napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PriorityView {
    /// `next-2`.
    pub id: String,
    /// `now`, `next`, `later`, or `blocked`.
    pub section: String,
    pub position: u32,
    pub text: String,
    pub link: Option<String>,
    /// The folder of the feature it links.
    pub feature: Option<String>,
    /// The draft it links.
    pub draft: Option<String>,
}

#[cfg_attr(feature = "napi", napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceView {
    pub root: String,
    pub default_branch: Option<String>,
    pub current_branch: Option<String>,
    pub features: Vec<FeatureView>,
    pub priorities: Vec<PriorityView>,
    /// The hash of `PRIORITIES.md` as read, for drafting a line by its id.
    pub priorities_hash: String,
    pub drafts: Vec<String>,
    /// The repository's path when it has no `specs/` folder: nothing else is read.
    pub no_specs: Option<String>,
}

/// A file's document and items, at one version.
#[cfg_attr(feature = "napi", napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VersionView {
    pub text: String,
    pub document: Document,
    pub items: Items,
}

/// A workflow file: the version on disk, the version committed at its branch's tip when it
/// differs, and its pending review.
#[cfg_attr(feature = "napi", napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileView {
    /// `<folder>/<name>`.
    pub id: String,
    pub folder: String,
    pub name: String,
    /// From the repository's top level.
    pub path: String,
    pub kind: String,
    pub status: Option<String>,
    pub current: VersionView,
    /// The short hash of the branch's tip.
    pub tip: Option<String>,
    /// The version at the tip, when it differs from `current`.
    pub committed: Option<VersionView>,
    /// The items of its review file, `spec-review.md` for `spec.md`, when there is one.
    pub review: Option<Items>,
    /// Whether the pending review comments on an older version of the file than its tip's.
    pub review_stale: bool,
}

/// A draft or a postponed proposal, for its editor.
#[cfg_attr(feature = "napi", napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DraftView {
    /// From the repository's top level.
    pub path: String,
    pub title: String,
    pub text: String,
    pub hash: String,
    pub document: Document,
    /// Whether its current text is committed.
    pub committed: bool,
    /// The priority line linking it.
    pub entry: Option<PriorityView>,
    /// How many priority changes are not committed, which its commit takes along.
    pub priority_changes: u32,
}

/// A commit an action made.
#[cfg_attr(feature = "napi", napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommitView {
    pub subject: String,
    pub commit: String,
}

/// A feature started.
#[cfg_attr(feature = "napi", napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StartedView {
    pub folder: String,
    pub branch: String,
    pub worktree: Option<String>,
}

/// A feature's next step, as `ura next` gives it, for an agent's run.
#[cfg_attr(feature = "napi", napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NextStepView {
    /// `human-gate`, `plan`, `implementation`, `done`, ...
    pub name: String,
    /// `human`, `agent`, or `nobody`.
    pub waits_on: String,
    /// The skill file to follow, like `skills/uraeda/references/spec.md`.
    pub reference: Option<String>,
    /// The file waiting for the human, at a gate.
    pub file: Option<String>,
    /// The first unchecked task, for implementation.
    pub task: Option<String>,
    /// `open`, `draft`, `changes-requested`, `none`, or `unknown`, when the step depends on it.
    pub pull_request: Option<String>,
}

impl From<&Step> for NextStepView {
    fn from(step: &Step) -> NextStepView {
        NextStepView {
            name: step.name.as_str().to_string(),
            waits_on: kebab(&step.waits_on),
            reference: step.reference.clone(),
            file: step.file.clone(),
            task: step.task.clone(),
            pull_request: step.pull_request.as_ref().map(kebab),
        }
    }
}

/// A feature, its branch, and its next step, with the main checkout's path.
#[cfg_attr(feature = "napi", napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NextView {
    pub folder: String,
    pub branch: Option<String>,
    /// The main checkout's path, whichever worktree the repository was opened from.
    pub main_root: String,
    pub step: NextStepView,
}

/// A section of the proposal template, with the guidance the editor shows while it is empty.
#[cfg_attr(feature = "napi", napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProposalHint {
    pub heading: String,
    pub hint: String,
}

/// A span list for a priority line's markdown.
pub fn spans(markdown: &str) -> Vec<Span> {
    crate::files::document::parse(markdown, "specs")
        .blocks
        .first()
        .map(|block| block.spans.clone())
        .unwrap_or_default()
}

fn kebab<T: Serialize>(value: &T) -> String {
    serde_json::to_value(value)
        .ok()
        .and_then(|v| v.as_str().map(String::from))
        .unwrap_or_default()
}

/// The title of a file: its first `# ` heading.
pub fn title(text: &str) -> Option<String> {
    markdown::Document::parse(text)
        .headings
        .into_iter()
        .find(|h| h.level == 1)
        .map(|h| h.text)
}

impl FeatureView {
    pub fn new(feature: &Feature, extra: &[Problem]) -> FeatureView {
        let first = match feature.kind {
            crate::workspace::Kind::Feature => "proposal.md",
            crate::workspace::Kind::Bug => "report.md",
        };
        FeatureView {
            kind: kebab(&feature.kind),
            folder: feature.folder.clone(),
            slug: feature.slug.clone(),
            title: match feature.file(crate::workspace::FileKind::Record) {
                Some(record) => feature
                    .text(&record.name)
                    .and_then(title)
                    .map(|title| title.strip_prefix("Record: ").unwrap_or(&title).to_string()),
                None => feature.text(first).and_then(title),
            }
            .unwrap_or_else(|| feature.slug.clone()),
            branch: feature.branch.clone(),
            source: kebab(&feature.source),
            worktree: feature.worktree.clone(),
            uncommitted: feature.uncommitted,
            behind: feature.behind.map(|n| n as u32),
            files: feature
                .files
                .iter()
                .map(|file| FileSummary {
                    name: file.name.clone(),
                    kind: kebab(&file.kind),
                    round: file.round,
                    status: file.status.clone(),
                    waiting_line: file.waiting_line.clone(),
                })
                .collect(),
            step: StepView {
                name: feature.step.name.as_str().to_string(),
                waits_on: kebab(&feature.step.waits_on),
                file: feature.step.file.clone(),
                task: feature.step.task.clone(),
            },
            problems: feature
                .problems
                .iter()
                .chain(extra)
                .map(ProblemView::from)
                .collect(),
            left_worktree: feature.left_worktree.clone(),
            left_branch: feature.left_branch.clone(),
        }
    }
}

impl WorkspaceView {
    pub fn new(
        workspace: &Workspace,
        problems: impl Fn(&Feature) -> Vec<Problem>,
    ) -> WorkspaceView {
        WorkspaceView {
            root: workspace.root.to_string_lossy().into_owned(),
            default_branch: workspace.default_branch.clone(),
            current_branch: workspace.current_branch.clone(),
            features: workspace
                .features
                .iter()
                .map(|feature| FeatureView::new(feature, &problems(feature)))
                .collect(),
            priorities: workspace
                .priorities
                .iter()
                .map(|entry| PriorityView {
                    id: format!("{}-{}", entry.section.id(), entry.position),
                    section: entry.section.id().to_string(),
                    position: entry.position as u32,
                    text: entry.text.clone(),
                    link: entry.link.clone(),
                    feature: entry.feature.clone(),
                    draft: entry.draft.clone(),
                })
                .collect(),
            priorities_hash: String::new(),
            drafts: workspace.drafts.clone(),
            no_specs: None,
        }
    }
}
