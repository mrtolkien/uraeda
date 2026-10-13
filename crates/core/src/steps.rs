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
    /// Write the record, or open the pull request or mark it ready, after the final review.
    Finish,
    Assess,
    AssessRevision,
    Fix,
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
            StepName::Finish => "finish",
            StepName::Assess => "assess",
            StepName::AssessRevision => "assess-revision",
            StepName::Fix => "fix",
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

    /// The step of a feature merged into the default branch.
    pub fn done() -> Step {
        Step::new(StepName::Done, WaitsOn::Nobody)
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
    if feature.is_finished() {
        return finished_step(pull_request);
    }
    match feature.kind {
        Kind::Feature => feature_step(feature, pull_request),
        Kind::Bug => bug_step(feature, pull_request),
    }
}

/// A feature or bug whose folder was replaced by its record: what is left of finishing, then the
/// pull request.
fn finished_step(pull_request: PullRequest) -> Step {
    let step = match pull_request {
        PullRequest::NoPullRequest | PullRequest::Draft => Step::agent(StepName::Finish, "finish"),
        PullRequest::ChangesRequested => {
            Step::agent(StepName::PullRequestChanges, "implementation")
        }
        PullRequest::Open => Step::new(StepName::PullRequest, WaitsOn::Human),
        PullRequest::Unknown => Step::agent(StepName::PullRequest, "finish"),
    };
    Step {
        pull_request: Some(pull_request),
        ..step
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
        PullRequest::Draft => Step::agent(StepName::Finish, "finish"),
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

/// A branch's pull request in the repository at `repo`, through `gh` when it is installed and
/// logged in. `gh` runs there, since it finds the repository from its current folder.
pub fn pull_request(repo: &std::path::Path, branch: &str) -> PullRequest {
    let Ok(output) = std::process::Command::new("gh")
        .current_dir(repo)
        .args([
            "pr",
            "list",
            "--head",
            branch,
            "--state",
            "open",
            "--json",
            "reviewDecision,isDraft",
        ])
        .output()
    else {
        return PullRequest::Unknown;
    };
    if !output.status.success() {
        return PullRequest::Unknown;
    }
    pull_request_state(&output.stdout)
}

/// A pull request's state from `gh pr list --json reviewDecision,isDraft`: changes requested
/// first, even on a draft, since the human's feedback comes before finishing.
pub fn pull_request_state(json: &[u8]) -> PullRequest {
    let Ok(list) = serde_json::from_slice::<Vec<serde_json::Value>>(json) else {
        return PullRequest::Unknown;
    };
    match list.first() {
        None => PullRequest::NoPullRequest,
        Some(pr) if pr["reviewDecision"] == "CHANGES_REQUESTED" => PullRequest::ChangesRequested,
        Some(pr) if pr["isDraft"] == true => PullRequest::Draft,
        Some(_) => PullRequest::Open,
    }
}

/// The skill's target rule: the first feature of **Now** whose step waits on an agent, asking
/// `lookup` for the pull request of the features at the pull request rows.
pub fn next_target(
    workspace: &mut crate::workspace::Workspace,
    lookup: impl Fn(&str) -> PullRequest,
) -> Option<usize> {
    use crate::files::priorities::Section;
    let folders: Vec<String> = workspace
        .priorities
        .iter()
        .filter(|entry| entry.section == Section::Now)
        .filter_map(|entry| entry.feature.clone())
        .collect();
    for folder in folders {
        let Some(index) = workspace.features.iter().position(|f| f.folder == folder) else {
            continue;
        };
        let feature = &mut workspace.features[index];
        refresh_pull_request(feature, &lookup);
        if feature.step.waits_on == WaitsOn::Agent && feature.step.name != StepName::None {
            return Some(index);
        }
    }
    None
}

/// Recomputes a feature's step with its pull request's state, when the step depends on it.
pub fn refresh_pull_request(
    feature: &mut crate::workspace::Feature,
    lookup: impl Fn(&str) -> PullRequest,
) {
    if feature.step.depends_on_pull_request()
        && let Some(branch) = feature.branch.clone()
    {
        feature.with_pull_request(lookup(&branch));
    }
}
