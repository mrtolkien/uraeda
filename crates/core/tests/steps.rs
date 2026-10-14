mod common;

use std::collections::BTreeMap;

use common::texts::*;
use uraeda_core::steps::{PullRequest, StepName, WaitsOn};
use uraeda_core::workspace::{Feature, Kind};

/// A feature's files: names and texts.
type Files = Vec<(&'static str, String)>;

fn feature(kind: Kind, files: &[(&str, String)]) -> Feature {
    let texts: BTreeMap<String, String> = files
        .iter()
        .map(|(name, text)| (name.to_string(), text.clone()))
        .collect();
    Feature::from_texts(kind, "2026-10-10-x", texts)
}

fn answered() -> String {
    clarifications("answered", "Answered on 2026-10-08.", &["A"])
}

fn waiting() -> String {
    clarifications("awaiting-human", "1 question, about 3 minutes.", &[""])
}

#[test]
#[expect(
    clippy::too_many_lines,
    reason = "over the limit before the code quality decision: split the table by step"
)]
fn feature_table() {
    let rows: Vec<(&str, Files, StepName, WaitsOn)> = vec![
        ("no proposal", vec![], StepName::HumanGate, WaitsOn::Human),
        (
            "proposal only",
            vec![("proposal.md", proposal())],
            StepName::Discovery,
            WaitsOn::Agent,
        ),
        (
            "questions waiting",
            vec![
                ("proposal.md", proposal()),
                ("clarifications-01.md", waiting()),
            ],
            StepName::HumanGate,
            WaitsOn::Human,
        ),
        (
            "answered, no spec",
            vec![
                ("proposal.md", proposal()),
                ("clarifications-01.md", answered()),
            ],
            StepName::Spec,
            WaitsOn::Agent,
        ),
        (
            "a newer round answered",
            vec![
                ("proposal.md", proposal()),
                ("clarifications-01.md", answered()),
                ("clarifications-02.md", answered()),
                ("spec.md", spec("approved", 1, 1)),
            ],
            StepName::Spec,
            WaitsOn::Agent,
        ),
        (
            "spec waiting",
            vec![
                ("proposal.md", proposal()),
                ("clarifications-01.md", answered()),
                ("spec.md", spec("awaiting-human", 1, 1)),
            ],
            StepName::HumanGate,
            WaitsOn::Human,
        ),
        (
            "spec changes requested",
            vec![
                ("proposal.md", proposal()),
                ("clarifications-01.md", answered()),
                ("spec.md", spec("changes-requested", 1, 1)),
            ],
            StepName::SpecRevision,
            WaitsOn::Agent,
        ),
        (
            "spec approved, no plan",
            vec![
                ("proposal.md", proposal()),
                ("clarifications-01.md", answered()),
                ("spec.md", spec("approved", 1, 1)),
            ],
            StepName::Plan,
            WaitsOn::Agent,
        ),
        (
            "plan behind the spec",
            vec![
                ("proposal.md", proposal()),
                ("clarifications-01.md", answered()),
                ("spec.md", spec("approved", 2, 1)),
                ("plan.md", plan("approved", 1, &[("One", 0, 1)])),
            ],
            StepName::PlanRevision,
            WaitsOn::Agent,
        ),
        (
            "plan changes requested",
            vec![
                ("proposal.md", proposal()),
                ("clarifications-01.md", answered()),
                ("spec.md", spec("approved", 1, 1)),
                ("plan.md", plan("changes-requested", 1, &[("One", 0, 1)])),
            ],
            StepName::PlanRevision,
            WaitsOn::Agent,
        ),
        (
            "plan with unchecked steps",
            vec![
                ("proposal.md", proposal()),
                ("clarifications-01.md", answered()),
                ("spec.md", spec("approved", 1, 1)),
                (
                    "plan.md",
                    plan("auto-approved", 1, &[("One", 1, 1), ("Two", 0, 2)]),
                ),
            ],
            StepName::Implementation,
            WaitsOn::Agent,
        ),
    ];
    for (name, files, expected, waits_on) in rows {
        let feature = feature(Kind::Feature, &files);

        assert_eq!(feature.step.name, expected, "{name}");
        assert_eq!(feature.step.waits_on, waits_on, "{name}");
    }
}

