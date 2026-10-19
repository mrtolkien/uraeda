//! The skill's tables of steps, as a function of a feature's files.

#[cfg(feature = "napi")]
use napi_derive::napi;
use serde::Serialize;

use crate::files::plan;
use crate::workspace::{Feature, FileKind, Kind, first_file};

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum StepName {
    HumanGate,
    Discovery,
    Spec,
    SpecRevision,
    Approval,
    Plan,
    PlanRevision,
    Implementation,
    FinalReview,
    PullRequestChanges,
    PullRequest,
    /// Past its last task, while `gh` cannot tell its pull request's state.
    PullRequestUnknown,
    /// Write the record, or open the pull request or mark it ready, after the final review.
    Finish,
    /// A change's agent: investigate, ask, fix, and open the pull request.
    Change,
    /// Merged into the default branch.
    Done,
    None,
}

impl StepName {
    pub fn as_str(&self) -> &'static str {
        match self {
            StepName::HumanGate => "human-gate",
            StepName::Discovery => "discovery",
            StepName::Spec => "spec",
            StepName::SpecRevision => "spec-revision",
            StepName::Approval => "approval",
            StepName::Plan => "plan",
            StepName::PlanRevision => "plan-revision",
            StepName::Implementation => "implementation",
            StepName::FinalReview => "final-review",
            StepName::PullRequestChanges => "pull-request-changes",
            StepName::PullRequest => "pull-request",
            StepName::PullRequestUnknown => "pull-request-unknown",
            StepName::Finish => "finish",
            StepName::Change => "change",
            StepName::Done => "done",
            StepName::None => "none",
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum WaitsOn {
    Human,
    Agent,
    /// Nothing is left to do: the feature is merged.
    Nobody,
}

/// The state of a branch's pull request.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum PullRequest {
    /// Open and ready for review.
    Open,
    /// Open as a draft: the final review is done, and the feature is being finished.
    Draft,
    ChangesRequested,
    #[serde(rename = "none")]
    NoPullRequest,
    Unknown,
}

/// What a feature waits for next.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub struct Step {
    pub name: StepName,
    pub waits_on: WaitsOn,
    /// The skill file to follow, like `skills/uraeda/references/spec.md`.
    pub reference: Option<String>,
    /// The file waiting for the human, at a gate.
    pub file: Option<String>,
    /// The first unchecked task, for implementation.
    pub task: Option<String>,
    /// Where the implementation is in the plan's tasks, for implementation.
    pub progress: Option<TaskProgress>,
    /// Whether the implementation is over: for a feature, every task of the plan is done, and it is
    /// past them, at its final review or after; for a change, it is past its gates, at its `change`
    /// step or after.
    pub implemented: bool,
    pub pull_request: Option<PullRequest>,
    /// The approved spec's `plan-review`, for the steps before the plan is approved: whether the
    /// plan waits for the human's review.
    pub plan_review: Option<bool>,
}

/// The plan's progress during the implementation: the first task with an unchecked step.
#[cfg_attr(feature = "napi", napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskProgress {
    /// Its position among the plan's tasks, from 1, whatever its `## Task N` number.
    pub position: u32,
    /// The number of tasks in the plan.
    pub total: u32,
    /// Its title, as written after `## Task N:`.
    pub title: String,
}

impl Step {
    fn new(name: StepName, waits_on: WaitsOn) -> Step {
        Step {
            name,
            waits_on,
            reference: None,
            file: None,
            task: None,
            progress: None,
            implemented: false,
            pull_request: None,
            plan_review: None,
        }
    }

    fn gate(file: &str) -> Step {
        Step {
            file: Some(file.to_string()),
            ..Step::new(StepName::HumanGate, WaitsOn::Human)
        }
    }

    fn agent(name: StepName, reference: &str) -> Step {
        Step {
            reference: Some(format!("skills/uraeda/references/{reference}.md")),
            ..Step::new(name, WaitsOn::Agent)
        }
    }

    pub fn none() -> Step {
        Step::new(StepName::None, WaitsOn::Agent)
    }

    /// The step of a feature merged into the default branch.
    pub fn done() -> Step {
        Step {
            implemented: true,
            ..Step::new(StepName::Done, WaitsOn::Nobody)
        }
    }

