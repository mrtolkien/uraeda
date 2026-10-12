mod common;

use common::repo::TestRepo;
use common::texts::{proposal, spec};
use uraeda_core::actions::place::{self, Place};
use uraeda_core::actions::review::{self, Tier};
use uraeda_core::actions::{ActionError, answer, text};
use uraeda_core::files::document::hash;
use uraeda_core::git::Git;
use uraeda_core::today::Date;
use uraeda_core::workspace::{Feature, Workspace};

const FOLDER: &str = "2026-10-11-web-ui";
const ROUND: &str = "specs/2026-10-11-web-ui/clarifications-01.md";

fn today() -> Date {
    Date::parse("2026-10-11").unwrap()
}

/// A round with Q1 (A, B, C), its follow-up Q1.B, and Q2 (A, B), with the given answers.
fn round(q1: &str, q1b: &str, q2: &str) -> String {
    let answer = |a: &str| {
        if a.is_empty() {
            "**Answer:**".to_string()
        } else {
            format!("**Answer:** {a}")
        }
    };
    format!(
        "---\nstatus: awaiting-human\n---\n\n# Clarifications, round 01: Web UI\n\n> [!IMPORTANT]\n>\n> 3 questions, about 9 minutes.\n>\n> - A point.\n\n## Context\n\nContext.\n\n## Q1: Which one?\n\nWhy.\n\n- **A (recommended). One.**\n  - [pro] p\n- **B. Two.**\n- **C. Three.**\n\n{}\n\n### Q1.B: Then what?\n\n- **A. Yes.**\n- **B. No.**\n\n{}\n\n## Q2: And this?\n\n- **A. One.**\n- **B. Two.**\n\n{}\n\n## Settled without the human\n\n- **A point** settled.\n\n**Notes:**\n",
        answer(q1),
        answer(q1b),
        answer(q2)
    )
}

/// A repository on `main` whose feature branch holds a round, checked out nowhere.
fn repo_with(round_text: &str) -> TestRepo {
    let repo = TestRepo::new();
    repo.write("specs/README.md", "# Specs\n");
    repo.write(
        "specs/PRIORITIES.md",
        "# Priorities\n\n## Now\n\n- [Web UI](/specs/2026-10-11-web-ui/proposal.md)\n\n## Next\n\n- Git listener process\n\n## Later\n\n## Blocked\n",
    );
    repo.commit("chore: specs");
    repo.switch_new(FOLDER);
    repo.write("specs/2026-10-11-web-ui/proposal.md", &proposal());
    repo.write(ROUND, round_text);
    repo.commit("discovery(web-ui): web UI");
    repo.switch("main");
    repo
}

/// The feature, and the place its branch is reached at.
fn reach(repo: &TestRepo) -> (Feature, Place) {
    let git = Git::discover(repo.path()).unwrap();
    let workspace = Workspace::read(&git).unwrap();
    let feature = workspace.feature(FOLDER).unwrap().clone();
    let place = place::reach(&git, FOLDER).unwrap();
    (feature, place)
}

fn read(place: &Place, path: &str) -> String {
    std::fs::read_to_string(place.root.join(path)).unwrap()
}

fn letters(items: &[&str]) -> Vec<String> {
    items.iter().map(|s| s.to_string()).collect()
}

/// The `**Answer:**` lines of the round, in order.
fn answers(place: &Place) -> Vec<String> {
    read(place, ROUND)
        .lines()
        .filter(|line| line.starts_with("**Answer:**"))
        .map(String::from)
        .collect()
}

#[test]
fn saves_answers_as_the_ui_composes_them() {
    let repo = repo_with(&round("", "", ""));
    let (feature, place) = reach(&repo);

    // US2.1
    answer::save(&place, &feature, "Q2", &letters(&["A"]), "", "").unwrap();
    assert_eq!(answers(&place)[2], "**Answer:** A");
    // US2.2
    answer::save(&place, &feature, "Q1", &letters(&["B", "C"]), "", "").unwrap();
    assert_eq!(answers(&place)[0], "**Answer:** B and C");
    answer::save(
        &place,
        &feature,
        "Q1",
        &letters(&["A", "B", "C"]),
        "",
        "B and C",
    )
    .unwrap();
    assert_eq!(answers(&place)[0], "**Answer:** A, B and C");
    // US2.3
    answer::save(
        &place,
        &feature,
        "Q2",
        &letters(&["A"]),
        "but only for the dev server",
        "A",
    )
    .unwrap();
    assert_eq!(
        answers(&place)[2],
        "**Answer:** A: but only for the dev server"
    );
    // US2.4
    answer::save(
        &place,
        &feature,
        "Q1",
        &[],
        "Neither, keep it simple",
        "A, B and C",
    )
    .unwrap();
    assert_eq!(answers(&place)[0], "**Answer:** Neither, keep it simple");
    // US2.7
    answer::save(&place, &feature, "Q1.B", &[], "-", "").unwrap();
    assert_eq!(answers(&place)[1], "**Answer:** -");
    // US2.10
    answer::save_notes(&place, &feature, "LGTM", "").unwrap();
    assert!(read(&place, ROUND).ends_with("**Notes:** LGTM\n"));
    // SC-002
    assert_eq!(repo.current_branch(), "main");
    assert_eq!(repo.subjects(FOLDER).len(), 3);
}

