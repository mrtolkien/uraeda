mod common;

use std::collections::BTreeMap;

use common::repo::TestRepo;
use common::texts::*;
use uraeda_core::git::Git;
use uraeda_core::pulls::{PullRequestState, PullRequestView, PullRequests};
use uraeda_core::steps::{PullRequest, Step, StepName, TaskProgress, WaitsOn};
use uraeda_core::view::StepView;
use uraeda_core::workspace::{Feature, Kind, Workspace};

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

/// A snapshot of `gh` with one pull request on the test features' branch, or none.
fn snapshot(state: Option<PullRequestState>) -> PullRequests {
    snapshot_on("2026-10-10-x", state)
}

/// A snapshot of `gh` with pull request #31 on `branch`, or none.
fn snapshot_on(branch: &str, state: Option<PullRequestState>) -> PullRequests {
    let entry = state.map(|state| {
        let view = PullRequestView {
            number: 31,
            url: "https://github.com/o/r/pull/31".to_string(),
            state,
        };
        (branch.to_string(), view)
    });
    PullRequests::Known(entry.into_iter().collect())
}

/// US1.1 to US1.5
#[test]
fn pull_request_rows() {
    let rows = [
        (
            "no pull request",
            snapshot(None),
            StepName::FinalReview,
            WaitsOn::Agent,
        ),
        (
            "draft #31",
            snapshot(Some(PullRequestState::Draft)),
            StepName::Finish,
            WaitsOn::Agent,
        ),
        (
            "changes requested",
            snapshot(Some(PullRequestState::ChangesRequested)),
            StepName::PullRequestChanges,
            WaitsOn::Agent,
        ),
        (
            "open #31",
            snapshot(Some(PullRequestState::Open)),
            StepName::PullRequest,
            WaitsOn::Human,
        ),
        (
            "without gh",
            PullRequests::Unavailable,
            StepName::PullRequestUnknown,
            WaitsOn::Agent,
        ),
    ];
    for (name, pull_requests, expected, waits_on) in rows {
        let mut feature = feature(Kind::Feature, &finished());

        pull_requests.apply(&mut feature);

        assert_eq!(feature.step.name, expected, "{name}");
        assert_eq!(feature.step.waits_on, waits_on, "{name}");
        let known = match &pull_requests {
            PullRequests::Known(map) => map.get("2026-10-10-x").cloned(),
            PullRequests::Unavailable => None,
        };
        assert_eq!(feature.pull_request, known, "{name}");
    }
}

/// A step at a gate, or at an agent's step, for its order.
fn step_at(name: StepName, file: Option<&str>) -> Step {
    Step {
        name,
        waits_on: WaitsOn::Agent,
        reference: None,
        file: file.map(String::from),
        task: None,
        progress: None,
        implemented: false,
        pull_request: None,
        plan_review: None,
    }
}

