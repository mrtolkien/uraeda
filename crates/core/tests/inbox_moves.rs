//! Notes moved out of the inbox, and the one change list that counts, names, commits, and
//! discards them with the priorities and the proposal files they went into.

mod common;

use common::repo::TestRepo;
use uraeda_core::actions::inbox::{self as actions, Marks};
use uraeda_core::actions::{changes, expand, place};
use uraeda_core::api;
use uraeda_core::files::inbox::Inbox;
use uraeda_core::files::priorities::Section;
use uraeda_core::git::Git;

const INBOX: &str = "specs/INBOX.md";
const PRIORITIES: &str = "specs/PRIORITIES.md";
const LOOK: &str = "specs/proposals/look-and-feel.md";
const LOOK_TEXT: &str = "# Look and feel pass\n\n## What\n\nA pass over the app's spacing and icons.\n\n## Why\n\nIt looks unfinished.\n";

fn fixture_text(path: &str) -> String {
    std::fs::read_to_string(common::fixture(path)).unwrap()
}

/// A repository on `main` with the fixture's `INBOX.md` and `PRIORITIES.md`, and the proposal file
/// "Look and feel pass".
fn fixture_repo() -> TestRepo {
    let repo = TestRepo::new();
    repo.write("specs/README.md", "# Specs\n");
    for name in ["INBOX.md", "PRIORITIES.md", "proposals/git-listener.md"] {
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
fn to_proposal(place: &place::Place, text: &str, section: Section) {
    let inbox = actions::read(place);
    let priorities = uraeda_core::actions::priorities::read(place);
    actions::to_proposal(
        place,
        &id(&inbox, text),
        section,
        &inbox.hash,
        &priorities.hash,
    )
    .unwrap();
}

/// Adds a note with an image, as the add form does: a proposal file folder linked from the inbox,
/// over the inbox as it is. Returns the proposal file's path.
fn add_with_image(repo: &TestRepo, category: Option<&str>, text: &str) -> String {
    let inbox = api::read_inbox(repo.path()).unwrap();
    let image = std::fs::read(common::fixture("images/phone.png")).unwrap();
    let (_, proposal_file) = api::add_note_with_images(
        repo.path(),
        category.map(String::from),
        None,
        text,
        &[(image, Some("phone.png".to_string()))],
        &inbox.hash,
    )
    .unwrap();
    proposal_file
}

/// US2 1: the note leaves the inbox, and is the last proposal of Next. Both files count the move
/// once.
#[test]
fn a_note_moves_to_the_priorities() {
    let repo = fixture_repo();
    let inbox = api::read_inbox(repo.path()).unwrap();
    let priorities = api::read_priorities(repo.path()).unwrap();

    api::note_to_proposal(
        repo.path(),
        &id(&inbox, "Draft to proposal on mobile went 404"),
        "next",
        &inbox.hash,
        &priorities.hash,
    )
    .unwrap();

    assert!(!repo.read(INBOX).contains("Draft to proposal"));
    assert!(repo.read(PRIORITIES).contains(
        "- [Git listener process](proposals/git-listener.md)\n\
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

    to_proposal(
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

/// US2 2: a proposal file from the proposal template, linked from the end of Later.
#[test]
fn a_note_becomes_a_proposal_file_linked_from_the_priorities() {
    let repo = fixture_repo();
    let inbox = api::read_inbox(repo.path()).unwrap();
    let priorities = api::read_priorities(repo.path()).unwrap();

    let path = api::note_to_proposal_file(
        repo.path(),
        &id(&inbox, "We need a home icon"),
        "later",
        &inbox.hash,
        &priorities.hash,
    )
    .unwrap();

    assert_eq!(path, "specs/proposals/we-need-a-home-icon.md");
    let proposal_file = repo.read(&path);
    assert!(
        proposal_file
            .contains("# We need a home icon\n\n## What\n\nWe need a home icon\n\n## Why\n"),
        "{proposal_file}"
    );
    assert!(
        !proposal_file.contains('['),
        "a placeholder is left: {proposal_file}"
    );
    assert!(repo.read(PRIORITIES).ends_with(
        "- Benchmarks: after the runner is ready\n- [We need a home icon](proposals/we-need-a-home-icon.md)\n"
    ));
    assert!(!repo.read(INBOX).contains("home icon"));
}

/// R1: a taken slug gets `-2`.
#[test]
fn a_proposal_file_from_a_note_gets_a_free_name() {
    let repo = fixture_repo();
    repo.write("specs/proposals/we-need-a-home-icon.md", "# Home\n");
    repo.commit("chore: expand Home");
    let place = main_place(&repo);
    let inbox = actions::read(&place);
    let priorities = uraeda_core::actions::priorities::read(&place);

    let path = actions::to_proposal_file(
        &place,
        &id(&inbox, "We need a home icon"),
        Section::Later,
        &inbox.hash,
        &priorities.hash,
    )
    .unwrap();

    assert_eq!(path, "specs/proposals/we-need-a-home-icon-2.md");
    assert_eq!(
        repo.read("specs/proposals/we-need-a-home-icon.md"),
        "# Home\n"
    );
    assert!(
        repo.read(PRIORITIES)
            .contains("- [We need a home icon](proposals/we-need-a-home-icon-2.md)\n")
    );
}

/// US2 3: the note is the last line of the proposal file's What.
#[test]
fn a_note_is_added_to_a_proposal_file() {
    let repo = fixture_repo();
    let inbox = api::read_inbox(repo.path()).unwrap();

    api::note_into_proposal(
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

    let error = api::note_to_proposal(repo.path(), &note, "next", &inbox.hash, &priorities.hash)
        .unwrap_err();
    assert_eq!(
        error.message,
        "PRIORITIES.md changed on disk. Your change was not applied."
    );
    assert_eq!(error.code, "conflict");
    let error =
        api::note_to_proposal_file(repo.path(), &note, "next", &inbox.hash, &priorities.hash)
            .unwrap_err();
    assert_eq!(error.code, "conflict");

    assert_eq!(repo.read(INBOX), fixture_text("repo/main/specs/INBOX.md"));
    assert_eq!(repo.read(PRIORITIES), changed);
    assert!(!repo.exists("specs/proposals/we-need-a-home-icon.md"));
}

/// US2 7: two moves and a deletion, in one commit of the two files.
#[test]
fn moves_and_a_deletion_are_committed_together() {
    let repo = fixture_repo();
    let place = main_place(&repo);
    to_proposal(
        &place,
        "Draft to proposal on mobile went 404",
        Section::Next,
    );
    to_proposal(&place, "Icons are blurry on retina screens", Section::Next);
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

/// US2 8: the proposal file is in the commit, and the change names it.
#[test]
fn a_note_added_to_a_proposal_file_is_committed_with_it() {
    let repo = fixture_repo();
    let inbox = api::read_inbox(repo.path()).unwrap();
    api::note_into_proposal(
        repo.path(),
        &id(&inbox, "Icons are blurry on retina screens"),
        LOOK,
        &inbox.hash,
    )
    .unwrap();

    api::commit_changes(repo.path()).unwrap();

    assert_eq!(
        repo.subjects("main")[0],
        "chore: move \"Icons are blurry on retina screens\" from the inbox to the proposal Look and feel pass"
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
                to_proposal(place, "We need a home icon", Section::Next);
            },
        ),
        (
            "move \"We need a home icon\" from the inbox to Later",
            |place| {
                let inbox = actions::read(place);
                let priorities = uraeda_core::actions::priorities::read(place);
                let note = id(&inbox, "We need a home icon");
                actions::to_proposal_file(
                    place,
                    &note,
                    Section::Later,
                    &inbox.hash,
                    &priorities.hash,
                )
                .unwrap();
            },
        ),
        (
            "move \"Icons are blurry on retina screens\" from the inbox to the proposal Look and feel pass",
            |place| {
                let inbox = actions::read(place);
                let note = id(&inbox, "Icons are blurry on retina screens");
                actions::into_proposal(place, &note, LOOK, &inbox.hash).unwrap();
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

    to_proposal(&place, "Draft to proposal 404s on mobile", Section::Next);

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

/// Discard restores the inbox, the priorities, and the proposal files, and deletes a proposal file
/// made from a note.
#[test]
fn discard_restores_every_file() {
    let repo = fixture_repo();
    let place = main_place(&repo);
    to_proposal(
        &place,
        "Draft to proposal on mobile went 404",
        Section::Next,
    );
    let inbox = actions::read(&place);
    let priorities = uraeda_core::actions::priorities::read(&place);
    let note = id(&inbox, "We need a home icon");
    let proposal_file =
        actions::to_proposal_file(&place, &note, Section::Later, &inbox.hash, &priorities.hash)
            .unwrap();
    let inbox = actions::read(&place);
    let note = id(&inbox, "Icons are blurry on retina screens");
    actions::into_proposal(&place, &note, LOOK, &inbox.hash).unwrap();
    assert_eq!(changes::list(&place).count, 3);

    api::discard_changes(repo.path()).unwrap();

    assert_eq!(repo.porcelain(), "");
    assert!(!repo.exists(&proposal_file));
    assert_eq!(repo.read(LOOK), LOOK_TEXT);
    assert_eq!(changes::list(&place).count, 0);
}

/// A proposal file made from a note, committed from its editor, holds the inbox it left.
#[test]
fn a_proposal_files_commit_holds_the_inbox() {
    let repo = fixture_repo();
    let inbox = api::read_inbox(repo.path()).unwrap();
    let priorities = api::read_priorities(repo.path()).unwrap();
    let path = api::note_to_proposal_file(
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

/// Discard never loses the human's text: a proposal file made from a moved proposal with the
/// Proposal file button, then typed in, is kept.
#[test]
fn discard_keeps_a_proposal_file_typed_in_after_a_move() {
    let repo = fixture_repo();
    let place = main_place(&repo);
    to_proposal(&place, "We need a home icon", Section::Next);
    let expanded = expand::create(&place, "next-3").unwrap();
    let typed = format!("{}\nA house, in the top bar.\n", repo.read(&expanded.path));
    repo.write(&expanded.path, &typed);

    uraeda_core::actions::priorities::discard(&place).unwrap();

    assert_eq!(repo.read(&expanded.path), typed);
    assert_eq!(repo.read(INBOX), fixture_text("repo/main/specs/INBOX.md"));
    assert_eq!(
        repo.read(PRIORITIES),
        fixture_text("repo/main/specs/PRIORITIES.md")
    );
}

/// Discard takes back the note added to a proposal file, and keeps what the human typed in it.
#[test]
fn discard_keeps_typing_in_a_proposal_file_a_note_went_into() {
    let repo = fixture_repo();
    let place = main_place(&repo);
    let typed = LOOK_TEXT.replace("It looks unfinished.", "It looks unfinished, and dated.");
    repo.write(LOOK, &typed);
    let inbox = actions::read(&place);
    let note = id(&inbox, "Icons are blurry on retina screens");
    actions::into_proposal(&place, &note, LOOK, &inbox.hash).unwrap();

    changes::discard(&place).unwrap();

    assert_eq!(repo.read(LOOK), typed);
    assert_eq!(repo.read(INBOX), fixture_text("repo/main/specs/INBOX.md"));
}

/// A proposal file made from a note and typed in is kept by Discard too, and one left as written
/// goes.
#[test]
fn discard_deletes_only_untouched_proposal_files_made_from_notes() {
    let repo = fixture_repo();
    let place = main_place(&repo);
    let typed = add_with_image(&repo, None, "Dark mode");
    let untouched = add_with_image(&repo, None, "Light mode");
    let text = repo
        .read(&typed)
        .replace("# Dark mode\n", "# Dark mode\n\nMy eyes.\n");
    repo.write(&typed, &text);

    changes::discard(&place).unwrap();

    assert_eq!(repo.read(&typed), text);
    assert!(!repo.exists(&untouched));
    assert!(!repo.exists("specs/notes/light-mode"));
    assert_eq!(repo.read(INBOX), fixture_text("repo/main/specs/INBOX.md"));
}

/// A first `INBOX.md`, never committed, goes into the commit of the proposal file its note made.
#[test]
fn a_first_inbox_is_committed_with_its_proposal_file() {
    let repo = TestRepo::new();
    repo.write("specs/README.md", "# Specs\n");
    repo.commit("chore: specs");
    let path = add_with_image(&repo, None, "Dark mode");

    api::commit_text(repo.path(), &path).unwrap();

    assert_eq!(
        repo.changed_in("main"),
        [
            INBOX,
            "specs/notes/dark-mode/images/phone.webp",
            path.as_str()
        ]
    );
}

/// A note with brackets and code keeps its markdown in the proposal file, and its link parses and
/// pairs.
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

    let path =
        actions::to_proposal_file(&place, &note, Section::Later, &inbox.hash, &priorities.hash)
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

    let added = add_with_image(&repo, Some("UI"), text);
    let read = actions::read(&place);
    let linked = &read.categories[1].notes.last().unwrap();
    assert_eq!(linked.file.as_deref(), Some(added.as_str()));
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

    actions::into_proposal(&place, &note, LOOK, &inbox.hash).unwrap();

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
    repo.keep();
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
        actions::to_proposal_file(&place, &note, Section::Next, &read.hash, &priorities.hash)
            .unwrap();
    (repo, place, path)
}

/// A note's code fence goes into the proposal file's What whole, re-indented, after the note's
/// first line, which is the title alone.
#[test]
fn a_note_with_code_becomes_a_proposal_file_with_its_code() {
    let (repo, _, path) = crash_repo();

    assert_eq!(path, "specs/proposals/crash-on-start.md");
    let proposal_file = repo.read(&path);
    assert!(
        proposal_file.contains(
            "# Crash on start\n\n## What\n\nCrash on start\n\n\
             ```\nthread main panicked\n- not an item\n```\n- sub bullet\n\n## Why\n"
        ),
        "{proposal_file}"
    );
    assert!(
        repo.read(PRIORITIES)
            .contains("- [Crash on start](proposals/crash-on-start.md)\n")
    );
}

/// The change list counts the note made a proposal file as one move, Commit holds the proposal
/// file, and Discard deletes it.
#[test]
fn a_note_with_code_made_a_proposal_file_is_one_move() {
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

/// A note added since the last commit, then made a proposal file, leaves no trace in the inbox: the
/// commit still holds the proposal file its new proposal links, and Discard deletes the proposal
/// file while untouched.
#[test]
fn a_new_note_made_a_proposal_file_is_committed_and_discarded_with_its_proposal_file() {
    let made = |repo: &TestRepo| {
        let place = main_place(repo);
        actions::add(&place, None, &Marks::default(), "Dark mode", None).unwrap();
        let inbox = actions::read(&place);
        let priorities = uraeda_core::actions::priorities::read(&place);
        let note = id(&inbox, "Dark mode");
        let path =
            actions::to_proposal_file(&place, &note, Section::Later, &inbox.hash, &priorities.hash)
                .unwrap();
        (place, path)
    };
    let repo = fixture_repo();
    let (place, path) = made(&repo);
    assert_eq!(changes::list(&place).count, 1);

    changes::commit(&place).unwrap();

    assert_eq!(repo.changed_in("main"), [PRIORITIES, path.as_str()]);
    assert_eq!(repo.porcelain(), "");

    let repo = fixture_repo();
    let (place, path) = made(&repo);
    changes::discard(&place).unwrap();
    assert!(!repo.exists(&path));
    assert_eq!(repo.porcelain(), "");
}

/// A new proposal file the priorities link, typed in, is kept by Discard, and committed with them.
#[test]
fn a_typed_proposal_file_a_new_proposal_links_is_kept_and_committed() {
    let repo = fixture_repo();
    let place = main_place(&repo);
    let hash = uraeda_core::actions::priorities::read(&place).hash;
    uraeda_core::actions::priorities::add(&place, Section::Later, "Dark mode", &hash).unwrap();
    let expanded = expand::run(&place, "Dark mode").unwrap();
    let linked = repo.read(PRIORITIES);
    let typed = format!("{}\nMy eyes.\n", repo.read(&expanded.path));
    repo.write(&expanded.path, &typed);

    changes::discard(&place).unwrap();
    assert_eq!(repo.read(&expanded.path), typed);

    repo.write(PRIORITIES, &linked);
    changes::commit(&place).unwrap();
    assert_eq!(
        repo.changed_in("main"),
        [PRIORITIES, expanded.path.as_str()]
    );
    assert_eq!(repo.porcelain(), "");
}

/// A note added since the last commit, then added to a committed proposal file, leaves the same
/// files as a bullet typed in the proposal file: the commit bar counts either as the proposal
/// file's edit, and Discard keeps the note's text.
#[test]
fn a_new_note_added_to_a_proposal_file_stays_in_the_proposal_file() {
    let repo = fixture_repo();
    let place = main_place(&repo);
    actions::add(&place, None, &Marks::default(), "Dark mode", None).unwrap();
    let inbox = actions::read(&place);
    actions::into_proposal(&place, &id(&inbox, "Dark mode"), LOOK, &inbox.hash).unwrap();
    let grown = repo.read(LOOK);

    assert_eq!(changes::list(&place).count, 1);
    changes::discard(&place).unwrap();

    assert_eq!(repo.read(LOOK), grown);
    assert!(grown.contains("- Dark mode\n"));
}

/// A proposal file's commit from its editor holds the inbox, and so every proposal file no commit
/// has that it links: two notes added with images are committed together, no link left without its
/// file.
#[test]
fn a_proposal_files_commit_holds_the_other_proposal_files_its_lists_link() {
    let repo = fixture_repo();
    let dark = add_with_image(&repo, None, "Dark mode");
    let light = add_with_image(&repo, None, "Light mode");

    api::commit_text(repo.path(), &dark).unwrap();

    assert_eq!(
        repo.changed_in("main"),
        [
            INBOX,
            "specs/notes/dark-mode/images/phone.webp",
            dark.as_str(),
            "specs/notes/light-mode/images/phone.webp",
            light.as_str(),
        ]
    );
    assert_eq!(repo.porcelain(), "");
}

/// A commit a hook refuses leaves the index as it found it, and Discard after it leaves nothing
/// staged: no deleted file stays in the index to block the next commit or come back.
#[test]
fn a_refused_commit_and_discard_leave_nothing_staged() {
    let repo = fixture_repo();
    let place = main_place(&repo);
    let path = add_with_image(&repo, None, "Dark mode");
    repo.set_hook("exit 1");

    let refused = changes::commit(&place).unwrap_err();

    assert!(matches!(
        refused,
        uraeda_core::actions::ActionError::Hook { .. }
    ));
    assert_eq!(repo.porcelain(), " M specs/INBOX.md\n?? specs/notes/\n");
    repo.git(&["add", "--all", "--", "specs"]);

    changes::discard(&place).unwrap();

    assert!(!repo.exists(&path));
    assert_eq!(repo.porcelain(), "");
    repo.set_hook("exit 0");
    actions::add(&place, None, &Marks::default(), "Light mode", None).unwrap();
    changes::commit(&place).unwrap();
    assert_eq!(repo.changed_in("main"), [INBOX]);
}

/// A note's relative links, written from `specs/`, point at the same files from the proposal file
/// it goes into: rebased, its rooted links, URLs, and anchors kept.
const LINKED: &str = "See [readme](../README.md), ![shot](images/a.png), [top](/README.md), \
                      [web](https://example.com), and [here](#why)";

fn linked_from(folder: &str) -> String {
    format!(
        "See [readme]({folder}../README.md), ![shot]({folder}images/a.png), [top](/README.md), \
         [web](https://example.com), and [here](#why)"
    )
}

/// A note with relative links, nested lines included, made a proposal file: one move, which Discard
/// takes back.
#[test]
fn a_notes_relative_links_are_rebased_into_a_new_proposal_file() {
    let repo = fixture_repo();
    let place = main_place(&repo);
    let note = format!("{LINKED}\n  - [spec](2026-10-06-x/spec.md)\n");
    repo.write(INBOX, &format!("{}- {note}", repo.read(INBOX)));
    repo.commit("chore: a note with links");
    let inbox = actions::read(&place);
    let priorities = uraeda_core::actions::priorities::read(&place);
    let id = inbox
        .categories
        .last()
        .unwrap()
        .notes
        .last()
        .unwrap()
        .id
        .clone();

    let path =
        actions::to_proposal_file(&place, &id, Section::Later, &inbox.hash, &priorities.hash)
            .unwrap();

    let proposal_file = repo.read(&path);
    let rebased = linked_from("../");
    assert!(
        proposal_file.contains(&format!(
            "# {rebased}\n\n## What\n\n{rebased}\n\n- [spec](../2026-10-06-x/spec.md)\n"
        )),
        "{proposal_file}"
    );
    assert_eq!(
        changes::list(&place).lines,
        ["- Move from the inbox to Later: See readme, shot, top, web, and here"]
    );
    changes::discard(&place).unwrap();
    assert!(!repo.exists(&path));
    assert_eq!(repo.porcelain(), "");
}

/// A note added to a proposal file's folder gets its links rebased two folders down, and its Undo
/// takes it back out.
#[test]
fn a_notes_relative_links_are_rebased_into_a_folder_proposal_file() {
    let repo = fixture_repo();
    let folder = "specs/proposals/look/proposal.md";
    repo.write(folder, LOOK_TEXT);
    repo.commit("chore: a folder draft");
    let place = main_place(&repo);
    actions::add(&place, None, &Marks::default(), LINKED, None).unwrap();
    let inbox = api::read_inbox(repo.path()).unwrap();
    let note = inbox.categories[0].notes.last().unwrap().clone();
    let index = u32::try_from(inbox.categories[0].notes.len() - 1).unwrap();

    actions::into_proposal(&place, &note.id, folder, &inbox.hash).unwrap();

    let rebased = linked_from("../../");
    assert!(
        repo.read(folder).contains(&format!("- {rebased}\n")),
        "{}",
        repo.read(folder)
    );
    api::undo_note_into_proposal(repo.path(), folder, &note.lines, None, index).unwrap();
    assert_eq!(repo.read(folder), LOOK_TEXT);
}

/// A note with links added with an image: its note file folder's title links the same
/// files, and Discard still deletes it untouched.
#[test]
fn a_note_with_links_added_with_an_image_links_the_same_files() {
    let repo = fixture_repo();
    let place = main_place(&repo);

    let path = add_with_image(&repo, None, "Like [readme](../README.md)");

    let proposal_file = repo.read(&path);
    assert!(
        proposal_file.starts_with("# Like [readme](../../../README.md)\n\n![phone]"),
        "{proposal_file}"
    );
    changes::discard(&place).unwrap();
    assert!(!repo.exists(&path));
    assert_eq!(repo.porcelain(), "");
}

const LISTENER: &str = "specs/proposals/git-listener.md";
const LISTENER_FOLDER: &str = "specs/proposals/git-listener/proposal.md";

/// Attaches an image to the committed proposal file "Git listener process", which the priorities
/// link: it becomes a folder, and the priorities link its `proposal.md`.
fn attach_to_listener(repo: &TestRepo) {
    let image = std::fs::read(common::fixture("images/phone.png")).unwrap();
    let attached = api::attach_image(repo.path(), LISTENER, &image, Some("phone.png")).unwrap();
    assert_eq!(attached.moved.as_deref(), Some(LISTENER_FOLDER));
}

/// A committed single proposal file that became a folder is committed as a rename: the old file's
/// deletion goes with the folder, nothing left behind.
#[test]
fn a_proposal_file_made_a_folder_is_committed_as_a_rename() {
    let repo = fixture_repo();
    let place = main_place(&repo);
    attach_to_listener(&repo);
    let linked = format!(
        "{}\n![phone](images/phone.webp)\n",
        repo.read(LISTENER_FOLDER)
    );
    repo.write(LISTENER_FOLDER, &linked);

    changes::commit(&place).unwrap();

    assert_eq!(
        repo.changed_in("main"),
        [
            PRIORITIES,
            LISTENER,
            "specs/proposals/git-listener/images/phone.webp",
            LISTENER_FOLDER,
        ]
    );
    assert_eq!(repo.porcelain(), "");
}

/// Discard puts an untouched proposal file made a folder back where it was: the old file restored,
/// the folder and its image gone, the priorities linking the old file again.
#[test]
fn discard_puts_back_an_untouched_proposal_file_made_a_folder() {
    let repo = fixture_repo();
    let place = main_place(&repo);
    let text = repo.read(LISTENER);
    attach_to_listener(&repo);

    changes::discard(&place).unwrap();

    assert_eq!(repo.read(LISTENER), text);
    assert!(!repo.exists("specs/proposals/git-listener"));
    assert_eq!(repo.porcelain(), "");
}

/// Discard keeps a proposal file made a folder and typed in since, and the priorities' link to it:
/// no link points at a missing file, and nothing typed is lost.
#[test]
fn discard_keeps_a_proposal_file_made_a_folder_and_typed_in() {
    let repo = fixture_repo();
    let place = main_place(&repo);
    attach_to_listener(&repo);
    let linked = repo.read(PRIORITIES);
    let typed = format!("{}\nMy notes.\n", repo.read(LISTENER_FOLDER));
    repo.write(LISTENER_FOLDER, &typed);

    changes::discard(&place).unwrap();

    assert_eq!(repo.read(LISTENER_FOLDER), typed);
    assert!(!repo.exists(LISTENER));
    assert_eq!(repo.read(PRIORITIES), linked);
}

/// A note whose whole text links a file that is no proposal file is made a proposal file as any
/// note: one move, whose untouched proposal file Discard deletes. Only a note linking a proposal
/// file is one already.
#[test]
fn a_note_linking_a_file_that_is_no_proposal_file_is_made_a_proposal_file() {
    let repo = fixture_repo();
    let place = main_place(&repo);
    actions::add(
        &place,
        None,
        &Marks::default(),
        "[README](../README.md)",
        None,
    )
    .unwrap();
    repo.commit("chore: a note");
    let inbox = actions::read(&place);
    let priorities = uraeda_core::actions::priorities::read(&place);

    let path = actions::to_proposal_file(
        &place,
        &id(&inbox, "[README](../README.md)"),
        Section::Later,
        &inbox.hash,
        &priorities.hash,
    )
    .unwrap();

    assert_eq!(
        changes::list(&place).lines,
        ["- Move from the inbox to Later: README"]
    );
    changes::discard(&place).unwrap();
    assert!(!repo.exists(&path));
    assert_eq!(repo.porcelain(), "");
}

/// A note whose whole text links a proposal file is refused: it is one already.
#[test]
fn a_note_linking_a_proposal_file_is_not_made_one() {
    let repo = fixture_repo();
    let place = main_place(&repo);
    let text = "[Look and feel pass](proposals/look-and-feel.md)";
    actions::add(&place, None, &Marks::default(), text, None).unwrap();
    let inbox = actions::read(&place);
    let priorities = uraeda_core::actions::priorities::read(&place);

    let refused = actions::to_proposal_file(
        &place,
        &id(&inbox, text),
        Section::Later,
        &inbox.hash,
        &priorities.hash,
    );

    assert!(refused.is_err());
}

/// The texts of a category's notes, in order.
fn texts(inbox: &Inbox, category: &str) -> Vec<String> {
    inbox
        .categories
        .iter()
        .find(|c| c.name.as_deref() == Some(category))
        .map(|c| c.notes.iter().map(|n| n.text.clone()).collect())
        .unwrap_or_default()
}

/// US5 1: a note dragged above the first of its category is first, and its change is a move
/// within it.
#[test]
fn a_note_moves_to_a_place_in_its_category() {
    let repo = fixture_repo();
    let inbox = api::read_inbox(repo.path()).unwrap();
    let note = id(&inbox, "Icons are blurry on retina screens");

    let placed = api::place_note(repo.path(), &note, Some("UI".into()), 0, &inbox.hash).unwrap();

    let ui = texts(&placed, "UI");
    assert_eq!(ui[0], "Icons are blurry on retina screens");
    assert_eq!(ui[1], "In failures the `x` is not centered in the circle");
    assert_eq!(ui[2], "Draft to proposal on mobile went 404");
    assert_eq!(ui.len(), 5);
    assert_eq!(placed.changes, 1);
    let place = main_place(&repo);
    assert_eq!(
        changes::message(&place),
        (
            "chore: move \"Icons are blurry on retina screens\" within UI in the inbox".into(),
            None
        )
    );
}

/// US5 2: a note dragged to the end of another category is its last note, as "move to" does.
#[test]
fn a_note_moves_to_a_place_in_another_category() {
    let repo = fixture_repo();
    let inbox = api::read_inbox(repo.path()).unwrap();
    let note = id(&inbox, "Draft to proposal on mobile went 404");

    let placed = api::place_note(repo.path(), &note, Some("CLI".into()), 2, &inbox.hash).unwrap();

    assert_eq!(
        texts(&placed, "CLI"),
        [
            "Allow no selection in responses (after a warning)",
            "Make sure agents are resumable",
            "Draft to proposal on mobile went 404",
        ]
    );
    assert_eq!(texts(&placed, "UI").len(), 4);
    let place = main_place(&repo);
    assert_eq!(
        changes::message(&place),
        (
            "chore: move \"Draft to proposal on mobile went 404\" to CLI in the inbox".into(),
            None
        )
    );
}

/// A place over an inbox changed since it was read is refused, and writes nothing.
#[test]
fn a_stale_hash_refuses_the_place() {
    let repo = fixture_repo();
    let inbox = api::read_inbox(repo.path()).unwrap();
    let note = id(&inbox, "Icons are blurry on retina screens");
    let changed = repo.read(INBOX).replace("home icon", "home icon!");
    repo.write(INBOX, &changed);

    let error = api::place_note(repo.path(), &note, Some("UI".into()), 0, &inbox.hash).unwrap_err();

    assert_eq!(error.code, "conflict");
    assert_eq!(
        error.message,
        "INBOX.md changed on disk. Your change was not applied."
    );
    assert_eq!(repo.read(INBOX), changed);
}

/// A note whose marks end its first line moves with its text on the proposal's line, not on a
/// line of its own under a bare `- `.
#[test]
fn a_note_whose_marks_end_its_first_line_moves_as_one_line() {
    let repo = fixture_repo();
    let inbox = repo.read(INBOX);
    repo.write(
        INBOX,
        &format!("{inbox}- [agent] [run-ui]\n  The cards jump when a run starts\n"),
    );
    let place = main_place(&repo);

    to_proposal(&place, "The cards jump when a run starts", Section::Now);

    assert!(repo.read(PRIORITIES).contains(
        "- [Plan review](/specs/2026-10-13-plan-review/proposal.md)\n\
         - The cards jump when a run starts\n\n## Next"
    ));
}
