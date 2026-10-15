//! Notes moved out of the inbox, and the one change list that counts, names, commits, and
//! discards them with the priorities and the drafts they went into.

mod common;

use common::repo::TestRepo;
use uraeda_core::actions::inbox::{self as actions, Marks};
use uraeda_core::actions::{changes, draft, place};
use uraeda_core::api;
use uraeda_core::files::inbox::Inbox;
use uraeda_core::files::priorities::Section;
use uraeda_core::git::Git;

const INBOX: &str = "specs/INBOX.md";
const PRIORITIES: &str = "specs/PRIORITIES.md";
const LOOK: &str = "specs/drafts/look-and-feel.md";
const LOOK_TEXT: &str = "# Look and feel pass\n\n## What\n\nA pass over the app's spacing and icons.\n\n## Why\n\nIt looks unfinished.\n";

fn fixture_text(path: &str) -> String {
    std::fs::read_to_string(common::fixture(path)).unwrap()
}

/// A repository on `main` with the fixture's `INBOX.md` and `PRIORITIES.md`, and the draft "Look
/// and feel pass".
fn fixture_repo() -> TestRepo {
    let repo = TestRepo::new();
    repo.write("specs/README.md", "# Specs\n");
    for name in ["INBOX.md", "PRIORITIES.md", "drafts/git-listener.md"] {
        repo.write(
            &format!("specs/{name}"),
            &fixture_text(&format!("repo/main/specs/{name}")),
        );
    }
    repo.write(LOOK, LOOK_TEXT);
    repo.commit("chore: specs");
    repo
}

fn main_place(repo: &TestRepo) -> place::Place {
    place::reach(&Git::discover(repo.path()).unwrap(), "main").unwrap()
}

/// The id of the note whose text is `text`.
fn id(inbox: &Inbox, text: &str) -> String {
    inbox
        .categories
        .iter()
        .flat_map(|category| &category.notes)
        .find(|note| note.text == text)
        .unwrap_or_else(|| panic!("no note {text}"))
        .id
        .clone()
}

/// Moves the note `text` to a section of the priorities, over the files as they are.
fn to_priorities(place: &place::Place, text: &str, section: Section) {
    let inbox = actions::read(place);
    let priorities = uraeda_core::actions::priorities::read(place);
    actions::to_priorities(
        place,
        &id(&inbox, text),
        section,
        &inbox.hash,
        &priorities.hash,
    )
    .unwrap();
}

/// US2 1: the note leaves the inbox, and is the last entry of Next. Both files count the move
/// once.
#[test]
fn a_note_moves_to_the_priorities() {
    let repo = fixture_repo();
    let inbox = api::read_inbox(repo.path()).unwrap();
    let priorities = api::read_priorities(repo.path()).unwrap();

    api::note_to_priorities(
        repo.path(),
        &id(&inbox, "Draft to proposal on mobile went 404"),
        "next",
        &inbox.hash,
        &priorities.hash,
    )
    .unwrap();

    assert!(!repo.read(INBOX).contains("Draft to proposal"));
    assert!(repo.read(PRIORITIES).contains(
        "- [Git listener process](drafts/git-listener.md)\n\
         - Draft to proposal on mobile went 404\n\n## Later"
    ));
    assert_eq!(api::read_inbox(repo.path()).unwrap().changes, 1);
    assert_eq!(api::read_priorities(repo.path()).unwrap().changes, 1);
}

/// A note's marks stay in the inbox: the priorities get its text.
#[test]
fn a_marked_note_moves_without_its_marks() {
    let repo = fixture_repo();
    let place = main_place(&repo);

    to_priorities(
        &place,
        "Opening a session with 2,000 messages takes 4 s",
        Section::Now,
    );

    assert!(repo.read(PRIORITIES).contains(
        "- [Plan review](/specs/2026-10-13-plan-review/proposal.md)\n\
         - Opening a session with 2,000 messages takes 4 s\n\n## Next"
    ));
    assert_eq!(changes::list(&place).count, 1);
}