#[test]
fn refuses_an_answer_changed_elsewhere() {
    let repo = repo_with(&round("A", "", ""));
    let (feature, place) = reach(&repo);

    let error = answer::save(&place, &feature, "Q1", &letters(&["B"]), "", "").unwrap_err();

    assert_eq!(
        error.to_string(),
        "clarifications-01.md changed on disk since you opened it. Your text was not saved."
    );
    assert!(matches!(error, ActionError::Changed { .. }));
    assert_eq!(answers(&place)[0], "**Answer:** A");
}

#[test]
fn refuses_a_heading_in_an_answer() {
    let repo = repo_with(&round("", "", ""));
    let (feature, place) = reach(&repo);
    let before = read(&place, ROUND);

    let error = answer::save(&place, &feature, "Q1", &[], "# heading", "").unwrap_err();

    assert!(matches!(error, ActionError::Answer(_)), "{error}");
    assert_eq!(read(&place, ROUND), before);
}

/// US2.9 and SC-003
#[test]
fn submits_and_commits_on_the_features_branch() {
    let repo = repo_with(&round("B", "A", "A"));
    let (feature, place) = reach(&repo);

    let committed = answer::submit_and_commit(&place, &feature, today()).unwrap();

    assert_eq!(
        committed.change.subject,
        "discovery(web-ui): answer round 01"
    );
    assert_eq!(
        repo.subjects(FOLDER)[0],
        "discovery(web-ui): answer round 01"
    );
    assert_eq!(committed.commit.len(), 7);
    let text = read(&place, ROUND);
    assert!(text.starts_with("---\nstatus: answered\n---\n"));
    assert!(text.contains("> Answered on 2026-10-11.\n"));
    assert_eq!(repo.hook_runs(), 1);
    assert_eq!(repo.current_branch(), "main");
}

#[test]
fn a_refused_commit_keeps_the_answers_and_can_be_tried_again() {
    let repo = repo_with(&round("B", "A", "A"));
    repo.set_hook("echo 'VITE+ - pre-commit script failed (code 1)'\nexit 1");
    let (feature, place) = reach(&repo);

    let error = answer::submit_and_commit(&place, &feature, today()).unwrap_err();

    let ActionError::Hook { output, .. } = &error else {
        panic!("{error}");
    };
    assert_eq!(output, "VITE+ - pre-commit script failed (code 1)");
    assert!(read(&place, ROUND).contains("status: answered"));
    assert_eq!(repo.subjects(FOLDER).len(), 3);

    repo.set_hook("exit 0");
    let change = uraeda_core::actions::Change {
        paths: vec![ROUND.to_string()],
        subject: "discovery(web-ui): answer round 01".to_string(),
        body: None,
    };
    uraeda_core::actions::commit::commit(&place, &change).unwrap();
    assert_eq!(
        repo.subjects(FOLDER)[0],
        "discovery(web-ui): answer round 01"
    );
}

const SPEC: &str = "specs/2026-10-11-web-ui/spec.md";
const REVIEW: &str = "specs/2026-10-11-web-ui/spec-review.md";

/// A feature whose spec waits for a review, with risk tier `medium`.
fn spec_repo() -> TestRepo {
    let repo = TestRepo::new();
    repo.write("specs/README.md", "# Specs\n");
    repo.write("specs/PRIORITIES.md", "# Priorities\n\n## Now\n");
    repo.commit("chore: specs");
    repo.switch_new(FOLDER);
    repo.write("specs/2026-10-11-web-ui/proposal.md", &proposal());
    repo.write(
        SPEC,
        &spec("awaiting-human", 1, 1).replace("risk-tier: low", "risk-tier: medium"),
    );
    repo.commit("spec(web-ui): web UI");
    repo.switch("main");
    repo
}