/// Each step's position in the workflow, a gate placed by the file it waits on.
#[test]
fn order_follows_the_workflow() {
    let gate = |file| step_at(StepName::HumanGate, Some(file));
    let agent = |name| step_at(name, None);
    let rows = [
        (gate("proposal.md"), 0),
        (agent(StepName::Discovery), 1),
        (gate("clarifications-02.md"), 2),
        (agent(StepName::Spec), 3),
        (agent(StepName::SpecRevision), 3),
        (gate("spec.md"), 4),
        (agent(StepName::Approval), 5),
        (agent(StepName::Plan), 6),
        (agent(StepName::PlanRevision), 6),
        (gate("plan.md"), 7),
        (agent(StepName::Implementation), 8),
        (agent(StepName::Change), 8),
        (agent(StepName::FinalReview), 9),
        (agent(StepName::Finish), 10),
        (agent(StepName::PullRequestChanges), 11),
        (agent(StepName::PullRequest), 12),
        (agent(StepName::PullRequestUnknown), 12),
        (agent(StepName::Done), 13),
        (agent(StepName::None), 14),
    ];
    for (step, expected) in rows {
        let name = format!("{} {:?}", step.name.as_str(), step.file);

        assert_eq!(StepView::from(&step).order, expected, "{name}");
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

const LISTED: &str = "2026-10-10-listed";

/// A feature on its branch, its spec approved with `decisions` as its `## Decisions` section, and
/// a `proposed` decision at each path of `proposed`: its step once read from the repository.
fn approved_with(decisions: &str, proposed: &[&str]) -> StepName {
    let repo = TestRepo::new();
    repo.write("specs/README.md", "# Specs\n");
    repo.commit("chore: specs");
    repo.switch_new(LISTED);
    let approved = spec("approved", 1, 1).replace("Relied on:\n\n- None.\n", decisions);
    for (name, text) in [
        ("proposal.md", proposal()),
        ("clarifications-01.md", answered()),
        ("spec.md", approved),
    ] {
        repo.write(&format!("specs/{LISTED}/{name}"), &text);
    }
    for path in proposed {
        repo.write(path, &decision("proposed"));
    }
    repo.commit("spec(listed): approve");
    repo.switch("main");
    let workspace = Workspace::read(&Git::discover(repo.path()).unwrap()).unwrap();
    let mut feature = workspace.feature(LISTED).unwrap().clone();
    feature.with_pull_request(PullRequest::Unknown);
    feature.step.name
}

/// US6 2: a decision named by an item of `## Decisions`, still `proposed`, waits for the approval
/// step, even listed twice.
#[test]
fn approval_when_a_listed_decision_is_proposed() {
    let items = "- **New: [Due dates](../decisions/due-dates.md)**. Calendar days.\n\
        - **New: [Due dates](../decisions/due-dates.md#rules)**. Listed twice.\n";

    let step = approved_with(items, &["specs/decisions/due-dates.md"]);

    assert_eq!(step, StepName::Approval);
}

/// Review focus 4: the "Relied on" table's links never make the approval step pending.
#[test]
fn a_relied_on_link_to_a_proposed_decision_is_not_pending() {
    let table = "Relied on:\n\n| Decision | What it means |\n| --- | --- |\n\
        | [Due dates](../decisions/due-dates.md) | calendar days |\n";

    let step = approved_with(table, &["specs/decisions/due-dates.md"]);

    assert_eq!(step, StepName::Plan);
}

/// Review focus 3: an item linking outside the decisions folder is not a listed decision, even when
/// a proposed decision has its file's name.
#[test]
fn an_item_outside_the_decisions_folder_is_not_pending() {
    let item = "- **New: [Due dates](../notes/due-dates.md)**. Calendar days.\n";

    let step = approved_with(
        item,
        &["specs/notes/due-dates.md", "specs/decisions/due-dates.md"],
    );

    assert_eq!(step, StepName::Plan);
}

#[test]
fn the_steps_before_the_plan_carry_plan_review() {
    let with = |spec_text: String, plan_text: Option<String>| {
        let mut files = vec![
            ("proposal.md", proposal()),
            ("clarifications-01.md", answered()),
            ("spec.md", spec_text),
        ];
        files.extend(plan_text.map(|text| ("plan.md", text)));
        feature(Kind::Feature, &files).step
    };
    let reviewed = spec("approved", 1, 1).replace("risk-tier: low", "plan-review: true");

    assert_eq!(with(spec("approved", 1, 1), None).plan_review, Some(false));
    assert_eq!(with(reviewed.clone(), None).plan_review, Some(true));
    let revision = with(
        reviewed.clone(),
        Some(plan("changes-requested", 1, &[("One", 0, 1)])),
    );
    assert_eq!(revision.name, StepName::PlanRevision);
    assert_eq!(revision.plan_review, Some(true));
    let implementation = with(reviewed, Some(plan("approved", 1, &[("One", 0, 1)])));
    assert_eq!(implementation.name, StepName::Implementation);
    assert_eq!(implementation.plan_review, None);
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

/// A change table's row: its name, files, pull request, and expected step, waits on, and file.
type ChangeRow = (
    &'static str,
    Files,
    PullRequest,
    StepName,
    WaitsOn,
    Option<&'static str>,
);

/// SC-001: a change's only human gate without a round is its pull request.
#[test]
fn change_table() {
    let rows: Vec<ChangeRow> = vec![
        (
            "no proposal",
            vec![],
            PullRequest::NoPullRequest,
            StepName::HumanGate,
            WaitsOn::Human,
            Some("proposal.md"),
        ),
        (
            "proposal only, no pull request",
            vec![("proposal.md", proposal())],
            PullRequest::NoPullRequest,
            StepName::Change,
            WaitsOn::Agent,
            None,
        ),
        (
            "proposal only, pull request unknown",
            vec![("proposal.md", proposal())],
            PullRequest::Unknown,
            StepName::Change,
            WaitsOn::Agent,
            None,
        ),
        (
            "a round waiting",
            vec![
                ("proposal.md", proposal()),
                ("clarifications-01.md", waiting()),
            ],
            PullRequest::NoPullRequest,
            StepName::HumanGate,
            WaitsOn::Human,
            Some("clarifications-01.md"),
        ),
        (
            "the round answered",
            vec![
                ("proposal.md", proposal()),
                ("clarifications-01.md", answered()),
            ],
            PullRequest::NoPullRequest,
            StepName::Change,
            WaitsOn::Agent,
            None,
        ),
        (
            "a draft pull request",
            vec![("proposal.md", proposal())],
            PullRequest::Draft,
            StepName::Finish,
            WaitsOn::Agent,
            None,
        ),
        (
            "changes requested",
            vec![("proposal.md", proposal())],
            PullRequest::ChangesRequested,
            StepName::PullRequestChanges,
            WaitsOn::Agent,
            None,
        ),
        (
            "ready for review",
            vec![("proposal.md", proposal())],
            PullRequest::Open,
            StepName::PullRequest,
            WaitsOn::Human,
            None,
        ),
    ];
    for (name, files, pull_request, expected, waits_on, file) in rows {
        let mut feature = feature(Kind::Change, &files);

        feature.with_pull_request(pull_request);

        assert_eq!(feature.step.name, expected, "{name}");
        assert_eq!(feature.step.waits_on, waits_on, "{name}");
        assert_eq!(feature.step.file.as_deref(), file, "{name}");
        if matches!(expected, StepName::Change | StepName::PullRequestChanges) {
            assert_eq!(
                feature.step.reference.as_deref(),
                Some("skills/uraeda/references/change.md"),
                "{name}"
            );
        }
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
        Kind::Change => record("change", "X"),
    };
    Feature::from_record(kind, "2026-10-10-x", text)
}

/// A finished item's row: its name, the item, the snapshot, and the expected step and waits on.
type FinishingRow = (&'static str, Feature, PullRequests, StepName, WaitsOn);

/// US1.3 to US1.6, US4.1, US4.2, US6.1, review focus 5 of the finishing step; US1.5
#[test]
fn finishing_rows() {
    let record = finished_record;
    let rows: Vec<FinishingRow> = vec![
        (
            "record, no pull request",
            record(Kind::Feature),
            snapshot(None),
            StepName::Finish,
            WaitsOn::Agent,
        ),
        (
            "record, draft",
            record(Kind::Feature),
            snapshot(Some(PullRequestState::Draft)),
            StepName::Finish,
            WaitsOn::Agent,
        ),
        (
            "record, changes requested",
            record(Kind::Feature),
            snapshot(Some(PullRequestState::ChangesRequested)),
            StepName::PullRequestChanges,
            WaitsOn::Agent,
        ),
        (
            "record, ready",
            record(Kind::Feature),
            snapshot(Some(PullRequestState::Open)),
            StepName::PullRequest,
            WaitsOn::Human,
        ),
        (
            "record, without gh",
            record(Kind::Feature),
            PullRequests::Unavailable,
            StepName::PullRequestUnknown,
            WaitsOn::Agent,
        ),
        (
            "checked, draft",
            feature(Kind::Feature, &finished()),
            snapshot(Some(PullRequestState::Draft)),
            StepName::Finish,
            WaitsOn::Agent,
        ),
        (
            "checked, no pull request",
            feature(Kind::Feature, &finished()),
            snapshot(None),
            StepName::FinalReview,
            WaitsOn::Agent,
        ),
        (
            "change, without gh",
            feature(Kind::Change, &[("proposal.md", proposal())]),
            PullRequests::Unavailable,
            StepName::Change,
            WaitsOn::Agent,
        ),
        (
            "change record, draft",
            record(Kind::Change),
            snapshot_on("change/2026-10-10-x", Some(PullRequestState::Draft)),
            StepName::Finish,
            WaitsOn::Agent,
        ),
        (
            "change record, changes requested",
            record(Kind::Change),
            snapshot_on(
                "change/2026-10-10-x",
                Some(PullRequestState::ChangesRequested),
            ),
            StepName::PullRequestChanges,
            WaitsOn::Agent,
        ),
    ];
    for (name, mut feature, pull_requests, expected, waits_on) in rows {
        pull_requests.apply(&mut feature);

        assert_eq!(feature.step.name, expected, "{name}");
        assert_eq!(feature.step.waits_on, waits_on, "{name}");
        if expected == StepName::PullRequestChanges {
            let reference = match feature.kind {
                Kind::Feature => "skills/uraeda/references/implementation.md",
                Kind::Change => "skills/uraeda/references/change.md",
            };
            assert_eq!(feature.step.reference.as_deref(), Some(reference), "{name}");
        }
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

/// What a human gate asks, named from the step alone: the kind of the file it waits on, which the
/// web UI's "Answer questions", "Review the spec", and "Review the plan" are read from.
#[test]
fn a_gate_names_the_kind_of_its_file() {
    let questions = vec![
        ("proposal.md", proposal()),
        ("clarifications-01.md", waiting()),
    ];
    let spec_waits = vec![
        ("proposal.md", proposal()),
        ("clarifications-01.md", answered()),
        ("spec.md", spec("awaiting-human", 1, 1)),
    ];
    let plan_waits = vec![
        ("proposal.md", proposal()),
        ("clarifications-01.md", answered()),
        ("spec.md", spec("approved", 1, 1)),
        ("plan.md", plan("awaiting-human", 1, &[("One", 0, 1)])),
    ];
    let rows: Vec<(Files, Option<&str>)> = vec![
        (questions, Some("clarifications")),
        (spec_waits, Some("spec")),
        (plan_waits, Some("plan")),
        (vec![("proposal.md", proposal())], None),
    ];
    for (files, expected) in rows {
        let feature = feature(Kind::Feature, &files);

        let step = StepView::from(&feature.step);

        assert_eq!(step.file_kind.as_deref(), expected, "{:?}", step.file);
    }
}