    /// Whether the pull request's state decides this step.
    pub fn depends_on_pull_request(&self) -> bool {
        self.pull_request.is_some()
    }

    /// Its position in the workflow, from the proposal's gate, 0, to `none`, 14: a gate is placed
    /// by the file it waits on, and a change's agent step with the implementation.
    pub fn order(&self) -> u32 {
        match self.name {
            StepName::HumanGate => match self.file.as_deref().and_then(FileKind::of) {
                Some((FileKind::Spec, _)) => 4,
                Some((FileKind::Plan, _)) => 7,
                Some((FileKind::Clarifications, _)) => 2,
                _ => 0,
            },
            StepName::Discovery => 1,
            StepName::Spec | StepName::SpecRevision => 3,
            StepName::Approval => 5,
            StepName::Plan | StepName::PlanRevision => 6,
            StepName::Implementation | StepName::Change => 8,
            StepName::FinalReview => 9,
            StepName::Finish => 10,
            StepName::PullRequestChanges => 11,
            StepName::PullRequest | StepName::PullRequestUnknown => 12,
            StepName::Done => 13,
            StepName::None => 14,
        }
    }
}

/// The step of a feature or a change, from the skill's tables.
pub fn step(feature: &Feature, pull_request: PullRequest) -> Step {
    if !feature.problems.is_empty() {
        return Step::none();
    }
    if feature.is_finished() {
        return finished_step(feature.kind, pull_request);
    }
    match feature.kind {
        Kind::Feature => feature_step(feature, pull_request),
        Kind::Change => change_step(feature, pull_request),
    }
}

/// A feature or change whose folder was replaced by its record: what is left of finishing, then the
/// pull request, whose changes its own step's reference handles.
fn finished_step(kind: Kind, pull_request: PullRequest) -> Step {
    let changes = match kind {
        Kind::Feature => "implementation",
        Kind::Change => "change",
    };
    let step = match pull_request {
        PullRequest::NoPullRequest | PullRequest::Draft => Step::agent(StepName::Finish, "finish"),
        PullRequest::ChangesRequested => Step::agent(StepName::PullRequestChanges, changes),
        PullRequest::Open => Step::new(StepName::PullRequest, WaitsOn::Human),
        PullRequest::Unknown => Step::agent(StepName::PullRequestUnknown, "finish"),
    };
    Step {
        implemented: true,
        pull_request: Some(pull_request),
        ..step
    }
}

fn feature_step(feature: &Feature, pull_request: PullRequest) -> Step {
    if !feature.proposal_committed {
        return Step::gate(first_file(feature.kind));
    }
    if let Some(gate) = waiting_gate(feature) {
        return gate;
    }
    let files = &feature.files;
    let latest = files
        .iter()
        .filter(|file| file.kind == FileKind::Clarifications)
        .max_by_key(|file| file.round);
    let Some(latest) = latest else {
        return Step::agent(StepName::Discovery, "discovery");
    };
    let round = latest.round.unwrap_or(0);
    let spec = feature.file(FileKind::Spec);
    let spec_status = spec.and_then(|file| file.status.as_deref());
    let spec_text = feature.text("spec.md");
    let spec_number = |key: &str| {
        spec_text.and_then(|text| crate::files::frontmatter::parse(text).ok()?.integer(key))
    };
    // A round answered to continue the implementation leaves the approved spec as it is.
    let resumes = feature
        .text(&latest.name)
        .and_then(|text| crate::files::frontmatter::parse(text).ok())
        .is_some_and(|front| front.text("resumes") == Some("implementation"))
        && building(feature);
    if latest.status.as_deref() == Some("answered")
        && !resumes
        && (spec.is_none() || spec_number("clarifications").unwrap_or(0) < i64::from(round))
    {
        return Step::agent(StepName::Spec, "spec");
    }
    match spec_status {
        Some("changes-requested") => return Step::agent(StepName::SpecRevision, "spec"),
        Some("approved") => {}
        _ => return Step::none(),
    }
    // A spec without `plan-review` has `false`.
    let plan_review = spec_text
        .and_then(|text| crate::files::frontmatter::parse(text).ok())
        .and_then(|front| match front.get("plan-review") {
            Some(crate::files::frontmatter::Value::Bool(value)) => Some(*value),
            _ => None,
        })
        .unwrap_or(false);
    let before_the_plan = |name: StepName, reference: &str| Step {
        plan_review: Some(plan_review),
        ..Step::agent(name, reference)
    };
    if feature.decisions_pending {
        return before_the_plan(StepName::Approval, "approval");
    }
    let Some(plan_file) = feature.file(FileKind::Plan) else {
        return before_the_plan(StepName::Plan, "plan");
    };
    let plan_text = feature.text("plan.md").unwrap_or_default();
    let plan_revision = crate::files::frontmatter::parse(plan_text)
        .ok()
        .and_then(|front| front.integer("spec-revision"))
        .unwrap_or(0);
    if plan_revision < spec_number("revision").unwrap_or(1) {
        return before_the_plan(StepName::PlanRevision, "plan");
    }
    match plan_file.status.as_deref() {
        Some("changes-requested") => return before_the_plan(StepName::PlanRevision, "plan"),
        Some("approved" | "auto-approved") => {}
        _ => return Step::none(),
    }
    let tasks = plan::tasks(plan_text, &feature.path);
    if let Some((index, task)) = tasks
        .iter()
        .enumerate()
        .find(|(_, task)| task.done < task.total)
    {
        return Step {
            task: Some(format!("Task {}: {}", task.number, task.title)),
            progress: Some(TaskProgress {
                position: index as u32 + 1,
                total: tasks.len() as u32,
                title: task.title.clone(),
            }),
            ..Step::agent(StepName::Implementation, "implementation")
        };
    }
    after_the_last_step(pull_request, StepName::FinalReview, "implementation")
}