/// US3.3
#[test]
fn pending_comments_are_edited_and_removed() {
    let repo = spec_repo();
    let git = Git::discover(repo.path()).unwrap();
    let (feature, place) = reach(&repo);
    review::comment(
        &git,
        &place,
        &feature,
        "spec.md",
        Some((9, 9)),
        "Say what the row shows",
    )
    .unwrap();

    review::edit(
        &place,
        &feature,
        "spec.md",
        1,
        "Say what the row shows, and for how long",
    )
    .unwrap();
    assert!(read(&place, REVIEW).contains("\nSay what the row shows, and for how long\n"));

    review::remove(&place, &feature, "spec.md", 1).unwrap();
    assert!(!place.root.join(REVIEW).exists());
}

/// US3.4
#[test]
fn approving_with_a_higher_tier_turns_the_plan_review_on() {
    let repo = spec_repo();
    let (feature, place) = reach(&repo);
    let tier = Tier {
        risk_tier: Some("high".to_string()),
        plan_review: None,
    };

    review::approve_and_commit(&place, &feature, "spec.md", None, &tier, today()).unwrap();

    let text = read(&place, SPEC);
    assert!(text.contains("status: approved\n"));
    assert!(text.contains("risk-tier: high\n"));
    assert!(text.contains("plan-review: true\n"));
    assert_eq!(repo.subjects(FOLDER)[0], "spec(web-ui): approve");
    assert_eq!(repo.current_branch(), "main");
}

/// US4.2, and a save over a change made elsewhere.
#[test]
fn text_is_saved_over_the_version_it_was_read_at() {
    let repo = repo_with(&round("", "", ""));
    let (_, place) = reach(&repo);
    let path = "specs/2026-10-11-web-ui/proposal.md";
    let read_at = hash(&read(&place, path));

    let typed = "# Web UI\n\nWith  two spaces, and a tab\t.\n";
    let new_hash = text::save(&place, path, typed, &read_at).unwrap();

    assert_eq!(read(&place, path), typed);
    assert_eq!(new_hash, hash(typed));
    let error = text::save(&place, path, "# Other\n", &read_at).unwrap_err();
    assert_eq!(
        error.to_string(),
        "proposal.md changed on disk since you opened it. Your text was not saved."
    );
    assert_eq!(read(&place, path), typed);
}

/// US4.3 and US4.5
#[test]
fn drafts_and_proposals_are_committed_with_the_skills_messages() {
    let repo = repo_with(&round("", "", ""));
    let git = Git::discover(repo.path()).unwrap();
    let main = place::reach(&git, "main").unwrap();
    let draft = "specs/drafts/git-listener-process.md";
    text::save(
        &main,
        draft,
        "# Git listener process\n\n## What\n\nRun.\n",
        &hash(""),
    )
    .unwrap();
    let priorities = read(&main, "specs/PRIORITIES.md").replace(
        "- Git listener process",
        "- [Git listener process](drafts/git-listener-process.md)",
    );
    std::fs::write(main.root.join("specs/PRIORITIES.md"), priorities).unwrap();

    let committed = text::commit(&main, draft).unwrap();

    assert_eq!(
        committed.change.subject,
        "chore: draft Git listener process"
    );
    assert_eq!(
        repo.changed_in("main"),
        [
            "specs/PRIORITIES.md",
            "specs/drafts/git-listener-process.md"
        ]
    );

    text::save(
        &main,
        draft,
        "# Git listener process\n\n## What\n\nRun it.\n",
        &hash(&read(&main, draft)),
    )
    .unwrap();
    let committed = text::commit(&main, draft).unwrap();
    assert_eq!(
        committed.change.subject,
        "chore: edit the draft Git listener process"
    );
    let backlog = "specs/backlog/benchmarks.md";
    text::save(&main, backlog, "# Benchmarks\n", &hash("")).unwrap();
    let committed = text::commit(&main, backlog).unwrap();
    assert_eq!(
        committed.change.subject,
        "chore: add Benchmarks to the backlog"
    );
    text::save(
        &main,
        backlog,
        "# Benchmarks\n\nLater.\n",
        &hash("# Benchmarks\n"),
    )
    .unwrap();
    let committed = text::commit(&main, backlog).unwrap();
    assert_eq!(
        committed.change.subject,
        "chore: edit Benchmarks in the backlog"
    );

    let (_, place) = reach(&repo);
    let proposal_path = "specs/2026-10-11-web-ui/proposal.md";
    let read_at = hash(&read(&place, proposal_path));
    text::save(&place, proposal_path, "# Web UI\n\nMore.\n", &read_at).unwrap();
    let committed = text::commit(&place, proposal_path).unwrap();
    assert_eq!(committed.change.subject, "chore(web-ui): edit the proposal");
    assert_eq!(repo.current_branch(), "main");
}
