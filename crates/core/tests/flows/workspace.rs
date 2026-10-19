//! Reading the workflow's state from git: a feature's step, which commit it is read from, and when
//! it counts as done.

use std::collections::BTreeMap;

use uraeda_core::actions::place;
use uraeda_core::git::Git;
use uraeda_core::pulls::{PullRequestState, PullRequestView, PullRequests};
use uraeda_core::steps::{PullRequest, StepName, WaitsOn};
use uraeda_core::workspace::{Feature, Kind, Source, Workspace};

use crate::common::repo::TestRepo;
use crate::common::texts::{clarifications, decision, plan, proposal, record, spec};

const FOLDER: &str = "2026-10-11-web-ui";
const ROUND_1: &str = "specs/2026-10-11-web-ui/clarifications-01.md";

fn waiting() -> String {
    clarifications("awaiting-human", "1 question, about 3 minutes.", &[""])
}

fn answered() -> String {
    clarifications("answered", "Answered on 2026-10-08.", &["A"])
}

fn from_texts(files: &[(&str, String)]) -> Feature {
    let texts: BTreeMap<String, String> = files
        .iter()
        .map(|(name, text)| (name.to_string(), text.clone()))
        .collect();
    Feature::from_texts(Kind::Feature, "2026-10-10-x", texts)
}

/// The repository with a feature branch, `2026-10-11-web-ui`, waiting for answers, back on `main`.
fn repo_with_feature() -> TestRepo {
    let repo = TestRepo::new();
    repo.write("specs/README.md", "# Specs\n");
    repo.commit("chore: specs");
    repo.switch_new(FOLDER);
    repo.write("specs/2026-10-11-web-ui/proposal.md", &proposal());
    repo.write(ROUND_1, &waiting());
    repo.commit("discovery(web-ui): web UI");
    repo.switch("main");
    repo
}

fn workspace(repo: &TestRepo) -> Workspace {
    Workspace::read(&Git::discover(repo.path()).unwrap()).unwrap()
}

fn finish(repo: &TestRepo) {
    repo.switch(FOLDER);
    repo.git(&["rm", "-r", "--quiet", "specs/2026-10-11-web-ui"]);
    repo.write(
        &format!("specs/done/{FOLDER}.md"),
        &record("feature", "Web UI"),
    );
    repo.commit("finish: web ui");
    repo.switch("main");
}

#[test]
fn a_feature_moves_through_the_workflow_steps() {
    let proposal = || ("proposal.md", proposal());
    let round = |text: String| ("clarifications-01.md", text);
    let spec = |status: &str, revision: u32| ("spec.md", spec(status, revision, 1));
    let plan = |status: &str, spec_revision: u32, done: usize, total: usize| {
        let tasks = [("One", done, total)];
        ("plan.md", plan(status, spec_revision, &tasks))
    };
    type Row = (&'static str, Vec<(&'static str, String)>, StepName, WaitsOn);
    let rows: Vec<Row> = vec![
        ("nothing", vec![], StepName::HumanGate, WaitsOn::Human),
        (
            "a proposal",
            vec![proposal()],
            StepName::Discovery,
            WaitsOn::Agent,
        ),
        (
            "questions to answer",
            vec![proposal(), round(waiting())],
            StepName::HumanGate,
            WaitsOn::Human,
        ),
        (
            "answered questions",
            vec![proposal(), round(answered())],
            StepName::Spec,
            WaitsOn::Agent,
        ),
        (
            "a spec to review",
            vec![proposal(), round(answered()), spec("awaiting-human", 1)],
            StepName::HumanGate,
            WaitsOn::Human,
        ),
        (
            "a spec with changes requested",
            vec![proposal(), round(answered()), spec("changes-requested", 1)],
            StepName::SpecRevision,
            WaitsOn::Agent,
        ),
        (
            "an approved spec",
            vec![proposal(), round(answered()), spec("approved", 1)],
            StepName::Plan,
            WaitsOn::Agent,
        ),
        (
            "a plan older than its spec",
            vec![
                proposal(),
                round(answered()),
                spec("approved", 2),
                plan("approved", 1, 0, 1),
            ],
            StepName::PlanRevision,
            WaitsOn::Agent,
        ),
        (
            "a plan with steps left",
            vec![
                proposal(),
                round(answered()),
                spec("approved", 1),
                plan("auto-approved", 1, 0, 2),
            ],
            StepName::Implementation,
            WaitsOn::Agent,
        ),
    ];
    for (name, files, expected, waits_on) in rows {
        let feature = from_texts(&files);

        assert_eq!(feature.step.name, expected, "{name}");
        assert_eq!(feature.step.waits_on, waits_on, "{name}");
    }
}

#[test]
fn a_finished_feature_waits_on_its_pull_request() {
    let files = [
        ("proposal.md", proposal()),
        ("clarifications-01.md", answered()),
        ("spec.md", spec("approved", 1, 1)),
        ("plan.md", plan("approved", 1, &[("One", 2, 2)])),
    ];
    let pull_request = |state| {
        let view = PullRequestView {
            number: 31,
            url: "https://github.com/o/r/pull/31".to_string(),
            state,
        };
        PullRequests::Known([("2026-10-10-x".to_string(), view)].into())
    };
    let rows = [
        (
            PullRequests::Known(BTreeMap::new()),
            StepName::FinalReview,
            WaitsOn::Agent,
        ),
        (
            pull_request(PullRequestState::Draft),
            StepName::Finish,
            WaitsOn::Agent,
        ),
        (
            pull_request(PullRequestState::ChangesRequested),
            StepName::PullRequestChanges,
            WaitsOn::Agent,
        ),
        (
            pull_request(PullRequestState::Open),
            StepName::PullRequest,
            WaitsOn::Human,
        ),
        (
            PullRequests::Unavailable,
            StepName::PullRequestUnknown,
            WaitsOn::Agent,
        ),
    ];
    for (pull_requests, expected, waits_on) in rows {
        let mut feature = from_texts(&files);

        pull_requests.apply(&mut feature);

        assert_eq!(feature.step.name, expected);
        assert_eq!(feature.step.waits_on, waits_on);
    }
}

