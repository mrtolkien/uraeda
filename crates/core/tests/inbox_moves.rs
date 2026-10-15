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

/// Adds a note with an image, as the add form does: a draft folder linked from the inbox, over the
/// inbox as it is. Returns the draft's path.
fn add_with_image(repo: &TestRepo, category: Option<&str>, text: &str) -> String {
    let inbox = api::read_inbox(repo.path()).unwrap();
    let image = std::fs::read(common::fixture("images/phone.png")).unwrap();
    let (_, draft) = api::add_note_with_image(
        repo.path(),
        category.map(String::from),
        None,
        text,
        &image,
        Some("phone.png"),
        &inbox.hash,
    )
    .unwrap();
    draft
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
    let typed = add_with_image(&repo, None, "Dark mode");
    let untouched = add_with_image(&repo, None, "Light mode");
    let text = repo
        .read(&typed)
        .replace("## Why\n", "## Why\n\nMy eyes.\n");
    repo.write(&typed, &text);

    changes::discard(&place).unwrap();

    assert_eq!(repo.read(&typed), text);
    assert!(!repo.exists(&untouched));
    assert!(!repo.exists("specs/drafts/light-mode"));
    assert_eq!(repo.read(INBOX), fixture_text("repo/main/specs/INBOX.md"));
}

