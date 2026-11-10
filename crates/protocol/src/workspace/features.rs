//! A repository's workspace: its features and changes in flight, each with its step and its
//! status, its priorities, and what it lacks to be set up. And the slug of a typed start.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::registry::Record;

// JOIN(wave 6): the record `Feature` (task 8) and the sessions (task 15) need the feature's view,
// its step, and its status too: `FeatureView` and the types under it, `FeatureStatus`,
// `SessionStatus`, `StatusReason`, and `Wait` get one declaration.

/// Which repository.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceArgs {
    /// The repository's name in the list.
    pub repo: String,
}

/// A repository's workspace, as the sidebar and home read it.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Workspace {
    /// The main checkout, absolute.
    pub root: String,
    /// The default branch, like `main`.
    pub default_branch: Option<String>,
    /// The branch the main checkout has checked out.
    pub current_branch: Option<String>,
    /// Its features and changes.
    pub features: Vec<WorkspaceFeature>,
    /// The proposals of `PRIORITIES.md`, in the file's order.
    pub priorities: Vec<ProposalView>,
    /// The hash of `PRIORITIES.md` as read, for expanding a proposal by its id.
    pub priorities_hash: String,
    /// The proposal files and postponed folders, from the top level.
    pub proposals: Vec<String>,
    /// The repository's path when it has no `specs/` folder: nothing else is read.
    pub no_specs: Option<String>,
    /// What the project lacks to be set up, in the setup's order: every item while a required one
    /// is not written, and none once it is set up.
    pub setup: Vec<SetupItem>,
    /// Whether the main checkout has an active preview decision.
    pub preview: bool,
}

impl Record for Workspace {
    const NAME: &'static str = "Workspace";
    type Args = WorkspaceArgs;
    type Value = Self;
}

/// A feature or a change of a workspace: the core's view of it, with its name in the sidebar and
/// its status.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceFeature {
    /// Its folder, which names it in a change.
    pub id: String,
    /// The name the human gave it in the sidebar. No workflow rule reads it.
    pub label: Option<String>,
    /// Whether it needs the human, works, or waits.
    pub status: FeatureStatus,
    /// What the core reads of it.
    #[serde(flatten)]
    pub feature: FeatureView,
}

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

/// An item of the setup.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct SetupItem {
    /// `specs`, `constitution`, `code-quality`, `testing`, or `preview`.
    pub key: String,
    /// What the human reads, like `Code-quality decision`.
    pub name: String,
    /// `missing`, `template` for a constitution still holding a placeholder, or `written`.
    pub state: String,
    /// Whether the project is set up only once it is written: the preview decision is not.
    pub required: bool,
}

/// The text typed for a start.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct SlugProposalArgs {
    /// The change, as typed.
    pub text: String,
}

/// The slug the core proposes for a typed start, and the research efforts a feature may ask
/// for: the start dialog shows them. It is read once, and never changes.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct SlugProposal {
    /// The slug proposed.
    pub slug: String,
    /// The research efforts, the lightest first.
    pub discovery_levels: Vec<String>,
}

impl Record for SlugProposal {
    const NAME: &'static str = "SlugProposal";
    type Args = SlugProposalArgs;
    type Value = Self;
}
