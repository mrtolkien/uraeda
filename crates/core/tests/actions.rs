mod common;

use common::repo::TestRepo;
use common::texts::{proposal, spec};
use uraeda_core::actions::place::{self, Place};
use uraeda_core::actions::review::{self, Tier};
use uraeda_core::actions::{ActionError, answer, draft, start, text};
use uraeda_core::embedded;
use uraeda_core::files::clarifications::AnswerError;
use uraeda_core::files::document::hash;
use uraeda_core::git::Git;
use uraeda_core::today::Date;
use uraeda_core::workspace::{Feature, Kind, Workspace};

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

/// A round whose settled points are "Undoing a completion" and "Deleting a repeating task", with
/// `notes` after its `**Notes:**` marker.
fn settled_round(notes: &str) -> String {
    round("", "", "")
        .replace(
            "- **A point** settled.",
            "- **Undoing a completion** puts back what completing changed.\n- **Deleting a repeating task** ends the repetition.",
        )
        .replace("**Notes:**\n", &format!("**Notes:** {notes}\n"))
}

/// The round's text after its `**Notes:**` marker.
fn notes_text(place: &Place) -> String {
    let text = read(place, ROUND);
    text.split_once("**Notes:**").unwrap().1.to_string()
}

const UNDO: &str = "Undoing a completion";
const DELETE: &str = "Deleting a repeating task";

/// US4.1
#[test]
fn a_settled_comment_is_added_after_the_free_notes() {
    let repo = repo_with(&settled_round("Overall fine."));
    let (feature, place) = reach(&repo);

    answer::add_settled_comment(&place, &feature, UNDO, "Keep the undo.").unwrap();

    assert_eq!(
        notes_text(&place),
        " Overall fine.\n\n- **Undoing a completion**: Keep the undo.\n"
    );
}

/// US4.8
#[test]
fn a_settled_comment_of_two_lines_is_indented() {
    let repo = repo_with(&settled_round("Overall fine."));
    let (feature, place) = reach(&repo);

    answer::add_settled_comment(&place, &feature, UNDO, "Keep the undo.\nAlso for deletes.")
        .unwrap();

    assert!(
        notes_text(&place)
            .ends_with("\n\n- **Undoing a completion**: Keep the undo.\n  Also for deletes.\n"),
        "{}",
        notes_text(&place)
    );
}

/// US4.4
#[test]
fn a_settled_comment_is_edited_over_its_text_last_read() {
    let notes = "Overall fine.\n\n- **Undoing a completion**: Keep the undo.\n- **Deleting a repeating task**: Ask first.";
    let repo = repo_with(&settled_round(notes));
    let (feature, place) = reach(&repo);

    let error =
        answer::edit_settled_comment(&place, &feature, 1, UNDO, "Drop it.", "Other").unwrap_err();
    assert!(matches!(error, ActionError::Changed { .. }), "{error}");
    assert_eq!(notes_text(&place), format!(" {notes}\n"));

    answer::edit_settled_comment(
        &place,
        &feature,
        1,
        UNDO,
        "Keep it, say so.",
        "Keep the undo.",
    )
    .unwrap();
    assert_eq!(
        notes_text(&place),
        " Overall fine.\n\n- **Undoing a completion**: Keep it, say so.\n- **Deleting a repeating task**: Ask first.\n"
    );
}

/// US4.5
#[test]
fn a_settled_comment_is_removed_and_the_rest_kept() {
    let notes = "Overall fine.\n\n- **Undoing a completion**: Keep the undo.\n- **Deleting a repeating task**: Ask first.";
    let repo = repo_with(&settled_round(notes));
    let (feature, place) = reach(&repo);

    answer::remove_settled_comment(&place, &feature, 1, UNDO, "Keep the undo.").unwrap();

    assert_eq!(
        notes_text(&place),
        " Overall fine.\n\n- **Deleting a repeating task**: Ask first.\n"
    );
}

#[test]
fn a_settled_comment_on_an_unknown_point_is_refused() {
    let repo = repo_with(&settled_round("Overall fine."));
    let (feature, place) = reach(&repo);
    let before = read(&place, ROUND);

    let error = answer::add_settled_comment(&place, &feature, "Gone", "Text.").unwrap_err();

    assert_eq!(error.to_string(), "That point is no longer in the round.");
    assert_eq!(read(&place, ROUND), before);
}

#[test]
fn a_settled_comment_with_a_heading_is_refused() {
    let repo = repo_with(&settled_round("Overall fine."));
    let (feature, place) = reach(&repo);
    let before = read(&place, ROUND);

    let error =
        answer::add_settled_comment(&place, &feature, UNDO, "Fine.\n# Heading").unwrap_err();

    assert!(
        matches!(error, ActionError::Answer(AnswerError::Structure)),
        "{error}"
    );
    assert_eq!(read(&place, ROUND), before);
}

/// US4.3: the notes saved over the free notes last read keep the settled comments.
#[test]
fn settled_comments_stay_when_the_free_notes_are_saved() {
    let repo = repo_with(&settled_round(
        "Overall fine.\n\n- **Undoing a completion**: Keep the undo.",
    ));
    let (feature, place) = reach(&repo);

    answer::save_notes(
        &place,
        &feature,
        "Overall fine, icon bigger.",
        "Overall fine.",
    )
    .unwrap();

    assert_eq!(
        notes_text(&place),
        " Overall fine, icon bigger.\n\n- **Undoing a completion**: Keep the undo.\n"
    );
}