/// A first `INBOX.md`, never committed, goes into the commit of the draft its note made.
#[test]
fn a_first_inbox_is_committed_with_its_draft() {
    let repo = TestRepo::new();
    repo.write("specs/README.md", "# Specs\n");
    repo.commit("chore: specs");
    let path = add_with_image(&repo, None, "Dark mode");

    api::commit_text(repo.path(), &path).unwrap();

    assert_eq!(
        repo.changed_in("main"),
        [
            INBOX,
            "specs/drafts/dark-mode/images/phone.webp",
            path.as_str()
        ]
    );
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

    let added = add_with_image(&repo, Some("UI"), text);
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

/// A note added since the last commit, then made a draft, leaves no trace in the inbox: the commit
/// still holds the draft its new entry links, and Discard deletes the draft while untouched.
#[test]
fn a_new_note_made_a_draft_is_committed_and_discarded_with_its_draft() {
    let made = |repo: &TestRepo| {
        let place = main_place(repo);
        actions::add(&place, None, &Marks::default(), "Dark mode", None).unwrap();
        let inbox = actions::read(&place);
        let priorities = uraeda_core::actions::priorities::read(&place);
        let note = id(&inbox, "Dark mode");
        let path =
            actions::to_new_draft(&place, &note, Section::Later, &inbox.hash, &priorities.hash)
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

/// A new draft the priorities link, typed in, is kept by Discard, and committed with them.
#[test]
fn a_typed_draft_a_new_entry_links_is_kept_and_committed() {
    let repo = fixture_repo();
    let place = main_place(&repo);
    let hash = uraeda_core::actions::priorities::read(&place).hash;
    uraeda_core::actions::priorities::add(&place, Section::Later, "Dark mode", &hash).unwrap();
    let drafted = draft::run(&place, "Dark mode").unwrap();
    let linked = repo.read(PRIORITIES);
    let typed = format!("{}\nMy eyes.\n", repo.read(&drafted.path));
    repo.write(&drafted.path, &typed);

    changes::discard(&place).unwrap();
    assert_eq!(repo.read(&drafted.path), typed);

    repo.write(PRIORITIES, &linked);
    changes::commit(&place).unwrap();
    assert_eq!(repo.changed_in("main"), [PRIORITIES, drafted.path.as_str()]);
    assert_eq!(repo.porcelain(), "");
}

/// A note added since the last commit, then added to a committed draft, leaves the same files as
/// a bullet typed in the draft: the commit bar counts neither, and Discard keeps the note's text.
#[test]
fn a_new_note_added_to_a_draft_stays_in_the_draft() {
    let repo = fixture_repo();
    let place = main_place(&repo);
    actions::add(&place, None, &Marks::default(), "Dark mode", None).unwrap();
    let inbox = actions::read(&place);
    actions::to_draft(&place, &id(&inbox, "Dark mode"), LOOK, &inbox.hash).unwrap();
    let grown = repo.read(LOOK);

    assert_eq!(changes::list(&place).count, 0);
    changes::discard(&place).unwrap();

    assert_eq!(repo.read(LOOK), grown);
    assert!(grown.contains("- Dark mode\n"));
}

/// A draft's commit from its editor holds the inbox, and so every draft no commit has that it
/// links: two notes added with images are committed together, no link left without its file.
#[test]
fn a_drafts_commit_holds_the_other_drafts_its_lists_link() {
    let repo = fixture_repo();
    let dark = add_with_image(&repo, None, "Dark mode");
    let light = add_with_image(&repo, None, "Light mode");

    api::commit_text(repo.path(), &dark).unwrap();

    assert_eq!(
        repo.changed_in("main"),
        [
            INBOX,
            "specs/drafts/dark-mode/images/phone.webp",
            dark.as_str(),
            "specs/drafts/light-mode/images/phone.webp",
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
    assert_eq!(
        repo.porcelain(),
        " M specs/INBOX.md\n?? specs/drafts/dark-mode/\n"
    );
    repo.git(&["add", "--all", "--", "specs"]);

    changes::discard(&place).unwrap();

    assert!(!repo.exists(&path));
    assert_eq!(repo.porcelain(), "");
    repo.set_hook("exit 0");
    actions::add(&place, None, &Marks::default(), "Light mode", None).unwrap();
    changes::commit(&place).unwrap();
    assert_eq!(repo.changed_in("main"), [INBOX]);
}

/// A note's relative links, written from `specs/`, point at the same files from the draft it goes
/// into: rebased, its rooted links, URLs, and anchors kept.
const LINKED: &str = "See [readme](../README.md), ![shot](images/a.png), [top](/README.md), \
                      [web](https://example.com), and [here](#why)";

fn linked_from(folder: &str) -> String {
    format!(
        "See [readme]({folder}../README.md), ![shot]({folder}images/a.png), [top](/README.md), \
         [web](https://example.com), and [here](#why)"
    )
}

/// A note with relative links, nested lines included, made a draft.
#[test]
fn a_notes_relative_links_are_rebased_into_a_new_draft() {
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
        actions::to_new_draft(&place, &id, Section::Later, &inbox.hash, &priorities.hash).unwrap();

    let draft = repo.read(&path);
    let rebased = linked_from("../");
    assert!(
        draft.contains(&format!(
            "# {rebased}\n\n## What\n\n{rebased}\n\n- [spec](../2026-10-06-x/spec.md)\n"
        )),
        "{draft}"
    );
}

/// A note added to a folder draft gets its links rebased two folders down, and its Undo takes it
/// back out.
#[test]
fn a_notes_relative_links_are_rebased_into_a_folder_draft() {
    let repo = fixture_repo();
    let folder = "specs/drafts/look/proposal.md";
    repo.write(folder, LOOK_TEXT);
    repo.commit("chore: a folder draft");
    let place = main_place(&repo);
    actions::add(&place, None, &Marks::default(), LINKED, None).unwrap();
    let inbox = api::read_inbox(repo.path()).unwrap();
    let note = inbox.categories[0].notes.last().unwrap().clone();
    let index = u32::try_from(inbox.categories[0].notes.len() - 1).unwrap();

    actions::to_draft(&place, &note.id, folder, &inbox.hash).unwrap();

    let rebased = linked_from("../../");
    assert!(
        repo.read(folder).contains(&format!("- {rebased}\n")),
        "{}",
        repo.read(folder)
    );
    api::undo_note_to_draft(repo.path(), folder, &note.lines, None, index).unwrap();
    assert_eq!(repo.read(folder), LOOK_TEXT);
}

/// A note with links added with an image: its draft folder's title and What link the same files,
/// and Discard still deletes it untouched.
#[test]
fn a_note_with_links_added_with_an_image_links_the_same_files() {
    let repo = fixture_repo();
    let place = main_place(&repo);

    let path = add_with_image(&repo, None, "Like [readme](../README.md)");

    let draft = repo.read(&path);
    assert!(
        draft.contains("\n# Like [readme](../../../README.md)\n\n## What\n\nLike [readme](../../../README.md)\n"),
        "{draft}"
    );
    changes::discard(&place).unwrap();
    assert!(!repo.exists(&path));
    assert_eq!(repo.porcelain(), "");
}