fn finished() -> Files {
    vec![
        ("proposal.md", proposal()),
        ("clarifications-01.md", answered()),
        ("spec.md", spec("approved", 1, 1)),
        ("plan.md", plan("approved", 1, &[("One", 2, 2)])),
    ]
}

#[test]
fn pull_request_rows() {
    let rows = [
        (
            PullRequest::NoPullRequest,
            StepName::FinalReview,
            WaitsOn::Agent,
        ),
        (
            PullRequest::ChangesRequested,
            StepName::PullRequestChanges,
            WaitsOn::Agent,
        ),
        (PullRequest::Open, StepName::PullRequest, WaitsOn::Human),
        (PullRequest::Unknown, StepName::PullRequest, WaitsOn::Agent),
    ];
    for (pull_request, expected, waits_on) in rows {
        let mut feature = feature(Kind::Feature, &finished());

        feature.with_pull_request(pull_request);

        assert_eq!(feature.step.name, expected, "{pull_request:?}");
        assert_eq!(feature.step.waits_on, waits_on, "{pull_request:?}");
        assert_eq!(feature.step.pull_request, Some(pull_request));
    }
}

#[test]
fn approval_when_a_decision_is_pending() {
    let mut feature = feature(
        Kind::Feature,
        &[
            ("proposal.md", proposal()),
            ("clarifications-01.md", answered()),
            ("spec.md", spec("approved", 1, 1)),
        ],
    );
    feature.decisions_pending = true;

    feature.with_pull_request(PullRequest::Unknown);

    assert_eq!(feature.step.name, StepName::Approval);
    assert_eq!(
        feature.step.reference.as_deref(),
        Some("skills/uraeda/references/approval.md")
    );
}

#[test]
fn implementation_names_the_first_unchecked_task() {
    let feature = feature(
        Kind::Feature,
        &[
            ("proposal.md", proposal()),
            ("clarifications-01.md", answered()),
            ("spec.md", spec("approved", 1, 1)),
            (
                "plan.md",
                plan(
                    "auto-approved",
                    1,
                    &[("One", 1, 1), ("Repeat menu", 0, 2), ("Three", 0, 1)],
                ),
            ),
        ],
    );

    assert_eq!(feature.step.task.as_deref(), Some("Task 2: Repeat menu"));
}

fn assessment(status: &str, done: usize, total: usize) -> String {
    let mut text = format!("---\nstatus: {status}\n---\n\n# Assessment: Bug\n\n## Fix\n\n");
    for step in 0..total {
        let mark = if step < done { "x" } else { " " };
        text.push_str(&format!("- [{mark}] Step {}\n", step + 1));
    }
    text
}

#[test]
fn bug_table() {
    let report = || ("report.md", "# Report\n\nIt breaks.\n".to_string());
    let rows: Vec<(&str, Files, StepName)> = vec![
        ("no report", vec![], StepName::HumanGate),
        ("report only", vec![report()], StepName::Assess),
        (
            "assessment waiting",
            vec![
                report(),
                ("assessment.md", assessment("awaiting-human", 0, 1)),
            ],
            StepName::HumanGate,
        ),
        (
            "changes requested",
            vec![
                report(),
                ("assessment.md", assessment("changes-requested", 0, 1)),
            ],
            StepName::AssessRevision,
        ),
        (
            "approved, unchecked",
            vec![report(), ("assessment.md", assessment("approved", 0, 2))],
            StepName::Fix,
        ),
    ];
    for (name, files, expected) in rows {
        let feature = feature(Kind::Bug, &files);

        assert_eq!(feature.step.name, expected, "{name}");
    }
}

#[test]
fn invalid_files_have_no_step() {
    let feature = feature(
        Kind::Feature,
        &[
            ("proposal.md", proposal()),
            (
                "clarifications-01.md",
                "---\nstatus: done\n---\n".to_string(),
            ),
        ],
    );

    assert_eq!(feature.step.name, StepName::None);
    assert_eq!(feature.problems[0].rule, "frontmatter.status");
}

