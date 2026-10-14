mod common;

use std::collections::BTreeMap;

use common::texts::*;
use uraeda_core::steps::{PullRequest, StepName, TaskProgress, WaitsOn};
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

/// A plan's text with tasks numbered as given, each with its steps done out of total.
fn numbered_plan(tasks: &[(u32, &str, usize, usize)], after: &str) -> String {
    let mut text =
        "---\nstatus: auto-approved\nspec-revision: 1\n---\n\n# Plan: Feature\n".to_string();
    for (number, title, done, total) in tasks {
        text.push_str(&format!("\n## Task {number}: {title}\n\n"));
        for step in 0..*total {
            let mark = if step < *done { "x" } else { " " };
            text.push_str(&format!("- [{mark}] **Step {}: Do**\n", step + 1));
        }
    }
    text + after
}

/// The step of a feature with an approved spec at revision 1 and this plan.
fn at_plan(plan_text: String) -> Feature {
    feature(
        Kind::Feature,
        &[
            ("proposal.md", proposal()),
            ("clarifications-01.md", answered()),
            ("spec.md", spec("approved", 1, 1)),
            ("plan.md", plan_text),
        ],
    )
}

fn progress(position: u32, total: u32, title: &str) -> Option<TaskProgress> {
    Some(TaskProgress {
        position,
        total,
        title: title.to_string(),
    })
}

#[test]
fn implementation_progress() {
    let mut eleven: Vec<(String, usize, usize)> = (1..=11)
        .map(|n| (format!("Task title {n}"), usize::from(n <= 6) * 2, 2))
        .collect();
    eleven[6].0 = "Session column".to_string();
    eleven[6].1 = 1;
    let eleven: Vec<(&str, usize, usize)> = eleven
        .iter()
        .map(|(title, done, total)| (title.as_str(), *done, *total))
        .collect();
    let title = "The `ura status` command, **bold**, and [a link](x.md)";
    let rows: Vec<(&str, String, String, Option<TaskProgress>)> = vec![
        (
            "11 tasks, the first 6 done",
            plan("auto-approved", 1, &eleven),
            "Task 7: Session column".to_string(),
            progress(7, 11, "Session column"),
        ),
        (
            "tasks numbered 1, 3, 3",
            numbered_plan(
                &[(1, "One", 1, 1), (3, "Second", 0, 1), (3, "Third", 0, 1)],
                "",
            ),
            "Task 3: Second".to_string(),
            progress(2, 3, "Second"),
        ),
        (
            "tasks finished out of order",
            plan("auto-approved", 1, &[("One", 0, 1), ("Two", 1, 1)]),
            "Task 1: One".to_string(),
            progress(1, 2, "One"),
        ),
        (
            "a task without steps before the current one",
            plan(
                "auto-approved",
                1,
                &[("One", 1, 1), ("Empty", 0, 0), ("Three", 0, 1)],
            ),
            "Task 3: Three".to_string(),
            progress(3, 3, "Three"),
        ),
        (
            "a title with markup",
            plan("auto-approved", 1, &[(title, 0, 1)]),
            format!("Task 1: {title}"),
            progress(1, 1, title),
        ),
    ];
    for (name, plan_text, task, progress) in rows {
        let feature = at_plan(plan_text);

        assert_eq!(feature.step.task.as_deref(), Some(task.as_str()), "{name}");
        assert_eq!(feature.step.progress, progress, "{name}");
    }
}

#[test]
fn no_progress_outside_the_implementation() {
    let rows: Vec<(&str, String)> = vec![
        (
            "every box checked",
            plan("auto-approved", 1, &[("One", 2, 2), ("Two", 1, 1)]),
        ),
        ("no task heading", plan("auto-approved", 1, &[])),
        (
            "plan waiting for the human",
            plan("awaiting-human", 1, &[("One", 0, 1)]),
        ),
        (
            "plan behind the spec's revision",
            plan("auto-approved", 0, &[("One", 0, 1)]),
        ),
        (
            "unchecked boxes after the last task's section",
            numbered_plan(
                &[(1, "One", 1, 1), (2, "Two", 1, 1)],
                "\n## Notes\n\n- [ ] Not a step\n- [ ] Nor this\n",
            ),
        ),
    ];
    for (name, plan_text) in rows {
        let feature = at_plan(plan_text);

        assert_eq!(feature.step.task, None, "{name}");
        assert_eq!(feature.step.progress, None, "{name}");
    }
}

#[test]
fn implemented_once_past_the_implementation() {
    let all = [("One", 2, 2), ("Two", 1, 1)];
    let rows: Vec<(&str, String, bool)> = vec![
        ("every box checked", plan("auto-approved", 1, &all), true),
        (
            "an unchecked box",
            plan("auto-approved", 1, &[("One", 2, 2), ("Two", 0, 1)]),
            false,
        ),
        (
            "every box checked, plan waiting for the human",
            plan("awaiting-human", 1, &all),
            false,
        ),
        (
            "every box checked, plan with changes requested",
            plan("changes-requested", 1, &all),
            false,
        ),
        (
            "every box checked, plan behind the spec's revision",
            plan("auto-approved", 0, &all),
            false,
        ),
    ];
    for (name, plan_text, implemented) in rows {
        let feature = at_plan(plan_text);

        assert_eq!(feature.step.implemented, implemented, "{name}");
    }
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
