//! A feature or a change as the core reads it, its step, and its status: what the workspace, a
//! feature's own record, and the sessions all show.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// A feature's status, decided in one place from its step and its sessions: every view and the
/// notifications read it.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct FeatureStatus {
    /// What it reads as.
    pub status: SessionStatus,
    /// The status in words, like `Needs you`.
    pub label: String,
    /// Why it needs the human, or works with no turn running.
    pub reason: Option<StatusReason>,
    /// The session it follows: a running one, else the latest. None without one.
    pub session: Option<String>,
    /// That session's latest turn: what Dismiss names. None without one.
    pub turn: Option<String>,
    /// When that turn's run continues by itself, while it waits.
    pub wait: Option<Wait>,
}

/// A session's or a feature's status, in the sidebar and its view.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "kebab-case")]
pub enum SessionStatus {
    /// An agent runs, is queued, or waits to continue by itself.
    Working,
    /// It waits on the human.
    NeedsYou,
    /// Its latest run ended early.
    Attention,
    /// A reply the human has not read.
    Unread,
    /// Nothing waits, and nothing runs.
    Idle,
}

/// Why a status needs the human, or works with no turn running.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "kebab-case")]
pub enum StatusReason {
    /// An action to allow.
    Blocked,
    /// A step that waits on the human.
    Step,
    /// The latest turn failed.
    Failed,
    /// The human stopped it.
    Stopped,
    /// The server stopped it.
    Interrupted,
    /// It ran the workflow, and ended before a human gate.
    Halted,
    /// It caught up with the default branch, and ended on a conflict.
    Conflict,
    /// Its automatic continues reached their cap.
    Capped,
    /// It waits to continue by itself.
    Waiting,
    /// Its step waits on an agent no run follows: a run starts only at the human's Continue.
    Continue,
}

/// When a waiting run continues by itself.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Wait {
    /// When, in RFC 3339.
    pub at: String,
    /// Why it waits, as the run lifecycle names it.
    pub reason: String,
}

/// A feature or a change, as the core reads it from its branch.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct FeatureView {
    /// `feature` or `change`.
    pub kind: String,
    /// Its folder, `YYYY-MM-DD-<slug>`.
    pub folder: String,
    /// Its folder's path from the top level: `specs/<folder>`, or `specs/changes/<folder>` for a
    /// change, even once it is finished.
    pub path: String,
    /// Its slug.
    pub slug: String,
    /// The title of its proposal, or of its record.
    pub title: String,
    /// Its branch.
    pub branch: Option<String>,
    /// `working-tree`, `local`, `remote`, or `default-branch`.
    pub source: String,
    /// Its worktree, when its branch is checked out in one.
    pub worktree: Option<String>,
    /// Whether its worktree has changes not committed.
    pub uncommitted: bool,
    /// How many commits of the default branch its branch lacks.
    pub behind: Option<u32>,
    /// Its files, in workflow order.
    pub files: Vec<FileSummary>,
    /// The `.html` files of its `mockups/` folder, sorted.
    pub mockups: Vec<String>,
    /// Its step.
    pub step: StepView,
    /// What stops the workflow. Home and the sidebar flag the feature.
    pub problems: Vec<ProblemView>,
    /// The check's other results, shown only on its page.
    pub notes: Vec<ProblemView>,
    /// For a merged feature, its worktree still there, from the main checkout.
    pub left_worktree: Option<String>,
    /// For a merged feature, its local branch still there.
    pub left_branch: Option<String>,
    /// Its branch's open pull request; else, once finished, its record's, read as open.
    pub pull_request: Option<PullRequestView>,
}

/// A feature's step in the workflow.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct StepView {
    /// `human-gate`, `plan`, `implementation`, `done`, and the others.
    pub name: String,
    /// `human`, `agent`, or `nobody`.
    pub waits_on: String,
    /// The file waiting for the human, at a gate.
    pub file: Option<String>,
    /// That file's kind, `clarifications`, `spec`, `plan`: what the gate asks of the human.
    pub file_kind: Option<String>,
    /// The task `progress` names, as `Task N: title`, for implementation.
    pub task: Option<String>,
    /// Where the implementation is in the plan's tasks, for implementation.
    pub progress: Option<TaskProgress>,
    /// Whether the implementation is over: the final review or after.
    pub implemented: bool,
    /// Its position in the workflow, from the proposal's gate, 0, to `none`, 14.
    pub order: u32,
    /// The default branch's commit to catch up with, at `catch-up`.
    pub catch_up: Option<CatchUpView>,
}

/// The plan's progress during the implementation.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct TaskProgress {
    /// The tasks whose boxes are all checked.
    pub done: u32,
    /// The number of tasks in the plan.
    pub total: u32,
    /// The first task left: its title, as written after `## Task N:`.
    pub title: String,
}

/// What a branch behind the default branch catches up with, at the step `catch-up`.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct CatchUpView {
    /// The default branch's name, like `main`.
    pub branch: String,
    /// The full hash of the default branch's tip to catch up with.
    pub commit: String,
    /// That commit's subject line.
    pub subject: String,
}

/// A workflow file of a feature, in short.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct FileSummary {
    /// Its name, like `spec.md`.
    pub name: String,
    /// `proposal`, `clarifications`, `spec`, and the others.
    pub kind: String,
    /// Its round, for a file of a round.
    pub round: Option<u32>,
    /// Its status, as its frontmatter has it.
    pub status: Option<String>,
    /// The first line of its `> [!IMPORTANT]` block.
    pub waiting_line: Option<String>,
}

/// A problem the check found in a workflow file.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ProblemView {
    /// The file it is in.
    pub file: String,
    /// The line it is on, from 1.
    pub line: Option<u32>,
    /// The rule it breaks.
    pub rule: String,
    /// What is wrong, for a person.
    pub message: String,
    /// Whether the fix of moved links repairs it.
    pub fixable: bool,
}

/// A branch's open pull request.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct PullRequestView {
    /// Its number.
    pub number: u32,
    /// Its address, like `https://github.com/o/r/pull/31`.
    pub url: String,
    /// Its state.
    pub state: PullRequestState,
    /// Its head commit's full hash, as read on GitHub: empty when read from a record.
    pub head: String,
}

/// An open pull request's state.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "kebab-case")]
pub enum PullRequestState {
    /// Not ready for review yet.
    Draft,
    /// Ready for review.
    Open,
    /// A review asked for changes.
    ChangesRequested,
}

/// A proposal of `PRIORITIES.md`.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ProposalView {
    /// Its section and its place there, like `next-2`.
    pub id: String,
    /// Its address, `/priorities/<key>`: the linked proposal file's name, or the slug of its
    /// text.
    pub key: String,
    /// `now`, `next`, `later`, or `blocked`.
    pub section: String,
    /// Its place in its section.
    pub position: u32,
    /// Its text.
    pub text: String,
    /// What it links.
    pub link: Option<String>,
    /// The folder of the feature it links.
    pub feature: Option<String>,
    /// The proposal file it links.
    pub file: Option<String>,
}