/// US1 3: a branch's step is read from its latest commit only: a gate saved in its worktree and not
/// committed leaves the step where the commit has it.
#[test]
fn a_branch_is_read_only_from_its_latest_commit() {
    let repo = repo_with_feature();
    let git = Git::discover(repo.path()).unwrap();
    let place = place::reach(&git, FOLDER).unwrap();
    let round_2 = place
        .root
        .join("specs/2026-10-11-web-ui/clarifications-02.md");
    let worktree = Git::open(&place.root).unwrap();
    std::fs::write(place.root.join(ROUND_1), answered()).unwrap();
    worktree
        .commit(
            &[ROUND_1.to_string()],
            "discovery(web-ui): answer round 01",
            None,
        )
        .unwrap();
    std::fs::write(&round_2, waiting()).unwrap();

    let saved = workspace(&repo);
    let saved = saved.feature(FOLDER).unwrap();

    assert_eq!(
        saved.step.waits_on,
        WaitsOn::Agent,
        "an unsaved gate is not a gate"
    );
    assert!(saved.uncommitted);
    assert!(
        saved.text("clarifications-02.md").is_some(),
        "the files shown are the disk's"
    );

    worktree
        .commit(
            &["specs/2026-10-11-web-ui/clarifications-02.md".to_string()],
            "discovery(web-ui): round 02",
            None,
        )
        .unwrap();

    let committed = workspace(&repo);
    let committed = committed.feature(FOLDER).unwrap();
    assert_eq!(committed.step.waits_on, WaitsOn::Human);
    assert_eq!(committed.step.file.as_deref(), Some("clarifications-02.md"));
}

#[test]
fn a_branch_counts_as_a_feature_only_with_its_folder_in_its_latest_commit() {
    let repo = repo_with_feature();
    let git = Git::discover(repo.path()).unwrap();
    let branch = "2026-10-16-not-a-flow";
    repo.branch(branch);
    let place = place::reach(&git, branch).unwrap();
    let folder = place.root.join("specs").join(branch);
    std::fs::create_dir_all(&folder).unwrap();
    std::fs::write(folder.join("proposal.md"), proposal()).unwrap();
    repo.write("specs/2026-10-20-orphan/proposal.md", &proposal());

    let workspace = workspace(&repo);

    assert!(workspace.feature(branch).is_none(), "an uncommitted folder");
    assert!(
        workspace.feature("2026-10-20-orphan").is_none(),
        "a folder without its branch"
    );
    assert!(workspace.feature(FOLDER).is_some());
}

#[test]
fn a_merged_feature_is_done_once_and_names_what_it_left() {
    let repo = repo_with_feature();
    repo.git(&["merge", "--quiet", "--no-edit", FOLDER]);

    let workspace = workspace(&repo);

    let matching: Vec<_> = workspace
        .features
        .iter()
        .filter(|feature| feature.folder == FOLDER)
        .collect();
    assert_eq!(matching.len(), 1);
    assert_eq!(matching[0].step.name, StepName::Done);
    assert_eq!(matching[0].source, Source::DefaultBranch);
    assert_eq!(matching[0].left_branch.as_deref(), Some(FOLDER));
}

#[test]
fn a_record_on_the_default_branch_is_a_done_feature_whatever_the_branch_says() {
    let repo = repo_with_feature();
    finish(&repo);
    repo.git(&["merge", "--quiet", "--no-ff", "--no-edit", FOLDER]);
    repo.switch(FOLDER);
    repo.write("specs/2026-10-11-web-ui/proposal.md", &proposal());
    repo.commit("late: a commit after the merge");
    repo.switch("main");

    let workspace = workspace(&repo);

    let feature = workspace.feature(FOLDER).unwrap();
    assert_eq!(feature.step.name, StepName::Done);
    assert_eq!(feature.step.waits_on, WaitsOn::Nobody);
}

#[test]
fn a_decision_the_spec_lists_as_proposed_holds_the_approval() {
    let repo = TestRepo::new();
    repo.write("specs/README.md", "# Specs\n");
    repo.commit("chore: specs");
    repo.switch_new("2026-10-10-listed");
    let listed = "- **New: [Due dates](../decisions/due-dates.md)**. Calendar days.\n";
    let approved = spec("approved", 1, 1).replace("Relied on:\n\n- None.\n", listed);
    for (name, text) in [
        ("proposal.md", proposal()),
        ("clarifications-01.md", answered()),
        ("spec.md", approved),
    ] {
        repo.write(&format!("specs/2026-10-10-listed/{name}"), &text);
    }
    repo.write("specs/decisions/due-dates.md", &decision("proposed"));
    repo.commit("spec(listed): approve");
    repo.switch("main");

    let step_of = |repo: &TestRepo| {
        let workspace = workspace(repo);
        let mut feature = workspace.feature("2026-10-10-listed").unwrap().clone();
        feature.with_pull_request(PullRequest::Unknown);
        feature.step.name
    };
    assert_eq!(step_of(&repo), StepName::Approval);

    repo.switch("2026-10-10-listed");
    repo.write("specs/decisions/due-dates.md", &decision("active"));
    repo.commit("decision: activate due dates");
    repo.switch("main");

    assert_eq!(step_of(&repo), StepName::Plan);
}
