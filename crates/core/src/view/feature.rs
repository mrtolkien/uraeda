//! A feature as the web UI reads it: its files, its step, and its problems, and a feature started.

#[cfg(feature = "napi")]
use napi_derive::napi;
use serde::Serialize;

use super::{ProblemView, kebab, title};
use crate::files::frontmatter;
use crate::steps::{Step, TaskProgress};
use crate::workspace::{Feature, FileKind, Problem, WorkflowFile};

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
    /// Where the implementation is in the plan's tasks, for implementation.
    pub progress: Option<TaskProgress>,
    /// Whether the implementation is over: the final review or after.
    pub implemented: bool,
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

/// A file's place in its feature's workflow: the proposal or the record first, then
/// the rounds, each round's discovery before its questions, then the rest in `FileKind`'s order.
fn workflow_key(file: &WorkflowFile) -> (u8, u32, FileKind, &str) {
    let stage = match file.kind {
        FileKind::Proposal | FileKind::Record => 0,
        FileKind::Discovery | FileKind::Clarifications => 1,
        _ => 2,
    };
    (stage, file.round.unwrap_or(0), file.kind, &file.name)
}

#[cfg_attr(feature = "napi", napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FeatureView {
    /// `feature` or `change`.
    pub kind: String,
    pub folder: String,
    /// Its folder's path from the top level: `specs/<folder>`, or `specs/changes/<folder>` for a
    /// change, even once it is finished.
    pub path: String,
    pub slug: String,
    /// The title of its proposal, or of its record.
    pub title: String,
    pub branch: Option<String>,
    /// `working-tree`, `local`, `remote`, or `default-branch`.
    pub source: String,
    pub worktree: Option<String>,
    pub uncommitted: bool,
    pub behind: Option<u32>,
    /// Its files in workflow order.
    pub files: Vec<FileSummary>,
    /// The `.html` files of its `mockups/` folder, sorted: from its working tree when its branch
    /// is checked out, otherwise from its branch's tip.
    pub mockups: Vec<String>,
    pub step: StepView,
    pub problems: Vec<ProblemView>,
    /// For a merged feature, its worktree still there, from the main checkout.
    pub left_worktree: Option<String>,
    /// For a merged feature, its local branch still there.
    pub left_branch: Option<String>,
    /// For a finished item, its record's `pull-request` URL.
    pub pull_request: Option<String>,
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

impl From<&Step> for StepView {
    fn from(step: &Step) -> StepView {
        StepView {
            name: step.name.as_str().to_string(),
            waits_on: kebab(&step.waits_on),
            file: step.file.clone(),
            task: step.task.clone(),
            progress: step.progress.clone(),
            implemented: step.implemented,
        }
    }
}

impl FeatureView {
    pub fn new(feature: &Feature, extra: &[Problem]) -> FeatureView {
        let first = crate::workspace::first_file(feature.kind);
        let mut files: Vec<&WorkflowFile> = feature.files.iter().collect();
        files.sort_by(|a, b| workflow_key(a).cmp(&workflow_key(b)));
        FeatureView {
            kind: kebab(&feature.kind),
            folder: feature.folder.clone(),
            path: crate::workspace::folder_path(feature.kind, &feature.folder),
            slug: feature.slug.clone(),
            title: match feature.file(FileKind::Record) {
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
            files: files
                .into_iter()
                .map(|file| FileSummary {
                    name: file.name.clone(),
                    kind: kebab(&file.kind),
                    round: file.round,
                    status: file.status.clone(),
                    waiting_line: file.waiting_line.clone(),
                })
                .collect(),
            mockups: feature.mockups.clone(),
            step: StepView::from(&feature.step),
            problems: feature
                .problems
                .iter()
                .chain(extra)
                .map(ProblemView::from)
                .collect(),
            left_worktree: feature.left_worktree.clone(),
            left_branch: feature.left_branch.clone(),
            pull_request: pull_request(feature),
        }
    }
}

/// The `pull-request` URL of its record, once finished.
fn pull_request(feature: &Feature) -> Option<String> {
    let record = feature.file(FileKind::Record)?;
    let front = frontmatter::parse(feature.text(&record.name)?).ok()?;
    front.text("pull-request").map(String::from)
}