/// US2 2: a draft from the proposal template, linked from the end of Later.
#[test]
fn a_note_becomes_a_draft_linked_from_the_priorities() {
    let repo = fixture_repo();
    let inbox = api::read_inbox(repo.path()).unwrap();
    let priorities = api::read_priorities(repo.path()).unwrap();

    let path = api::note_to_new_draft(
        repo.path(),
        &id(&inbox, "We need a home icon"),
        "later",
        &inbox.hash,
        &priorities.hash,
    )
    .unwrap();

    assert_eq!(path, "specs/drafts/we-need-a-home-icon.md");
    let draft = repo.read(&path);
    assert!(
        draft.contains("# We need a home icon\n\n## What\n\nWe need a home icon\n\n## Why\n"),
        "{draft}"
    );
    assert!(!draft.contains('['), "a placeholder is left: {draft}");
    assert!(repo.read(PRIORITIES).contains(
        "  - with a cache\n- [We need a home icon](drafts/we-need-a-home-icon.md)\n\n## Blocked"
    ));
    assert!(!repo.read(INBOX).contains("home icon"));
}

/// R1: a taken slug gets `-2`.
#[test]
fn a_draft_from_a_note_gets_a_free_name() {
    let repo = fixture_repo();
    repo.write("specs/drafts/we-need-a-home-icon.md", "# Home\n");
    repo.commit("chore: draft Home");
    let place = main_place(&repo);
    let inbox = actions::read(&place);
    let priorities = uraeda_core::actions::priorities::read(&place);

    let path = actions::to_new_draft(
        &place,
        &id(&inbox, "We need a home icon"),
        Section::Later,
        &inbox.hash,
        &priorities.hash,
    )
    .unwrap();

    assert_eq!(path, "specs/drafts/we-need-a-home-icon-2.md");
    assert_eq!(repo.read("specs/drafts/we-need-a-home-icon.md"), "# Home\n");
    assert!(
        repo.read(PRIORITIES)
            .contains("- [We need a home icon](drafts/we-need-a-home-icon-2.md)\n")
    );
}

/// US2 3: the note is the last line of the draft's What.
#[test]
fn a_note_is_added_to_a_draft() {
    let repo = fixture_repo();
    let inbox = api::read_inbox(repo.path()).unwrap();

    api::note_to_draft(
        repo.path(),
        &id(&inbox, "Icons are blurry on retina screens"),
        LOOK,
        &inbox.hash,
    )
    .unwrap();

    assert_eq!(
        repo.read(LOOK),
        "# Look and feel pass\n\n## What\n\nA pass over the app's spacing and icons.\n\n\
         - Icons are blurry on retina screens\n\n## Why\n\nIt looks unfinished.\n"
    );
    assert!(!repo.read(INBOX).contains("Icons are blurry"));
    assert_eq!(api::read_inbox(repo.path()).unwrap().changes, 1);
}

/// US6 2, the core's half: a draft from the note's text, and the note linking it.
#[test]
fn a_note_is_added_as_a_draft() {
    let repo = fixture_repo();
    let place = main_place(&repo);

    let path = actions::add_as_draft(
        &place,
        Some("UI"),
        &Marks::default(),
        "The spec headings are body-sized",
        None,
    )
    .unwrap();

    assert_eq!(path, "specs/drafts/the-spec-headings-are-body-sized.md");
    assert!(repo.read(&path).contains(
        "# The spec headings are body-sized\n\n## What\n\nThe spec headings are body-sized\n"
    ));
    assert!(repo.read(INBOX).contains(
        "- Text input feels laggy on the sessions page\n\
         - [The spec headings are body-sized](drafts/the-spec-headings-are-body-sized.md)\n\n## CLI"
    ));
    let committed = changes::commit(&place).unwrap();
    assert_eq!(
        committed.change.subject,
        "chore: add \"The spec headings are body-sized\" to the inbox"
    );
    assert_eq!(repo.changed_in("main"), [INBOX, path.as_str()]);
}

