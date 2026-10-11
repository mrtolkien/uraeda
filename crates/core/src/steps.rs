//! The skill's tables of steps, as a function of a feature's files.

use serde::Serialize;

use crate::files::plan;
use crate::workspace::{Feature, FileKind, Kind};

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
    Assess,
    AssessRevision,
    Fix,
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
            StepName::Assess => "assess",
            StepName::AssessRevision => "assess-revision",
            StepName::Fix => "fix",
            StepName::None => "none",
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum WaitsOn {
    Human,
    Agent,
}

/// The state of a branch's pull request.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum PullRequest {
    Open,
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
    pub pull_request: Option<PullRequest>,
}

impl Step {
    fn new(name: StepName, waits_on: WaitsOn) -> Step {
        Step {
            name,
            waits_on,
            reference: None,
            file: None,
            task: None,
            pull_request: None,
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

    /// Whether the pull request's state decides this step.
    pub fn depends_on_pull_request(&self) -> bool {
        self.pull_request.is_some()
    }
}

/// The step of a feature or a bug, from the skill's tables.
pub fn step(feature: &Feature, pull_request: PullRequest) -> Step {
    if !feature.problems.is_empty() {
        return Step::none();
    }
    match feature.kind {
        Kind::Feature => feature_step(feature, pull_request),
        Kind::Bug => bug_step(feature, pull_request),
    }
}

fn feature_step(feature: &Feature, pull_request: PullRequest) -> Step {
    if !feature.proposal_committed {
        return Step::gate("proposal.md");
    }
    let files = &feature.files;
    if let Some(waiting) = files
        .iter()
        .rev()
        .find(|file| file.status.as_deref() == Some("awaiting-human"))
    {
        return Step::gate(&waiting.name);
    }
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
    if latest.status.as_deref() == Some("answered")
        && (spec.is_none() || spec_number("clarifications").unwrap_or(0) < i64::from(round))
    {
        return Step::agent(StepName::Spec, "spec");
    }
    match spec_status {
        Some("changes-requested") => return Step::agent(StepName::SpecRevision, "spec"),
        Some("approved") => {}
        _ => return Step::none(),
    }
    if feature.decisions_pending {
        return Step::agent(StepName::Approval, "approval");
    }
    let Some(plan_file) = feature.file(FileKind::Plan) else {
        return Step::agent(StepName::Plan, "plan");
    };
    let plan_text = feature.text("plan.md").unwrap_or_default();
    let plan_revision = crate::files::frontmatter::parse(plan_text)
        .ok()
        .and_then(|front| front.integer("spec-revision"))
        .unwrap_or(0);
    if plan_revision < spec_number("revision").unwrap_or(1) {
        return Step::agent(StepName::PlanRevision, "plan");
    }
    match plan_file.status.as_deref() {
        Some("changes-requested") => return Step::agent(StepName::PlanRevision, "plan"),
        Some("approved" | "auto-approved") => {}
        _ => return Step::none(),
    }
    if let Some(task) = plan::tasks(plan_text)
        .into_iter()
        .find(|task| task.done < task.total)
    {
        return Step {
            task: Some(format!("Task {}: {}", task.number, task.title)),
            ..Step::agent(StepName::Implementation, "implementation")
        };
    }
    after_the_last_step(pull_request, StepName::FinalReview, "implementation")
}

fn after_the_last_step(pull_request: PullRequest, without: StepName, reference: &str) -> Step {
    let step = match pull_request {
        PullRequest::NoPullRequest => Step::agent(without, reference),
        PullRequest::ChangesRequested => Step::agent(StepName::PullRequestChanges, reference),
        PullRequest::Open => Step::new(StepName::PullRequest, WaitsOn::Human),
        PullRequest::Unknown => Step::agent(StepName::PullRequest, reference),
    };
    Step {
        pull_request: Some(pull_request),
        ..step
    }
}

fn bug_step(feature: &Feature, pull_request: PullRequest) -> Step {
    if !feature.proposal_committed {
        return Step::gate("report.md");
    }
    let Some(assessment) = feature.file(FileKind::Assessment) else {
        return Step::agent(StepName::Assess, "bug");
    };
    match assessment.status.as_deref() {
        Some("awaiting-human") => return Step::gate("assessment.md"),
        Some("changes-requested") => return Step::agent(StepName::AssessRevision, "bug"),
        Some("approved") => {}
        _ => return Step::none(),
    }
    let (done, total) = plan::checkboxes(feature.text("assessment.md").unwrap_or_default());
    if done < total {
        return Step::agent(StepName::Fix, "bug");
    }
    after_the_last_step(pull_request, StepName::Fix, "bug")
}

/// A branch's pull request, through `gh` when it is installed and logged in.
pub fn pull_request(branch: &str) -> PullRequest {
    let Ok(output) = std::process::Command::new("gh")
        .args([
            "pr",
            "list",
            "--head",
            branch,
            "--state",
            "open",
            "--json",
            "reviewDecision",
        ])
        .output()
    else {
        return PullRequest::Unknown;
    };
    if !output.status.success() {
        return PullRequest::Unknown;
    }
    let Ok(list) = serde_json::from_slice::<Vec<serde_json::Value>>(&output.stdout) else {
        return PullRequest::Unknown;
    };
    match list.first() {
        None => PullRequest::NoPullRequest,
        Some(pr) if pr["reviewDecision"] == "CHANGES_REQUESTED" => PullRequest::ChangesRequested,
        Some(_) => PullRequest::Open,
    }
}