fn finished_record(kind: Kind) -> Feature {
    let text = match kind {
        Kind::Feature => record("feature", "X"),
        Kind::Bug => record("bug", "X"),
    };
    Feature::from_record(kind, "2026-10-10-x", text)
}

fn fixed() -> Files {
    vec![
        ("report.md", "# Report\n\nIt breaks.\n".to_string()),
        ("assessment.md", assessment("approved", 2, 2)),
    ]
}

/// US1.3 to US1.6, US4.1, US4.2, US6.1, review focus 5
#[test]
fn finishing_rows() {
    let rows = [
        (
            "record, no pull request",
            finished_record(Kind::Feature),
            PullRequest::NoPullRequest,
            StepName::Finish,
            WaitsOn::Agent,
        ),
        (
            "record, draft",
            finished_record(Kind::Feature),
            PullRequest::Draft,
            StepName::Finish,
            WaitsOn::Agent,
        ),
        (
            "record, changes requested",
            finished_record(Kind::Feature),
            PullRequest::ChangesRequested,
            StepName::PullRequestChanges,
            WaitsOn::Agent,
        ),
        (
            "record, ready",
            finished_record(Kind::Feature),
            PullRequest::Open,
            StepName::PullRequest,
            WaitsOn::Human,
        ),
        (
            "record, unknown",
            finished_record(Kind::Feature),
            PullRequest::Unknown,
            StepName::PullRequest,
            WaitsOn::Agent,
        ),
        (
            "checked, draft",
            feature(Kind::Feature, &finished()),
            PullRequest::Draft,
            StepName::Finish,
            WaitsOn::Agent,
        ),
        (
            "checked, no pull request",
            feature(Kind::Feature, &finished()),
            PullRequest::NoPullRequest,
            StepName::FinalReview,
            WaitsOn::Agent,
        ),
        (
            "bug record, draft",
            finished_record(Kind::Bug),
            PullRequest::Draft,
            StepName::Finish,
            WaitsOn::Agent,
        ),
        (
            "bug fixed, draft",
            feature(Kind::Bug, &fixed()),
            PullRequest::Draft,
            StepName::Finish,
            WaitsOn::Agent,
        ),
    ];
    for (name, mut feature, pull_request, expected, waits_on) in rows {
        feature.with_pull_request(pull_request);

        assert_eq!(feature.step.name, expected, "{name}");
        assert_eq!(feature.step.waits_on, waits_on, "{name}");
    }
}

/// US4.3
#[test]
fn a_new_round_after_a_revert_waits_on_the_human() {
    let mut files = finished();
    files.push((
        "clarifications-02.md",
        clarifications("awaiting-human", "1 question, about 3 minutes.", &[""]),
    ));
    let mut feature = feature(Kind::Feature, &files);

    feature.with_pull_request(PullRequest::Draft);

    assert_eq!(feature.step.name, StepName::HumanGate);
    assert_eq!(feature.step.file.as_deref(), Some("clarifications-02.md"));
}

#[test]
fn finish_follows_its_reference() {
    let mut feature = finished_record(Kind::Feature);

    feature.with_pull_request(PullRequest::Draft);

    assert_eq!(
        feature.step.reference.as_deref(),
        Some("skills/uraeda/references/finish.md")
    );
}

/// Pull request review: changes requested win over a draft.
#[test]
fn pull_request_states_from_gh() {
    let rows = [
        (r#"[]"#, PullRequest::NoPullRequest),
        (
            r#"[{"reviewDecision":"","isDraft":true}]"#,
            PullRequest::Draft,
        ),
        (
            r#"[{"reviewDecision":"CHANGES_REQUESTED","isDraft":true}]"#,
            PullRequest::ChangesRequested,
        ),
        (
            r#"[{"reviewDecision":"CHANGES_REQUESTED","isDraft":false}]"#,
            PullRequest::ChangesRequested,
        ),
        (
            r#"[{"reviewDecision":"","isDraft":false}]"#,
            PullRequest::Open,
        ),
        (r#"not json"#, PullRequest::Unknown),
    ];
    for (json, expected) in rows {
        assert_eq!(
            uraeda_core::steps::pull_request_state(json.as_bytes()),
            expected,
            "{json}"
        );
    }
}