/// Review focus 3: with only `PRIORITIES.md` changed on disk, the move is refused for it, and
/// nothing is written.
#[test]
fn a_move_over_changed_priorities_writes_nothing() {
    let repo = fixture_repo();
    let inbox = api::read_inbox(repo.path()).unwrap();
    let priorities = api::read_priorities(repo.path()).unwrap();
    let changed = repo
        .read(PRIORITIES)
        .replace("with a cache", "with a cache!");
    repo.write(PRIORITIES, &changed);
    let note = id(&inbox, "We need a home icon");

    let error = api::note_to_priorities(repo.path(), &note, "next", &inbox.hash, &priorities.hash)
        .unwrap_err();
    assert_eq!(
        error.message,
        "PRIORITIES.md changed on disk. Your change was not applied."
    );
    assert_eq!(error.code, "conflict");
    let error = api::note_to_new_draft(repo.path(), &note, "next", &inbox.hash, &priorities.hash)
        .unwrap_err();
    assert_eq!(error.code, "conflict");

    assert_eq!(repo.read(INBOX), fixture_text("repo/main/specs/INBOX.md"));
    assert_eq!(repo.read(PRIORITIES), changed);
    assert!(!repo.exists("specs/drafts/we-need-a-home-icon.md"));
}

/// US2 7: two moves and a deletion, in one commit of the two files.
#[test]
fn moves_and_a_deletion_are_committed_together() {
    let repo = fixture_repo();
    let place = main_place(&repo);
    to_priorities(
        &place,
        "Draft to proposal on mobile went 404",
        Section::Next,
    );
    to_priorities(&place, "Icons are blurry on retina screens", Section::Next);
    let inbox = actions::read(&place);
    actions::remove(
        &place,
        &id(&inbox, "Make sure agents are resumable"),
        Some(&inbox.hash),
    )
    .unwrap();

    assert_eq!(changes::list(&place).count, 3);
    assert_eq!(actions::read(&place).changes, 3);
    assert_eq!(uraeda_core::actions::priorities::read(&place).changes, 3);
    let committed = changes::commit(&place).unwrap();

    assert_eq!(
        committed.change.subject,
        "chore: move \"Draft to proposal on mobile went 404\" from the inbox to Next, and 2 more"
    );
    assert_eq!(
        committed.change.body.as_deref(),
        Some(
            "- Move from the inbox to Next: Draft to proposal on mobile went 404\n\
             - Move from the inbox to Next: Icons are blurry on retina screens\n\
             - Remove from the inbox: Make sure agents are resumable"
        )
    );
    assert_eq!(repo.changed_in("main"), [INBOX, PRIORITIES]);
    assert_eq!(repo.porcelain(), "");
    assert_eq!(changes::list(&place).count, 0);
}

/// US2 8: the draft is in the commit, and the change names it.
#[test]
fn a_note_added_to_a_draft_is_committed_with_it() {
    let repo = fixture_repo();
    let inbox = api::read_inbox(repo.path()).unwrap();
    api::note_to_draft(
        repo.path(),
        &id(&inbox, "Icons are blurry on retina screens"),
        LOOK,
        &inbox.hash,
    )
    .unwrap();

    api::commit_changes(repo.path()).unwrap();

    assert_eq!(
        repo.subjects("main")[0],
        "chore: move \"Icons are blurry on retina screens\" from the inbox to the draft Look and feel pass"
    );
    assert_eq!(repo.changed_in("main"), [INBOX, LOOK]);
    assert_eq!(repo.porcelain(), "");
}

