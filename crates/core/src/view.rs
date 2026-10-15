//! What the web UI reads, as napi-rs objects: the workspace, a feature, a file with its document
//! and items, a draft. Numbers are `u32` and enums are strings, as JavaScript receives them.

#[cfg(feature = "napi")]
use napi_derive::napi;
use serde::Serialize;

use crate::files::document::{Document, Span};
use crate::files::items::Items;
use crate::files::markdown;
use crate::steps::{Step, TaskProgress};
use crate::workspace::{Feature, FileKind, Problem, Workspace};

mod feature;

pub use feature::{FeatureView, FileSummary, StartedView, StepView};

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
pub struct PriorityView {
    /// `next-2`.
    pub id: String,
    /// Its address, `/priorities/<key>`: the linked draft's name, or the slug of its text.
    pub key: String,
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
    /// Whether images can be attached to it: a feature's or a change's file can, the inbox's
    /// triage, committed alone, cannot.
    pub takes_images: bool,
}

/// The name of a file's kind, as the web UI reads it: empty for none.
pub(crate) fn kind_name(kind: Option<FileKind>) -> String {
    kind.and_then(|kind| serde_json::to_value(kind).ok())
        .and_then(|value| value.as_str().map(String::from))
        .unwrap_or_default()
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
    /// `draft` for a file of `specs/drafts/` or `specs/backlog/`, or `proposal`.
    pub kind: String,
    /// The feature's or the change's folder, for a proposal.
    pub folder: Option<String>,
    /// The slug Start gives a draft's feature unless another is typed.
    pub slug: Option<String>,
    /// The effort its `discovery` field asks for, `high` by default.
    pub discovery: Option<String>,
    /// The discovery efforts it may ask for, from the least research to the most.
    pub discovery_levels: Vec<String>,
    /// Whether it holds more than its title and What: text in any other part of it.
    pub written: bool,
    /// The headings of its `##` sections that hold no text yet.
    pub empty_sections: Vec<String>,
}

/// A commit an action made.
#[cfg_attr(feature = "napi", napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommitView {
    pub subject: String,
    pub commit: String,
}

/// An image attached to a workflow file.
#[cfg_attr(feature = "napi", napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AttachedView {
    /// The image's path, from the top level.
    pub path: String,
    /// The markdown to insert, linking the image from the file.
    pub link: String,
    /// The file's new path, when a single-file draft became a folder.
    pub moved: Option<String>,
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
    /// Where the implementation is in the plan's tasks, for implementation.
    pub progress: Option<TaskProgress>,
    /// `open`, `draft`, `changes-requested`, `none`, or `unknown`, when the step depends on it.
    pub pull_request: Option<String>,
    /// Whether the plan waits for the human's review, for the steps before it is approved.
    pub plan_review: Option<bool>,
}

impl From<&Step> for NextStepView {
    fn from(step: &Step) -> NextStepView {
        NextStepView {
            name: step.name.as_str().to_string(),
            waits_on: kebab(&step.waits_on),
            reference: step.reference.clone(),
            file: step.file.clone(),
            task: step.task.clone(),
            progress: step.progress.clone(),
            pull_request: step.pull_request.as_ref().map(kebab),
            plan_review: step.plan_review,
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

/// A workflow file waiting for the human, in the checkout that has it. Not exposed to the binding:
/// the language server reads it.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WaitingFile {
    /// The feature's or the change's slug: `codex-runtime`.
    pub feature: String,
    pub folder: String,
    /// `clarifications-01.md`.
    pub file: String,
    /// Absolute, in the checkout that has the feature's branch.
    pub path: String,
    /// The 1-based line of its `> [!IMPORTANT]` block, or 1 without one.
    pub line: u32,
    /// The block's first line: "7 questions, about 25 minutes.", or empty without a block.
    pub text: String,
}

/// What a priorities entry links to: a feature or a change and its step, or a draft. Not exposed to
/// the binding: the language server reads it.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PriorityLink {
    /// The entry's first line, 1-based.
    pub line: u32,
    /// The folder of the feature it links.
    pub feature: Option<String>,
    /// That feature's step.
    pub step: Option<StepView>,
    /// The draft it links, from the top level.
    pub draft: Option<String>,
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
                    key: entry.key.clone(),
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

/// A repository of the list.
// `Repository` in JavaScript, where the core's own `Repository` has no type.
#[cfg_attr(feature = "napi", napi(object, js_name = "Repository"))]
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RepositoryView {
    /// Unique in the list, the `<name>` of its `/r/<name>/` URLs.
    pub name: String,
    /// The main checkout, absolute.
    pub path: String,
    /// When it was added or last opened, in RFC 3339, in UTC.
    pub opened_at: String,
    /// The folder no longer holds the main checkout of a git repository.
    pub missing: bool,
}

impl From<crate::repositories::Repository> for RepositoryView {
    fn from(repository: crate::repositories::Repository) -> Self {
        RepositoryView {
            name: repository.name,
            path: repository.path.to_string_lossy().into_owned(),
            opened_at: repository.opened_at,
            missing: repository.missing,
        }
    }
}

/// A repository added to the list, or found listed already.
// `Added` in JavaScript.
#[cfg_attr(feature = "napi", napi(object, js_name = "Added"))]
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AddedView {
    pub repository: RepositoryView,
    pub existed: bool,
}

impl From<crate::repositories::Added> for AddedView {
    fn from(added: crate::repositories::Added) -> Self {
        AddedView {
            repository: added.repository.into(),
            existed: added.existed,
        }
    }
}
