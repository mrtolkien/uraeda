//! What a human types is kept as written: code in an answer or a note never breaks the round it
//! is written in, and saving what was read changes nothing.

use uraeda_core::api;
use uraeda_core::files::items::RoundItems;

use crate::common::repo::TestRepo;
use crate::rounds::{FOLDER, letters, read, repo, worktree_round};

fn round(repo: &TestRepo) -> RoundItems {
    read(repo).current.items.clarifications.expect("a round")
}

#[test]
fn code_in_an_answer_or_a_note_is_kept_as_written_and_never_breaks_the_round() {
    let comments = [
        "See:\n\n```sh\n# a shell comment\n**Answer:** quoted\n```\n\nThen.",
        "```\n## Not a heading\n```",
        "~~~\n- **A point**: not a comment\n~~~",
    ];
    for comment in comments {
        let repo = repo();
        api::save_answer(repo.path(), FOLDER, "Q2", &letters(&["B"]), "Kept.", "").unwrap();

        api::save_answer(repo.path(), FOLDER, "Q1", &[], comment, "").unwrap();

        let items = round(&repo);
        assert_eq!(items.questions.len(), 2, "{comment:?}");
        assert!(items.questions[0].answer.contains(comment), "{comment:?}");
        assert!(
            items.questions[1].answer.contains("Kept."),
            "the next answer is intact"
        );
        let written = worktree_round(&repo);
        let answer = items.questions[0].answer.clone();
        api::save_answer(repo.path(), FOLDER, "Q1", &[], &answer, &answer).unwrap();
        assert_eq!(
            worktree_round(&repo),
            written,
            "saving what was read changes nothing"
        );

        api::save_notes(repo.path(), FOLDER, comment, "").unwrap();
        let items = round(&repo);
        assert_eq!(
            items.questions.len(),
            2,
            "notes with code add and remove no question"
        );
        assert!(items.notes.is_some_and(|notes| notes.contains(comment)));
    }
}

#[test]
fn a_fence_left_open_is_closed_before_what_follows() {
    for open in ["```\ncode", "See:\n\n~~~sh\ncode"] {
        let repo = repo();
        api::save_answer(repo.path(), FOLDER, "Q2", &letters(&["B"]), "Kept.", "").unwrap();

        api::save_answer(repo.path(), FOLDER, "Q1", &[], open, "").unwrap();

        let items = round(&repo);
        assert_eq!(items.questions.len(), 2, "{open:?}");
        assert!(
            items.questions[1].answer.contains("Kept."),
            "{open:?}: the next answer is not swallowed"
        );
    }
}
