//! A spec's revision keeps the comments of the review it answers, whatever its review file holds
//! now.

mod common;

use common::repo::TestRepo;
use common::texts::spec;
use uraeda_core::api;

const FOLDER: &str = "2026-10-10-feature";
const SPEC: &str = "specs/2026-10-10-feature/spec.md";
const REVIEW: &str = "specs/2026-10-10-feature/spec-review.md";

fn review(verdict: &str, comment: &str) -> String {
    format!(
        "---\nverdict: {verdict}\ncommit: a1b2c3d\n---\n\n# Review: Spec, Feature\n\n## C1: Line 13, under \"Spec: Feature\"\n\n> A feature.\n\n{comment}\n"
    )
}

/// A feature's branch at revision 2, after a review that requested changes, with `main` checked
/// out.
fn revised() -> TestRepo {
    let repo = TestRepo::new();
    repo.write("specs/README.md", "# Specs\n");
    repo.commit("chore: specs");
    repo.switch_new(FOLDER);
    repo.write(SPEC, &spec("awaiting-human", 1, 0));
    repo.commit("docs(feature): spec");
    repo.write(REVIEW, &review("changes-requested", "Too vague."));
    repo.commit("docs(feature): request changes");
    repo.write(SPEC, &spec("awaiting-human", 2, 0));
    repo.commit("docs(feature): revise the spec");
    repo
}

/// The text of the answered review's comments, as the file view gives them.
fn answered(repo: &TestRepo) -> Option<Vec<String>> {
    repo.switch("main");
    let file = api::read_file(repo.path(), FOLDER, "spec.md").unwrap();
    file.answered
        .map(|review| review.comments.into_iter().map(|c| c.text).collect())
}

#[test]
fn a_revision_keeps_the_review_it_answers_once_a_new_review_starts() {
    let repo = revised();
    repo.write(REVIEW, &review("pending", "On the revision."));
    repo.commit("docs(feature): review the revision");
    assert_eq!(answered(&repo), Some(vec!["Too vague.".to_string()]));
}

#[test]
fn an_approved_revision_keeps_the_review_it_answers() {
    let repo = revised();
    repo.write(SPEC, &spec("approved", 2, 0));
    repo.write(REVIEW, &review("approved", "The approval's own comment."));
    repo.commit("docs(feature): approve the spec");
    assert_eq!(answered(&repo), Some(vec!["Too vague.".to_string()]));
}

/// A feature's branch whose spec and review file read as given, committed together.
fn feature(spec_text: &str, review_text: &str) -> TestRepo {
    let repo = TestRepo::new();
    repo.write("specs/README.md", "# Specs\n");
    repo.commit("chore: specs");
    repo.switch_new(FOLDER);
    repo.write(SPEC, spec_text);
    repo.write(REVIEW, review_text);
    repo.commit("docs(feature): the spec and its review");
    repo
}

#[test]
fn a_revision_1_answers_no_review() {
    let repo = feature(
        &spec("awaiting-human", 1, 0),
        &review("changes-requested", "Too vague."),
    );
    assert_eq!(answered(&repo), None);
}

#[test]
fn a_revision_whose_review_did_not_request_changes_answers_none() {
    let repo = feature(
        &spec("awaiting-human", 2, 0),
        &review("approved", "Approved."),
    );
    assert_eq!(answered(&repo), None);
}

/// The review's comments as the file view gives them with the repository as it stands.
fn answered_here(repo: &TestRepo) -> Option<Vec<String>> {
    let file = api::read_file(repo.path(), FOLDER, "spec.md").unwrap();
    file.answered
        .map(|review| review.comments.into_iter().map(|c| c.text).collect())
}

/// The revised branch, approved, with its review file now holding the approval.
fn approved() -> TestRepo {
    let repo = revised();
    repo.write(SPEC, &spec("approved", 2, 0));
    repo.write(REVIEW, &review("approved", "The approval's own comment."));
    repo.commit("docs(feature): approve the spec");
    repo
}

/// Once the branch is merged with a merge commit, the default branch's first-parent history holds
/// the merge alone, whose review file says approved: the review the revision answers is read on the
/// merged branch's own history.
#[test]
fn a_merged_revision_keeps_the_review_it_answers() {
    let repo = approved();
    repo.switch("main");
    repo.git(&["merge", "--no-ff", "-m", "Merge the feature", FOLDER]);
    repo.delete_branch(FOLDER);

    assert_eq!(answered_here(&repo), Some(vec!["Too vague.".to_string()]));
}

/// A squash merge keeps none of the branch's commits: the review that requested the changes is in
/// no commit of the default branch, so there is nothing to quote.
#[test]
fn a_squash_merged_revision_has_no_review_to_quote() {
    let repo = approved();
    repo.switch("main");
    repo.git(&["merge", "--squash", FOLDER]);
    repo.commit("feat(feature): the feature");
    repo.delete_branch(FOLDER);

    assert_eq!(answered_here(&repo), None);
}

/// A revision edited and not committed yet answers the review the branch's tip holds: the quotes
/// show as the agent writes it.
#[test]
fn an_uncommitted_revision_shows_the_review_it_answers() {
    let repo = feature(
        &spec("awaiting-human", 1, 0),
        &review("changes-requested", "Too vague."),
    );
    repo.write(SPEC, &spec("awaiting-human", 2, 0));

    assert_eq!(answered_here(&repo), Some(vec!["Too vague.".to_string()]));
}