/// One change of each kind, and the subject it gets.
#[test]
fn each_change_has_its_subject() {
    type Act = fn(&place::Place);
    let cases: [(&str, Act); 10] = [
        ("add \"An idea\" to the inbox", |place| {
            actions::add(place, Some("UI"), &Marks::default(), "An idea", None).unwrap();
        }),
        ("edit \"We need a home button\" in the inbox", |place| {
            let inbox = actions::read(place);
            let note = id(&inbox, "We need a home icon");
            actions::edit(place, &note, "We need a home button", None).unwrap();
        }),
        ("remove \"We need a home icon\" from the inbox", |place| {
            let note = id(&actions::read(place), "We need a home icon");
            actions::remove(place, &note, None).unwrap();
        }),
        (
            "remove \"Opening a session with 2,000 messages…\" from the inbox",
            |place| {
                let inbox = actions::read(place);
                let note = id(&inbox, "Opening a session with 2,000 messages takes 4 s");
                actions::remove(place, &note, None).unwrap();
            },
        ),
        ("move \"We need a home icon\" to UI in the inbox", |place| {
            let note = id(&actions::read(place), "We need a home icon");
            actions::category(place, &note, Some("UI"), None).unwrap();
        }),
        (
            "move \"Make sure agents are resumable\" to No category in the inbox",
            |place| {
                let note = id(&actions::read(place), "Make sure agents are resumable");
                actions::category(place, &note, None, None).unwrap();
            },
        ),
        (
            "move \"We need a home icon\" from the inbox to Next",
            |place| {
                to_priorities(place, "We need a home icon", Section::Next);
            },
        ),
        (
            "move \"We need a home icon\" from the inbox to Later",
            |place| {
                let inbox = actions::read(place);
                let priorities = uraeda_core::actions::priorities::read(place);
                let note = id(&inbox, "We need a home icon");
                actions::to_new_draft(place, &note, Section::Later, &inbox.hash, &priorities.hash)
                    .unwrap();
            },
        ),
        (
            "move \"Icons are blurry on retina screens\" from the inbox to the draft Look and feel pass",
            |place| {
                let inbox = actions::read(place);
                let note = id(&inbox, "Icons are blurry on retina screens");
                actions::to_draft(place, &note, LOOK, &inbox.hash).unwrap();
            },
        ),
        ("add \"An idea\" to Next", |place| {
            let priorities = uraeda_core::actions::priorities::read(place);
            uraeda_core::actions::priorities::add(
                place,
                Section::Next,
                "An idea",
                &priorities.hash,
            )
            .unwrap();
        }),
    ];
    for (subject, act) in cases {
        let repo = fixture_repo();
        let place = main_place(&repo);
        act(&place);
        assert_eq!(
            changes::message(&place),
            (format!("chore: {subject}"), None),
            "{subject}"
        );
        assert_eq!(changes::list(&place).count, 1, "{subject}");
    }
}

/// Review focus 4: a note edited, then moved to the priorities, is a removal and an addition,
/// each named with its own text.
#[test]
fn an_edited_then_moved_note_is_two_changes() {
    let repo = fixture_repo();
    let place = main_place(&repo);
    let inbox = actions::read(&place);
    let note = id(&inbox, "Draft to proposal on mobile went 404");
    actions::edit(&place, &note, "Draft to proposal 404s on mobile", None).unwrap();

    to_priorities(&place, "Draft to proposal 404s on mobile", Section::Next);

    let list = changes::list(&place);
    assert_eq!(list.count, 2);
    assert_eq!(
        list.lines,
        [
            "- Remove from the inbox: Draft to proposal on mobile went 404",
            "- Add to Next: Draft to proposal 404s on mobile",
        ]
    );
}

/// Discard restores the inbox, the priorities, and the drafts, and deletes a draft made from a
/// note.
#[test]
fn discard_restores_every_file() {
    let repo = fixture_repo();
    let place = main_place(&repo);
    to_priorities(
        &place,
        "Draft to proposal on mobile went 404",
        Section::Next,
    );
    let inbox = actions::read(&place);
    let priorities = uraeda_core::actions::priorities::read(&place);
    let note = id(&inbox, "We need a home icon");
    let draft = actions::to_new_draft(&place, &note, Section::Later, &inbox.hash, &priorities.hash)
        .unwrap();
    let inbox = actions::read(&place);
    let note = id(&inbox, "Icons are blurry on retina screens");
    actions::to_draft(&place, &note, LOOK, &inbox.hash).unwrap();
    assert_eq!(changes::list(&place).count, 3);

    api::discard_changes(repo.path()).unwrap();

    assert_eq!(repo.porcelain(), "");
    assert!(!repo.exists(&draft));
    assert_eq!(repo.read(LOOK), LOOK_TEXT);
    assert_eq!(changes::list(&place).count, 0);
}