/// A comment removed elsewhere renumbers the ones after it: an edit or a removal of comment 1 on
/// one subject is refused when comment 1 is now on another, even with the same text.
#[test]
fn a_settled_comment_now_on_another_point_is_neither_edited_nor_removed() {
    let notes = "- **Undoing a completion**: Agreed.\n- **Deleting a repeating task**: Agreed.";
    let repo = repo_with(&settled_round(notes));
    let (feature, place) = reach(&repo);
    let before = read(&place, ROUND);

    let refusals = [
        answer::edit_settled_comment(&place, &feature, 1, DELETE, "Mine.", "Agreed."),
        answer::remove_settled_comment(&place, &feature, 1, DELETE, "Agreed."),
    ];

    for refusal in refusals {
        let error = refusal.unwrap_err();
        assert!(matches!(error, ActionError::Changed { .. }), "{error}");
    }
    assert_eq!(read(&place, ROUND), before);
}

/// The free notes saved over notes changed since they were read are refused, the file kept.
#[test]
fn free_notes_saved_over_notes_changed_elsewhere_are_refused() {
    let repo = repo_with(&settled_round(
        "Theirs.\n\n- **Undoing a completion**: Keep the undo.",
    ));
    let (feature, place) = reach(&repo);
    let before = read(&place, ROUND);

    let error = answer::save_notes(&place, &feature, "Mine.", "Overall fine.").unwrap_err();

    assert!(matches!(error, ActionError::Changed { .. }), "{error}");
    assert_eq!(read(&place, ROUND), before);
}

/// A comment removed over a text changed since it was read is refused, the file kept.
#[test]
fn a_settled_comment_changed_elsewhere_is_not_removed() {
    let notes = "- **Undoing a completion**: Theirs.\n- **Deleting a repeating task**: Ask first.";
    let repo = repo_with(&settled_round(notes));
    let (feature, place) = reach(&repo);
    let before = read(&place, ROUND);

    let error =
        answer::remove_settled_comment(&place, &feature, 1, UNDO, "Keep the undo.").unwrap_err();

    assert!(matches!(error, ActionError::Changed { .. }), "{error}");
    assert_eq!(read(&place, ROUND), before);
}