/// Whether a feature is being built: its spec is approved, and its approved plan has an unchecked
/// step. A round asked then may be answered to continue the implementation.
pub fn building(feature: &Feature) -> bool {
    let status = |kind| feature.file(kind).and_then(|file| file.status.as_deref());
    status(FileKind::Spec) == Some("approved")
        && matches!(status(FileKind::Plan), Some("approved" | "auto-approved"))
        && plan::tasks(feature.text("plan.md").unwrap_or_default(), &feature.path)
            .iter()
            .any(|task| task.done < task.total)
}

fn after_the_last_step(pull_request: PullRequest, without: StepName, reference: &str) -> Step {
    let step = match pull_request {
        PullRequest::NoPullRequest => Step::agent(without, reference),
        PullRequest::Draft => Step::agent(StepName::Finish, "finish"),
        PullRequest::ChangesRequested => Step::agent(StepName::PullRequestChanges, reference),
        PullRequest::Open => Step::new(StepName::PullRequest, WaitsOn::Human),
        PullRequest::Unknown => Step::agent(StepName::PullRequestUnknown, reference),
    };
    Step {
        implemented: true,
        pull_request: Some(pull_request),
        ..step
    }
}

/// The gate on the last file waiting for the human, if any.
fn waiting_gate(feature: &Feature) -> Option<Step> {
    feature
        .files
        .iter()
        .rev()
        .find(|file| file.status.as_deref() == Some("awaiting-human"))
        .map(|file| Step::gate(&file.name))
}

/// A change's step: a gate until its proposal is committed, and on a round waiting for the human;
/// otherwise its agent's, then the pull request's, as a feature's after its last task. An unknown
/// pull request is the agent's step, `change`, since a change's agent opens its draft pull request
/// itself.
fn change_step(feature: &Feature, pull_request: PullRequest) -> Step {
    if !feature.proposal_committed {
        return Step::gate(first_file(feature.kind));
    }
    if let Some(gate) = waiting_gate(feature) {
        return gate;
    }
    let known = match pull_request {
        PullRequest::Unknown => PullRequest::NoPullRequest,
        known => known,
    };
    Step {
        pull_request: Some(pull_request),
        ..after_the_last_step(known, StepName::Change, "change")
    }
}

/// The skill's target rule: the first feature of **Now** whose step waits on an agent.
pub fn next_target(workspace: &crate::workspace::Workspace) -> Option<usize> {
    use crate::files::priorities::Section;
    workspace
        .priorities
        .iter()
        .filter(|entry| entry.section == Section::Now)
        .filter_map(|entry| entry.feature.as_deref())
        .filter_map(|folder| workspace.features.iter().position(|f| f.folder == folder))
        .find(|&index| {
            let step = &workspace.features[index].step;
            step.waits_on == WaitsOn::Agent && step.name != StepName::None
        })
}
