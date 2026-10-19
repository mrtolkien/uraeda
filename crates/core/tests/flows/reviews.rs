//! Reviewing a spec: comments pile up in a pending review file, and a verdict commits the file's
//! new status with the review on the feature's branch, only over the committed version.

use uraeda_core::actions::review::DecisionTarget;
use uraeda_core::api;

use crate::common::repo::TestRepo;
use crate::common::texts::{clarifications, proposal, spec};

const FOLDER: &str = "2026-10-11-web-ui";
const SPEC: &str = "specs/2026-10-11-web-ui/spec.md";
const REVIEW: &str = "specs/2026-10-11-web-ui/spec-review.md";
const DECISION: &str = "specs/decisions/task-storage.md";
const ON_MAIN: &str = "---\nstatus: active\n---\n\n# Task storage\n\nWhere tasks live.\n\n## Rules\n\n- Data MUST be stored in IndexedDB.\n\n## Why\n\nBecause.\n";
const ON_BRANCH: &str = "---\nstatus: proposed\n---\n\n# Task storage\n\nWhere tasks live.\n\n## Rules\n\n- Data MUST be stored in IndexedDB.\n- An upgrade that cannot read a saved value MUST clear it and log it.\n\n## Why\n\nBecause.\n";

/// A feature whose spec waits for a review, its branch changing a decision.
fn repo() -> TestRepo {
    let repo = TestRepo::new();
    repo.write("specs/README.md", "# Specs\n");
    repo.write(DECISION, ON_MAIN);
    repo.commit("chore: specs");
    repo.switch_new(FOLDER);
    repo.write("specs/2026-10-11-web-ui/proposal.md", &proposal());
    repo.write(
        "specs/2026-10-11-web-ui/clarifications-01.md",
        &clarifications("answered", "Answered.", &["A"]),
    );
    repo.write(SPEC, &spec("awaiting-human", 1, 1));
    repo.write(DECISION, ON_BRANCH);
    repo.commit("spec(web-ui): web UI");
    repo.switch("main");
    repo
}

fn on_branch(repo: &TestRepo, path: &str) -> String {
    repo.read(&format!(".worktrees/{FOLDER}/{path}"))
}

fn comment(repo: &TestRepo, text: &str) -> uraeda_core::view::FileView {
    api::add_comment(repo.path(), FOLDER, "spec.md", Some((8, 8)), text, None).unwrap()
}

fn status(repo: &TestRepo) -> String {
    api::read_file(repo.path(), FOLDER, "spec.md")
        .unwrap()
        .status
        .unwrap()
}

#[test]
fn comments_pile_up_uncommitted_and_changes_requested_commits_them_with_the_spec() {
    let repo = repo();
    let commits = repo.subjects(FOLDER).len();

    comment(&repo, "Say what the row shows");
    comment(&repo, "And the second thing");
    api::edit_comment(
        repo.path(),
        FOLDER,
        "spec.md",
        1,
        "Say what the row shows, and why",
    )
    .unwrap();
    api::remove_comment(repo.path(), FOLDER, "spec.md", 2).unwrap();

    let review = on_branch(&repo, REVIEW);
    assert!(review.contains("and why") && !review.contains("second thing"));
    assert_eq!(
        repo.subjects(FOLDER).len(),
        commits,
        "comments are not commits"
    );

    api::request_changes(repo.path(), FOLDER, "spec.md", Some("Not yet.")).unwrap();

    assert_eq!(repo.subjects(FOLDER).len(), commits + 1);
    let committed = repo.changed_in(FOLDER);
    assert!(
        committed.contains(&SPEC.to_string()) && committed.contains(&REVIEW.to_string()),
        "{committed:?}"
    );
    assert_eq!(status(&repo), "changes-requested");
    assert_eq!(
        api::read_feature(repo.path(), FOLDER)
            .unwrap()
            .step
            .waits_on,
        "agent"
    );
    assert_eq!(repo.current_branch(), "main");
}

#[test]
fn changes_cannot_be_requested_without_a_comment() {
    let repo = repo();
    let commits = repo.subjects(FOLDER).len();

    let result = api::request_changes(repo.path(), FOLDER, "spec.md", None);

    assert!(result.is_err());
    assert_eq!(repo.subjects(FOLDER).len(), commits);
    assert_eq!(status(&repo), "awaiting-human");
}

#[test]
fn approving_commits_the_new_status_and_leaves_no_pending_review() {
    let repo = repo();
    comment(&repo, "A note for the plan");

    api::approve(repo.path(), FOLDER, "spec.md", None, None, None).unwrap();

    assert_eq!(status(&repo), "approved");
    let approved = api::read_feature(repo.path(), FOLDER).unwrap();
    assert_eq!(approved.step.name, "plan");
    assert_eq!(approved.step.waits_on, "agent");
    assert_eq!(repo.porcelain(), "");
}

#[test]
fn a_verdict_is_refused_over_a_file_with_uncommitted_changes() {
    let repo = repo();
    comment(&repo, "A comment");
    let place = repo.path().join(".worktrees").join(FOLDER);
    let spec_file = place.join(SPEC);
    std::fs::write(
        &spec_file,
        format!(
            "{}\nAn edit not committed.\n",
            std::fs::read_to_string(&spec_file).unwrap()
        ),
    )
    .unwrap();
    let commits = repo.subjects(FOLDER).len();

    let approved = api::approve(repo.path(), FOLDER, "spec.md", None, None, None);
    let changes = api::request_changes(repo.path(), FOLDER, "spec.md", None);

    assert!(approved.is_err() && changes.is_err());
    assert_eq!(repo.subjects(FOLDER).len(), commits);
}

#[test]
fn a_review_of_an_older_version_is_replaced_by_the_next_comment() {
    let repo = repo();
    comment(&repo, "On the first version");
    api::request_changes(repo.path(), FOLDER, "spec.md", None).unwrap();
    let place = repo.path().join(".worktrees").join(FOLDER);
    std::fs::write(place.join(SPEC), spec("awaiting-human", 2, 1)).unwrap();
    uraeda_core::git::Git::open(&place)
        .unwrap()
        .commit(&[SPEC.to_string()], "spec(web-ui): revision 2", None)
        .unwrap();

    comment(&repo, "On the second version");

    let review = on_branch(&repo, REVIEW);
    assert!(review.contains("On the second version") && !review.contains("On the first version"));
}

#[test]
fn a_comment_on_a_decision_part_quotes_the_branchs_text_and_unknown_names_are_refused() {
    let repo = repo();
    let on = |name: &str, lines| {
        let target = Some(DecisionTarget {
            name: name.into(),
            removed: false,
        });
        api::add_comment(
            repo.path(),
            FOLDER,
            "spec.md",
            Some(lines),
            "Log it where I can see it",
            target,
        )
    };

    for name in ["git", "", "a/b", ".hidden", "../2026-10-11-web-ui/spec"] {
        assert!(on(name, (1, 1)).is_err(), "{name:?}");
    }
    assert!(
        on("task-storage", (12, 30)).is_err(),
        "lines past the decision's end"
    );
    on("task-storage", (12, 12)).unwrap();

    let review = on_branch(&repo, REVIEW);
    assert!(
        review.contains("task-storage") && review.contains("MUST clear it and log it"),
        "{review}"
    );
}