/// A draft made from a note, committed from its editor, holds the inbox it left.
#[test]
fn a_drafts_commit_holds_the_inbox() {
    let repo = fixture_repo();
    let inbox = api::read_inbox(repo.path()).unwrap();
    let priorities = api::read_priorities(repo.path()).unwrap();
    let path = api::note_to_new_draft(
        repo.path(),
        &id(&inbox, "We need a home icon"),
        "later",
        &inbox.hash,
        &priorities.hash,
    )
    .unwrap();

    api::commit_text(repo.path(), &path).unwrap();

    assert_eq!(repo.changed_in("main"), [INBOX, PRIORITIES, path.as_str()]);
    assert_eq!(repo.porcelain(), "");
}

/// Discard never loses the human's text: a draft made from a moved entry with the Draft button,
/// then typed in, is kept.
#[test]
fn discard_keeps_a_draft_typed_in_after_a_move() {
    let repo = fixture_repo();
    let place = main_place(&repo);
    to_priorities(&place, "We need a home icon", Section::Next);
    let drafted = draft::create(&place, "next-3").unwrap();
    let typed = format!("{}\nA house, in the top bar.\n", repo.read(&drafted.path));
    repo.write(&drafted.path, &typed);

    uraeda_core::actions::priorities::discard(&place).unwrap();

    assert_eq!(repo.read(&drafted.path), typed);
    assert_eq!(repo.read(INBOX), fixture_text("repo/main/specs/INBOX.md"));
    assert_eq!(
        repo.read(PRIORITIES),
        fixture_text("repo/main/specs/PRIORITIES.md")
    );
}

/// Discard takes back the note added to a draft, and keeps what the human typed in it.
#[test]
fn discard_keeps_typing_in_a_draft_a_note_went_into() {
    let repo = fixture_repo();
    let place = main_place(&repo);
    let typed = LOOK_TEXT.replace("It looks unfinished.", "It looks unfinished, and dated.");
    repo.write(LOOK, &typed);
    let inbox = actions::read(&place);
    let note = id(&inbox, "Icons are blurry on retina screens");
    actions::to_draft(&place, &note, LOOK, &inbox.hash).unwrap();

    changes::discard(&place).unwrap();

    assert_eq!(repo.read(LOOK), typed);
    assert_eq!(repo.read(INBOX), fixture_text("repo/main/specs/INBOX.md"));
}

/// A draft made from a note and typed in is kept by Discard too, and one left as written goes.
#[test]
fn discard_deletes_only_untouched_drafts_made_from_notes() {
    let repo = fixture_repo();
    let place = main_place(&repo);
    let typed = actions::add_as_draft(&place, None, &Marks::default(), "Dark mode", None).unwrap();
    let untouched =
        actions::add_as_draft(&place, None, &Marks::default(), "Light mode", None).unwrap();
    let text = repo
        .read(&typed)
        .replace("## Why\n", "## Why\n\nMy eyes.\n");
    repo.write(&typed, &text);

    changes::discard(&place).unwrap();

    assert_eq!(repo.read(&typed), text);
    assert!(!repo.exists(&untouched));
    assert_eq!(repo.read(INBOX), fixture_text("repo/main/specs/INBOX.md"));
}

/// A first `INBOX.md`, never committed, goes into the commit of the draft its note made.
#[test]
fn a_first_inbox_is_committed_with_its_draft() {
    let repo = TestRepo::new();
    repo.write("specs/README.md", "# Specs\n");
    repo.commit("chore: specs");
    let place = main_place(&repo);
    let path = actions::add_as_draft(&place, None, &Marks::default(), "Dark mode", None).unwrap();

    api::commit_text(repo.path(), &path).unwrap();

    assert_eq!(repo.changed_in("main"), [INBOX, path.as_str()]);
}