/// A submitted round is a record: its notes and settled comments are written no more, as its
/// answers are not.
#[test]
fn a_submitted_rounds_notes_and_settled_comments_are_refused() {
    let notes = "Overall fine.\n\n- **Undoing a completion**: Keep the undo.";
    let repo =
        repo_with(&settled_round(notes).replace("status: awaiting-human", "status: answered"));
    let (feature, place) = reach(&repo);
    let before = read(&place, ROUND);

    let refusals = [
        answer::save_notes(&place, &feature, "Mine.", "Overall fine."),
        answer::add_settled_comment(&place, &feature, UNDO, "Text."),
        answer::edit_settled_comment(&place, &feature, 1, UNDO, "Drop it.", "Keep the undo."),
        answer::remove_settled_comment(&place, &feature, 1, UNDO, "Keep the undo."),
    ];

    for refusal in refusals {
        assert_eq!(
            refusal.unwrap_err().to_string(),
            "clarifications-01.md is not waiting for answers"
        );
    }
    assert_eq!(read(&place, ROUND), before);
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

/// US6.1
#[test]
fn approving_with_a_higher_tier_leaves_the_plan_review_off() {
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
    assert!(text.contains("plan-review: false\n"));
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

/// A repository on `main` with the priorities of the shared fixture.
fn fixture_repo() -> TestRepo {
    let repo = TestRepo::new();
    repo.write("specs/README.md", "# Specs\n");
    repo.write(
        "specs/PRIORITIES.md",
        &std::fs::read_to_string(common::fixture("repo/main/specs/PRIORITIES.md")).unwrap(),
    );
    repo.commit("chore: specs");
    repo
}

/// US5.1: the line as the title and under What, the template's headings, and no placeholder.
#[test]
fn a_draft_holds_the_line_as_title_and_what_without_placeholders() {
    let repo = fixture_repo();
    let git = Git::discover(repo.path()).unwrap();
    let main = place::reach(&git, "main").unwrap();

    let drafted = draft::create(&main, "next-1").unwrap();

    let text = read(&main, &drafted.path);
    assert!(text.starts_with("---\ndiscovery: high"), "{text}");
    assert!(
        text.contains(
            "# Claude Code runner (triggered manually)\n\n## What\n\nClaude Code runner (triggered manually)\n\n## Why\n\n## Notes\n"
        ),
        "{text}"
    );
    assert!(!text.contains('['), "{text}");
}

/// US5.3: the guidance the editor shows in each empty section.
#[test]
fn the_proposal_hints_are_the_templates_placeholders() {
    let hints = embedded::proposal_hints();

    assert_eq!(
        hints,
        [
            (
                "What".to_string(),
                "What the feature does, from the user's point of view.".to_string()
            ),
            (
                "Why".to_string(),
                "The problem it solves, and for whom.".to_string()
            ),
            (
                "Notes".to_string(),
                "Optional: constraints, ideas, examples, links to similar products, things you already decided or want to avoid.".to_string()
            ),
        ]
    );
}

/// Review C2: the proposal is freeform, so any draft starts.
#[test]
fn start_accepts_a_draft_with_placeholders_or_empty_sections() {
    // The template as is, placeholders and all, then a draft with an empty Why.
    let template = embedded::template(embedded::PROPOSAL).unwrap().to_string();
    for text in [template, "# X\n\n## What\n\nX\n\n## Why\n\n".to_string()] {
        let repo = TestRepo::new();
        repo.write("specs/README.md", "# Specs\n");
        repo.write(
            "specs/PRIORITIES.md",
            "# Priorities\n\n## Now\n\n## Next\n\n- [X](drafts/x.md)\n\n## Later\n\n## Blocked\n",
        );
        repo.write("specs/drafts/x.md", &text);
        repo.commit("chore: draft X");
        let git = Git::discover(repo.path()).unwrap();
        let workspace = Workspace::read(&git).unwrap();

        let started = start::run(
            &git,
            &workspace,
            "specs/drafts/x.md",
            Some("x"),
            Kind::Feature,
            today(),
            false,
        );

        assert!(started.is_ok(), "{}", started.err().unwrap());
    }
}

const PROPOSAL: &str = "specs/2026-10-11-web-ui/proposal.md";
const IMAGES: &str = "specs/2026-10-11-web-ui/images";

/// A small still GIF, re-encoded by `attach`.
/// A still GIF, encoded as `attach` takes it.
fn image() -> uraeda_core::images::Encoded {
    let bytes = std::fs::read(common::fixture("images/still.gif")).unwrap();
    uraeda_core::images::encode(&bytes, "still.gif").unwrap()
}

fn stamp() -> String {
    "20261014-103512".to_string()
}

/// Writes a file in a working tree, its folders created.
fn put(place: &Place, path: &str, bytes: &[u8]) {
    let file = place.root.join(path);
    std::fs::create_dir_all(file.parent().unwrap()).unwrap();
    std::fs::write(file, bytes).unwrap();
}

/// Appends a line to a file of a working tree.
fn append(place: &Place, path: &str, line: &str) {
    let text = read(place, path);
    std::fs::write(place.root.join(path), format!("{text}\n{line}\n")).unwrap();
}

/// The files a branch's tip tracks under a folder.
fn tracked(repo: &TestRepo, branch: &str, folder: &str) -> Vec<String> {
    repo.git(&["ls-tree", "-r", "--name-only", branch, "--", folder])
        .lines()
        .map(String::from)
        .collect()
}

/// US1.5, and Review focus 1: a never-committed, unlinked image is deleted, never staged.
#[test]
fn us1_5_a_proposal_commits_its_images_and_drops_the_unlinked() {
    let repo = repo_with(&round("", "", ""));
    let (_, place) = reach(&repo);
    let attached =
        uraeda_core::actions::attach::attach(&place, PROPOSAL, &image(), Some("login.png"), stamp)
            .unwrap();
    append(&place, PROPOSAL, &attached.link);
    put(&place, &format!("{IMAGES}/old.webp"), b"old");

    let committed = text::commit(&place, PROPOSAL).unwrap();

    assert_eq!(committed.change.subject, "chore(web-ui): edit the proposal");
    assert_eq!(
        repo.changed_in(FOLDER),
        [format!("{IMAGES}/login.webp"), PROPOSAL.to_string()]
    );
    assert!(!place.root.join(IMAGES).join("old.webp").exists());
    assert!(place.root.join(IMAGES).join("login.webp").exists());
}

/// Review focus 1: the folder's only image, unlinked and never committed, leaves no pathspec.
#[test]
fn an_unlinked_image_never_committed_is_deleted_without_a_trace() {
    let repo = repo_with(&round("", "", ""));
    let (_, place) = reach(&repo);
    append(&place, PROPOSAL, "More.");
    put(&place, &format!("{IMAGES}/old.webp"), b"old");

    text::commit(&place, PROPOSAL).unwrap();

    assert_eq!(repo.changed_in(FOLDER), [PROPOSAL]);
    assert!(!place.root.join(IMAGES).exists());
}

#[test]
fn an_image_unlinked_after_its_commit_is_deleted_by_the_next() {
    let repo = repo_with(&round("", "", ""));
    let (_, place) = reach(&repo);
    let before = read(&place, PROPOSAL);
    append(&place, PROPOSAL, "![login](images/login.webp)");
    put(&place, &format!("{IMAGES}/login.webp"), b"login");
    text::commit(&place, PROPOSAL).unwrap();
    assert_eq!(
        tracked(&repo, FOLDER, IMAGES),
        [format!("{IMAGES}/login.webp")]
    );

    std::fs::write(place.root.join(PROPOSAL), format!("{before}Without it.\n")).unwrap();
    text::commit(&place, PROPOSAL).unwrap();

    assert_eq!(
        repo.changed_in(FOLDER),
        [format!("{IMAGES}/login.webp"), PROPOSAL.to_string()]
    );
    assert!(tracked(&repo, FOLDER, IMAGES).is_empty());
    assert!(!place.root.join(IMAGES).exists());
}

#[test]
fn images_alone_are_a_change_to_commit() {
    let repo = repo_with(&round("", "", ""));
    let (_, place) = reach(&repo);
    append(&place, PROPOSAL, "![login](images/login.webp)");
    common::repo::run_git(
        &place.root,
        &["commit", "--quiet", "--no-verify", "-am", "link"],
    );
    put(&place, &format!("{IMAGES}/login.webp"), b"login");

    let committed = text::commit(&place, PROPOSAL).unwrap();

    assert_eq!(committed.change.subject, "chore(web-ui): edit the proposal");
    assert_eq!(repo.changed_in(FOLDER), [format!("{IMAGES}/login.webp")]);
    let error = text::commit(&place, PROPOSAL).unwrap_err();
    assert_eq!(
        error.to_string(),
        format!("{PROPOSAL} has no change to commit")
    );
}

const DRAFT: &str = "specs/drafts/login-banner.md";
const DRAFT_FOLDER: &str = "specs/drafts/login-banner";

/// `main` with the committed single-file draft "Login banner", linked from the priorities.
fn draft_repo() -> TestRepo {
    let repo = TestRepo::new();
    repo.write("specs/README.md", "# Specs\n");
    repo.write(
        "specs/PRIORITIES.md",
        "# Priorities\n\n## Now\n\n## Next\n\n- [Login banner](drafts/login-banner.md)\n\n## Later\n\n## Blocked\n",
    );
    repo.write(DRAFT, "# Login banner\n\n## What\n\nA banner.\n");
    repo.commit("chore: draft Login banner");
    repo
}

/// The draft given an image, as `attach` makes it a folder, its link written in it.
fn draft_with_image(repo: &TestRepo) -> (Place, String) {
    let git = Git::discover(repo.path()).unwrap();
    let main = place::reach(&git, "main").unwrap();
    let attached =
        uraeda_core::actions::attach::attach(&main, DRAFT, &image(), Some("login.png"), stamp)
            .unwrap();
    let moved = attached.moved.unwrap();
    append(&main, &moved, &attached.link);
    (main, moved)
}

/// Review focus 2
#[test]
fn a_committed_draft_moved_into_a_folder_commits_the_move() {
    let repo = draft_repo();
    let (main, moved) = draft_with_image(&repo);

    let committed = text::commit(&main, &moved).unwrap();

    assert_eq!(
        committed.change.subject,
        "chore: edit the draft Login banner"
    );
    assert_eq!(
        repo.changed_in("main"),
        [
            "specs/PRIORITIES.md".to_string(),
            DRAFT.to_string(),
            format!("{DRAFT_FOLDER}/images/login.webp"),
            format!("{DRAFT_FOLDER}/proposal.md"),
        ]
    );
    assert_eq!(repo.porcelain(), "");
}

#[test]
fn us1_7_a_draft_folder_starts_with_its_images() {
    let repo = draft_repo();
    let (main, moved) = draft_with_image(&repo);
    text::commit(&main, &moved).unwrap();
    let git = Git::discover(repo.path()).unwrap();
    let workspace = Workspace::read(&git).unwrap();

    let started = start::run(
        &git,
        &workspace,
        DRAFT_FOLDER,
        None,
        Kind::Feature,
        today(),
        false,
    )
    .unwrap();

    let folder = format!("specs/{}", started.branch);
    let worktree = repo.path().join(".worktrees").join(&started.branch);
    let proposal = std::fs::read_to_string(worktree.join(&folder).join("proposal.md")).unwrap();
    assert!(
        proposal.contains("![login](images/login.webp)"),
        "{proposal}"
    );
    assert!(worktree.join(&folder).join("images/login.webp").exists());
    assert_eq!(
        tracked(&repo, &started.branch, &folder),
        [
            format!("{folder}/images/login.webp"),
            format!("{folder}/proposal.md")
        ]
    );
}

/// US3.3
#[test]
fn us3_3_a_verdict_commits_the_review_images() {
    let repo = spec_repo();
    let git = Git::discover(repo.path()).unwrap();
    let (feature, place) = reach(&repo);
    review::comment(
        &git,
        &place,
        &feature,
        "spec.md",
        None,
        "As here: ![shot](images/shot.webp)",
    )
    .unwrap();
    put(&place, &format!("{IMAGES}/shot.webp"), b"shot");

    review::approve_and_commit(&place, &feature, "spec.md", None, &Tier::default(), today())
        .unwrap();

    assert_eq!(
        repo.changed_in(FOLDER),
        [
            format!("{IMAGES}/shot.webp"),
            REVIEW.to_string(),
            SPEC.to_string()
        ]
    );
}

#[test]
fn a_replaced_review_keeps_images_another_file_links() {
    let repo = spec_repo();
    repo.switch(FOLDER);
    repo.write(
        PROPOSAL,
        &format!("{}\n![shot](images/shot.webp)\n", proposal()),
    );
    repo.write(&format!("{IMAGES}/shot.webp"), "shot");
    repo.commit("chore(web-ui): edit the proposal");
    repo.switch("main");
    let git = Git::discover(repo.path()).unwrap();
    let (feature, place) = reach(&repo);
    review::comment(
        &git,
        &place,
        &feature,
        "spec.md",
        None,
        "![shot](images/shot.webp)",
    )
    .unwrap();
    append(&place, SPEC, "A new version.");
    common::repo::run_git(
        &place.root,
        &["commit", "--quiet", "--no-verify", "-am", "spec"],
    );
    let git = Git::discover(repo.path()).unwrap();
    let replaced = review::comment(&git, &place, &feature, "spec.md", None, "Fine.").unwrap();
    assert!(replaced.replaced);

    review::approve_and_commit(&place, &feature, "spec.md", None, &Tier::default(), today())
        .unwrap();

    assert_eq!(repo.changed_in(FOLDER), [REVIEW, SPEC]);
    assert!(place.root.join(IMAGES).join("shot.webp").exists());
}

/// US4.3
#[test]
fn us4_3_submitted_answers_commit_their_images() {
    let repo = repo_with(&round(
        "B",
        "A",
        "A, as ![one](images/one.webp) and ![two](images/two.webp) show",
    ));
    let (feature, place) = reach(&repo);
    put(&place, &format!("{IMAGES}/one.webp"), b"one");
    put(&place, &format!("{IMAGES}/two.webp"), b"two");

    answer::submit_and_commit(&place, &feature, today()).unwrap();

    assert_eq!(
        repo.changed_in(FOLDER),
        [
            ROUND.to_string(),
            format!("{IMAGES}/one.webp"),
            format!("{IMAGES}/two.webp")
        ]
    );
}

/// A commit refused by a hook leaves its new image staged; once its link is removed, the next
/// commit deletes the file and unstages it, instead of refusing it as another staged file.
#[test]
fn an_image_staged_by_a_refused_commit_then_unlinked_is_dropped() {
    let repo = repo_with(&round("", "", ""));
    let (_, place) = reach(&repo);
    let before = read(&place, PROPOSAL);
    append(&place, PROPOSAL, "![login](images/login.webp)");
    put(&place, &format!("{IMAGES}/login.webp"), b"login");
    repo.set_hook("exit 1");
    let error = text::commit(&place, PROPOSAL).unwrap_err();
    assert!(matches!(error, ActionError::Hook { .. }), "{error}");
    repo.set_hook("exit 0");

    std::fs::write(place.root.join(PROPOSAL), format!("{before}Without it.\n")).unwrap();
    text::commit(&place, PROPOSAL).unwrap();

    assert_eq!(repo.changed_in(FOLDER), [PROPOSAL]);
    assert!(!place.root.join(IMAGES).exists());
    assert_eq!(
        common::repo::run_git(&place.root, &["status", "--porcelain"]),
        ""
    );
}

/// Review focus 2: `<slug>/` was taken, so the draft moved to `<slug>-2/proposal.md`.
#[test]
fn a_committed_draft_moved_into_a_numbered_folder_commits_the_move() {
    let repo = draft_repo();
    std::fs::create_dir_all(repo.path().join(DRAFT_FOLDER)).unwrap();
    let (main, moved) = draft_with_image(&repo);
    assert_eq!(moved, "specs/drafts/login-banner-2/proposal.md");

    let committed = text::commit(&main, &moved).unwrap();

    assert_eq!(
        committed.change.subject,
        "chore: edit the draft Login banner"
    );
    assert_eq!(
        repo.changed_in("main"),
        [
            "specs/PRIORITIES.md".to_string(),
            "specs/drafts/login-banner-2/images/login.webp".to_string(),
            moved.clone(),
            DRAFT.to_string(),
        ]
    );
    assert_eq!(repo.porcelain(), "");
}

/// A single-file draft deleted on purpose, next to a new, unrelated folder draft of the same name,
/// is not a move: the new draft's commit leaves the deletion out.
#[test]
fn an_unrelated_folder_draft_does_not_take_a_deleted_draft() {
    let repo = draft_repo();
    repo.remove(DRAFT);
    let other = format!("{DRAFT_FOLDER}/proposal.md");
    repo.write(&other, "# Other idea\n\n## What\n\nSomething else.\n");
    let git = Git::discover(repo.path()).unwrap();
    let main = place::reach(&git, "main").unwrap();

    let committed = text::commit(&main, &other).unwrap();

    assert_eq!(committed.change.subject, "chore: draft Other idea");
    assert_eq!(repo.changed_in("main"), [other]);
    assert_eq!(repo.porcelain(), format!(" D {DRAFT}\n"));
}

/// Links a markdown link alone misses: wikilinks and Obsidian embeds, by path or by file name, a
/// target with a query, and markdown files in subfolders. HTML is not read.
#[test]
fn every_kind_of_link_keeps_its_image() {
    let repo = repo_with(&round("", "", ""));
    repo.add_on_branch(
        FOLDER,
        "specs/2026-10-11-web-ui/contracts/api.md",
        "# API\n\n![c](../images/c.webp)\n",
    );
    let (_, place) = reach(&repo);
    append(
        &place,
        PROPOSAL,
        "![[images/x.webp]] ![[y.webp|300]] [[images/z.webp]] ![q](images/q.webp?v=2)",
    );
    put(
        &place,
        "specs/2026-10-11-web-ui/mockups/page.html",
        b"<img src=\"../images/h.webp\">",
    );
    for name in ["x", "y", "z", "q", "c", "h"] {
        put(&place, &format!("{IMAGES}/{name}.webp"), name.as_bytes());
    }

    text::commit(&place, PROPOSAL).unwrap();

    let kept: Vec<String> = ["c", "q", "x", "y", "z"]
        .iter()
        .map(|name| format!("{IMAGES}/{name}.webp"))
        .collect();
    assert_eq!(tracked(&repo, FOLDER, IMAGES), kept);
    assert!(!place.root.join(IMAGES).join("h.webp").exists());
}

/// Files in folders under `images/` follow the same rule: kept while linked, deleted otherwise,
/// and a change to commit on their own.
#[test]
fn nested_images_are_kept_while_linked() {
    let repo = repo_with(&round("", "", ""));
    let (_, place) = reach(&repo);
    append(&place, PROPOSAL, "![kept](images/sub/kept.webp)");
    common::repo::run_git(
        &place.root,
        &["commit", "--quiet", "--no-verify", "-am", "link"],
    );
    put(&place, &format!("{IMAGES}/sub/kept.webp"), b"kept");
    put(&place, &format!("{IMAGES}/old/gone.webp"), b"gone");

    let committed = text::commit(&place, PROPOSAL).unwrap();

    assert_eq!(committed.change.subject, "chore(web-ui): edit the proposal");
    assert_eq!(repo.changed_in(FOLDER), [format!("{IMAGES}/sub/kept.webp")]);
    assert!(!place.root.join(IMAGES).join("old").exists());
}

/// A linked file git does not add, ignored or a symbolic link already committed, is no change.
#[test]
#[cfg(unix)]
fn files_git_would_not_add_are_no_change() {
    let repo = repo_with(&round("", "", ""));
    let (_, place) = reach(&repo);
    put(&place, ".gitignore", b"*.png\n");
    put(&place, "elsewhere.webp", b"x");
    append(
        &place,
        PROPOSAL,
        "![a](images/link.webp) ![b](images/ignored.png)",
    );
    std::fs::create_dir_all(place.root.join(IMAGES)).unwrap();
    std::os::unix::fs::symlink(
        "../../../elsewhere.webp",
        place.root.join(IMAGES).join("link.webp"),
    )
    .unwrap();
    common::repo::run_git(&place.root, &["add", "--all"]);
    common::repo::run_git(
        &place.root,
        &["commit", "--quiet", "--no-verify", "-m", "link"],
    );
    put(&place, &format!("{IMAGES}/ignored.png"), b"ignored");

    let error = text::commit(&place, PROPOSAL).unwrap_err();

    assert_eq!(
        error.to_string(),
        format!("{PROPOSAL} has no change to commit")
    );
}

/// A refusal over other staged files comes before any image is deleted.
#[test]
fn a_refusal_over_staged_files_keeps_the_images() {
    let repo = repo_with(&round("", "", ""));
    let (feature, place) = reach(&repo);
    append(&place, PROPOSAL, "More.");
    put(&place, &format!("{IMAGES}/old.webp"), b"old");
    put(&place, "specs/README.md", b"# Changed\n");
    common::repo::run_git(&place.root, &["add", "specs/README.md"]);

    let error = text::commit(&place, PROPOSAL).unwrap_err();
    assert!(
        error.to_string().contains("other files are staged"),
        "{error}"
    );
    let error = answer::submit_and_commit(&place, &feature, today()).unwrap_err();
    assert!(
        error.to_string().contains("other files are staged"),
        "{error}"
    );

    assert!(place.root.join(IMAGES).join("old.webp").exists());
}

/// A replaced review's image that no other file links goes with the verdict.
#[test]
fn a_replaced_review_drops_the_images_only_it_linked() {
    let repo = spec_repo();
    let git = Git::discover(repo.path()).unwrap();
    let (feature, place) = reach(&repo);
    review::comment(
        &git,
        &place,
        &feature,
        "spec.md",
        None,
        "![shot](images/shot.webp)",
    )
    .unwrap();
    put(&place, &format!("{IMAGES}/shot.webp"), b"shot");
    append(&place, SPEC, "A new version.");
    common::repo::run_git(
        &place.root,
        &["commit", "--quiet", "--no-verify", "-am", "spec"],
    );
    let git = Git::discover(repo.path()).unwrap();
    let replaced = review::comment(&git, &place, &feature, "spec.md", None, "Fine.").unwrap();
    assert!(replaced.replaced);

    review::approve_and_commit(&place, &feature, "spec.md", None, &Tier::default(), today())
        .unwrap();

    assert_eq!(repo.changed_in(FOLDER), [REVIEW, SPEC]);
    assert!(!place.root.join(IMAGES).exists());
}

#[test]
fn a_request_for_changes_commits_the_review_images() {
    let repo = spec_repo();
    let git = Git::discover(repo.path()).unwrap();
    let (feature, place) = reach(&repo);
    review::comment(
        &git,
        &place,
        &feature,
        "spec.md",
        Some((1, 1)),
        "Like this: ![shot](images/shot.webp)",
    )
    .unwrap();
    put(&place, &format!("{IMAGES}/shot.webp"), b"shot");
    put(&place, &format!("{IMAGES}/old.webp"), b"old");

    review::request_changes_and_commit(&place, &feature, "spec.md", None, today()).unwrap();

    assert_eq!(
        repo.changed_in(FOLDER),
        [
            format!("{IMAGES}/shot.webp"),
            REVIEW.to_string(),
            SPEC.to_string()
        ]
    );
    assert!(!place.root.join(IMAGES).join("old.webp").exists());
}

const CHANGE_FOLDER: &str = "2026-10-16-centred-x";
const TYPED: &str = "Centre the x in failure circles\n\nIn failures the x sits low in its circle.";

fn change_day() -> Date {
    Date::parse("2026-10-16").unwrap()
}

/// The repository's git and workspace, read now.
fn opened(repo: &TestRepo) -> (Git, Workspace) {
    let git = Git::discover(repo.path()).unwrap();
    let workspace = Workspace::read(&git).unwrap();
    (git, workspace)
}

/// A file of a change's worktree.
fn in_change(repo: &TestRepo, path: &str) -> String {
    std::fs::read_to_string(
        repo.path()
            .join(".worktrees")
            .join(CHANGE_FOLDER)
            .join(path),
    )
    .unwrap()
}

/// Starts a typed text as a change, on the change's day.
fn start_text(
    repo: &TestRepo,
    text: &str,
    images: &[uraeda_core::images::Encoded],
    slug: Option<&str>,
) -> Result<start::Started, start::StartError> {
    let (git, workspace) = opened(repo);
    start::run_text(&git, &workspace, text, images, slug, change_day(), false)
}

/// US1.3: a draft started as a change.
#[test]
fn a_draft_starts_as_a_change() {
    let repo = draft_repo();
    let (git, workspace) = opened(&repo);

    let started = start::run(
        &git,
        &workspace,
        DRAFT,
        Some("centred-x"),
        Kind::Change,
        change_day(),
        false,
    )
    .unwrap();

    let branch = format!("change/{CHANGE_FOLDER}");
    assert_eq!(started.branch, branch);
    assert_eq!(started.folder, CHANGE_FOLDER);
    assert_eq!(
        started.worktree.as_deref(),
        Some(".worktrees/2026-10-16-centred-x")
    );
    let proposal = format!("specs/changes/{CHANGE_FOLDER}/proposal.md");
    assert_eq!(
        in_change(&repo, &proposal),
        "# Login banner\n\n## What\n\nA banner.\n"
    );
    assert_eq!(repo.changed_in(&branch), [proposal, DRAFT.to_string()]);
    assert_eq!(repo.subjects(&branch)[0], "chore(centred-x): proposal");
    let priorities = repo.git(&["show", "main:specs/PRIORITIES.md"]);
    assert!(
        priorities.contains(
            "## Now\n\n- [Login banner](/specs/changes/2026-10-16-centred-x/proposal.md)\n"
        ),
        "{priorities}"
    );
}

/// US1.1: the first line is the title, and the rest is kept as typed.
#[test]
fn a_typed_text_starts_a_change() {
    let repo = draft_repo();

    let started = start_text(&repo, TYPED, &[], Some("centred-x")).unwrap();

    assert_eq!(started.folder, CHANGE_FOLDER);
    let proposal = format!("specs/changes/{CHANGE_FOLDER}/proposal.md");
    assert_eq!(
        in_change(&repo, &proposal),
        "# Centre the x in failure circles\n\nIn failures the x sits low in its circle.\n"
    );
    let branch = format!("change/{CHANGE_FOLDER}");
    assert_eq!(repo.changed_in(&branch), [proposal]);
    assert_eq!(repo.subjects(&branch)[0], "chore(centred-x): proposal");
    assert_eq!(
        repo.subjects("main")[0],
        "chore(centred-x): start Centre the x in failure circles"
    );
    let priorities = repo.git(&["show", "main:specs/PRIORITIES.md"]);
    assert!(
        priorities.contains(
            "## Now\n\n- [Centre the x in failure circles](/specs/changes/2026-10-16-centred-x/proposal.md)\n"
        ),
        "{priorities}"
    );
    assert_eq!(repo.porcelain(), "");
}

/// US1.2: the images are saved in the change's folder and committed with its proposal.
#[test]
fn a_typed_text_brings_its_images() {
    let repo = draft_repo();

    start_text(&repo, TYPED, &[image(), image()], Some("centred-x")).unwrap();

    let folder = format!("specs/changes/{CHANGE_FOLDER}");
    let proposal = in_change(&repo, &format!("{folder}/proposal.md"));
    assert!(
        proposal.ends_with(
            "circle.\n\n![Image 1](images/image-1.webp)\n\n![Image 2](images/image-2.webp)\n"
        ),
        "{proposal}"
    );
    assert_eq!(
        repo.changed_in(&format!("change/{CHANGE_FOLDER}")),
        [
            format!("{folder}/images/image-1.webp"),
            format!("{folder}/images/image-2.webp"),
            format!("{folder}/proposal.md"),
        ]
    );
}

/// A failed typed start leaves the whole folder to write and commit: the proposal and its images.
#[test]
fn a_failed_typed_start_leaves_its_proposal_and_images() {
    let repo = draft_repo();
    repo.set_hook("exit 1");

    let failed = start_text(&repo, TYPED, &[image()], Some("centred-x"));

    let Err(start::StartError::Partial { left, .. }) = failed else {
        panic!("not a partial failure")
    };
    let folder = format!("specs/changes/{CHANGE_FOLDER}");
    assert_eq!(
        left,
        [
            "commit specs/PRIORITIES.md on main as \"chore(centred-x): start Centre the x in failure circles\"".to_string(),
            format!("create the branch change/{CHANGE_FOLDER}"),
            format!("write {folder}/proposal.md from the text, and its images in {folder}/images/"),
            format!("commit {folder}/ as \"chore(centred-x): proposal\""),
        ]
    );
}

/// Review focus 2: a feature and a change of the same slug and day, in both orders.
#[test]
fn a_slug_taken_by_a_feature_is_refused_for_a_change() {
    for first in [Kind::Feature, Kind::Change] {
        let repo = draft_repo();
        let (git, workspace) = opened(&repo);
        start::run(
            &git,
            &workspace,
            DRAFT,
            Some("centred-x"),
            first,
            change_day(),
            false,
        )
        .unwrap();
        repo.write("specs/drafts/other.md", "# Other\n");
        repo.commit("chore: draft Other");
        let second = match first {
            Kind::Feature => Kind::Change,
            Kind::Change => Kind::Feature,
        };
        let (git, workspace) = opened(&repo);

        let refused = start::run(
            &git,
            &workspace,
            "specs/drafts/other.md",
            Some("centred-x"),
            second,
            change_day(),
            false,
        );

        assert_eq!(
            refused.err().map(|error| error.to_string()).as_deref(),
            Some("2026-10-16-centred-x exists: choose another slug with --slug"),
            "{first:?} first"
        );
    }
}

/// Review focus 1 and 2: a name held by a folder alone, of either kind, or by a branch alone, of
/// either kind, for a start of either kind.
#[test]
fn a_folder_or_a_branch_alone_takes_the_name() {
    let holders: [(&str, Option<&str>, Kind); 6] = [
        (
            "specs/changes/2026-10-16-centred-x/proposal.md",
            None,
            Kind::Change,
        ),
        ("specs/2026-10-16-centred-x/proposal.md", None, Kind::Change),
        (
            "README.md",
            Some("change/2026-10-16-centred-x"),
            Kind::Change,
        ),
        ("README.md", Some("2026-10-16-centred-x"), Kind::Change),
        ("README.md", Some("2026-10-16-centred-x"), Kind::Feature),
        (
            "README.md",
            Some("change/2026-10-16-centred-x"),
            Kind::Feature,
        ),
    ];
    for (file, branch, kind) in holders {
        let repo = draft_repo();
        repo.write(file, "# Held\n");
        repo.commit("chore: hold the name");
        if let Some(branch) = branch {
            repo.branch(branch);
        }
        let (git, workspace) = opened(&repo);

        let refused = start::run(
            &git,
            &workspace,
            DRAFT,
            Some("centred-x"),
            kind,
            change_day(),
            false,
        );

        assert_eq!(
            refused.err().map(|error| error.to_string()).as_deref(),
            Some("2026-10-16-centred-x exists: choose another slug with --slug"),
            "{file} {branch:?} {kind:?}"
        );
    }
}

/// Review focus 3: the title is the first written line, and the blank lines after it are kept.
#[test]
fn a_typed_text_with_a_blank_first_line_takes_its_first_written_line() {
    let repo = draft_repo();

    start_text(
        &repo,
        "\n   \n  Centre the x  \n\nFirst.\n\n\nSecond.\n\n",
        &[],
        Some("centred-x"),
    )
    .unwrap();

    assert_eq!(
        in_change(&repo, &format!("specs/changes/{CHANGE_FOLDER}/proposal.md")),
        "# Centre the x\n\nFirst.\n\n\nSecond.\n"
    );
}

/// The spec's assumption: a first line over 80 characters is cut for the title, and kept whole.
#[test]
fn a_long_first_line_is_cut_for_the_title_and_kept_whole() {
    let repo = draft_repo();
    let line = format!("{} tail", "word ".repeat(16).trim_end());

    start_text(&repo, &format!("{line}\n\nMore."), &[], Some("centred-x")).unwrap();

    let title: String = line.chars().take(80).collect();
    assert_eq!(
        in_change(&repo, &format!("specs/changes/{CHANGE_FOLDER}/proposal.md")),
        format!("# {}\n\n{line}\n\nMore.\n", title.trim_end())
    );
}

/// A title typed as a heading loses its marks: the proposal has one heading.
#[test]
fn a_title_typed_as_a_heading_drops_its_marks() {
    let repo = draft_repo();

    start_text(&repo, "## Centre the x\n\nMore.", &[], Some("centred-x")).unwrap();

    assert_eq!(
        in_change(&repo, &format!("specs/changes/{CHANGE_FOLDER}/proposal.md")),
        "# Centre the x\n\nMore.\n"
    );
    assert_eq!(
        repo.subjects("main")[0],
        "chore(centred-x): start Centre the x"
    );
}

#[test]
fn a_text_with_no_written_line_is_refused() {
    let repo = draft_repo();

    let refused = start_text(&repo, " \n\n", &[], Some("centred-x"));

    assert_eq!(
        refused.err().map(|error| error.to_string()).as_deref(),
        Some("a change needs a text: its first line is its title")
    );
}