/// A note with brackets and code keeps its markdown in the draft, and its link parses and pairs.
#[test]
fn a_note_with_brackets_and_code_is_linked_as_written() {
    let repo = fixture_repo();
    let place = main_place(&repo);
    let text = "Fix [x] in the `a]b` view";
    actions::add(&place, None, &Marks::default(), text, None).unwrap();
    changes::commit(&place).unwrap();
    let inbox = actions::read(&place);
    let priorities = uraeda_core::actions::priorities::read(&place);
    let note = id(&inbox, text);

    let path = actions::to_new_draft(&place, &note, Section::Later, &inbox.hash, &priorities.hash)
        .unwrap();

    assert!(
        repo.read(&path)
            .contains(&format!("# {text}\n\n## What\n\n{text}\n"))
    );
    assert!(repo.read(PRIORITIES).contains(&format!(
        "- [Fix \\[x\\] in the `a]b` view]({})\n",
        path.trim_start_matches("specs/")
    )));
    assert_eq!(
        changes::list(&place).lines,
        ["- Move from the inbox to Later: Fix [x] in the a]b view"]
    );
    changes::discard(&place).unwrap();
    assert!(!repo.exists(&path));

    let added = actions::add_as_draft(&place, Some("UI"), &Marks::default(), text, None).unwrap();
    let read = actions::read(&place);
    let linked = &read.categories[1].notes.last().unwrap();
    assert_eq!(linked.draft.as_deref(), Some(added.as_str()));
    assert_eq!(
        changes::list(&place).lines,
        ["- Add to the inbox: Fix [x] in the a]b view"]
    );
    changes::discard(&place).unwrap();
    assert!(!repo.exists(&added));
    assert_eq!(repo.porcelain(), "");
}

/// A What ending with indented code gets the note after a blank line, so it is not code.
#[test]
fn a_note_after_indented_code_is_a_list_item() {
    let repo = fixture_repo();
    let place = main_place(&repo);
    let code = LOOK_TEXT.replace("icons.\n", "icons.\n\n    let x = 1;\n");
    repo.write(LOOK, &code);
    let inbox = actions::read(&place);
    let note = id(&inbox, "Icons are blurry on retina screens");

    actions::to_draft(&place, &note, LOOK, &inbox.hash).unwrap();

    assert!(
        repo.read(LOOK)
            .contains("    let x = 1;\n\n- Icons are blurry on retina screens\n\n## Why")
    );
}

/// A note with an indented code fence and a sub-bullet, committed in the fixture's inbox.
const CRASH: &str =
    "- Crash on start\n  ```\n  thread main panicked\n  - not an item\n  ```\n  - sub bullet\n";

/// A repository whose inbox holds [`CRASH`] at the end of `## CLI`, committed.
fn crash_repo() -> (TestRepo, place::Place, String) {
    let repo = fixture_repo();
    let inbox = format!("{}{CRASH}", repo.read(INBOX));
    repo.write(INBOX, &inbox);
    repo.commit("chore: a note with code");
    let place = main_place(&repo);
    let read = actions::read(&place);
    let priorities = uraeda_core::actions::priorities::read(&place);
    let note = read
        .categories
        .last()
        .unwrap()
        .notes
        .last()
        .unwrap()
        .id
        .clone();
    let path =
        actions::to_new_draft(&place, &note, Section::Next, &read.hash, &priorities.hash).unwrap();
    (repo, place, path)
}

/// A note's code fence goes into the draft's What whole, re-indented, after the note's first line,
/// which is the title alone.
#[test]
fn a_note_with_code_becomes_a_draft_with_its_code() {
    let (repo, _, path) = crash_repo();

    assert_eq!(path, "specs/drafts/crash-on-start.md");
    let draft = repo.read(&path);
    assert!(
        draft.contains(
            "# Crash on start\n\n## What\n\nCrash on start\n\n\
             ```\nthread main panicked\n- not an item\n```\n- sub bullet\n\n## Why\n"
        ),
        "{draft}"
    );
    assert!(
        repo.read(PRIORITIES)
            .contains("- [Crash on start](drafts/crash-on-start.md)\n")
    );
}

/// The change list counts the note made a draft as one move, Commit holds the draft, and Discard
/// deletes it.
#[test]
fn a_note_with_code_made_a_draft_is_one_move() {
    let (repo, place, path) = crash_repo();

    assert_eq!(
        changes::list(&place).lines,
        ["- Move from the inbox to Next: Crash on start"]
    );
    changes::discard(&place).unwrap();
    assert!(!repo.exists(&path));
    assert_eq!(repo.porcelain(), "");

    let (repo, place, path) = crash_repo();
    changes::commit(&place).unwrap();
    assert_eq!(repo.changed_in("main"), [INBOX, PRIORITIES, path.as_str()]);
    assert_eq!(repo.porcelain(), "");
}
