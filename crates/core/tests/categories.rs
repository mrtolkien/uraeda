//! The edits of an inbox's categories: the text edits, the checked ones, and the Undo of a delete,
//! which gives the file back byte for byte.

mod common;

use common::repo::TestRepo;
use uraeda_core::api;
use uraeda_core::files::inbox::categories::{add_category, remove_category, rename_category};

const TEXT: &str = "# Inbox\n\n- loose\n\n## UI\n\n- a\n- b\n- c\n\n## Prompts\n\n- p\n";
const INBOX: &str = "specs/INBOX.md";

fn repo_with(text: &str) -> TestRepo {
    let repo = TestRepo::new();
    repo.write("specs/README.md", "# Specs\n");
    repo.write(INBOX, text);
    repo.commit("chore: specs");
    repo
}

#[test]
fn deleting_a_category_with_no_keeps_its_notes_after_the_loose_ones() {
    let edited = remove_category(TEXT, "UI", true);
    assert_eq!(
        edited,
        "# Inbox\n\n- loose\n- a\n- b\n- c\n\n## Prompts\n\n- p\n"
    );
}

#[test]
fn deleting_a_category_with_yes_removes_its_notes() {
    assert_eq!(
        remove_category(TEXT, "UI", false),
        "# Inbox\n\n- loose\n\n## Prompts\n\n- p\n"
    );
}

#[test]
fn deleting_the_first_category_keeps_its_notes_under_no_category() {
    let text = "# Inbox\n\n## UI\n\n- a\n\n## Prompts\n\n- p\n";
    assert_eq!(
        remove_category(text, "UI", true),
        "# Inbox\n\n- a\n\n## Prompts\n\n- p\n"
    );
}

#[test]
fn deleting_the_last_category_keeps_the_final_newline() {
    assert_eq!(
        remove_category(TEXT, "Prompts", false),
        "# Inbox\n\n- loose\n\n## UI\n\n- a\n- b\n- c\n"
    );
    assert_eq!(
        remove_category(TEXT, "Prompts", true),
        "# Inbox\n\n- loose\n- p\n\n## UI\n\n- a\n- b\n- c\n"
    );
}

#[test]
fn deleting_acts_on_every_heading_of_the_name_in_file_order() {
    let text = "# Inbox\n\n- loose\n\n## UI\n\n- a\n\n## Prompts\n\n- p\n\n## UI\n\n- z\n";
    assert_eq!(
        remove_category(text, "UI", true),
        "# Inbox\n\n- loose\n- a\n- z\n\n## Prompts\n\n- p\n"
    );
    assert_eq!(
        remove_category(text, "UI", false),
        "# Inbox\n\n- loose\n\n## Prompts\n\n- p\n"
    );
}

#[test]
fn a_delete_keeps_crlf_line_endings() {
    let text = TEXT.replace('\n', "\r\n");
    assert_eq!(
        remove_category(&text, "UI", true),
        "# Inbox\n\n- loose\n- a\n- b\n- c\n\n## Prompts\n\n- p\n".replace('\n', "\r\n")
    );
    assert_eq!(
        add_category(&text, "Ideas"),
        format!("{text}\r\n## Ideas\r\n")
    );
}

#[test]
fn adding_a_category_ends_the_file_with_its_heading() {
    assert_eq!(
        add_category(TEXT, "Ideas"),
        "# Inbox\n\n- loose\n\n## UI\n\n- a\n- b\n- c\n\n## Prompts\n\n- p\n\n## Ideas\n"
    );
    assert_eq!(add_category("", "Ideas"), "# Inbox\n\n## Ideas\n");
}

#[test]
fn renaming_keeps_the_notes_and_the_other_headings() {
    assert_eq!(
        rename_category(TEXT, "UI", "Interface"),
        TEXT.replace("## UI", "## Interface")
    );
    let two = "# Inbox\n\n## UI\n\n- a\n\n## UI\n\n- z\n";
    assert_eq!(
        rename_category(two, "UI", "X"),
        "# Inbox\n\n## X\n\n- a\n\n## X\n\n- z\n"
    );
}

/// Deletes `name` over `text` through the API and restores it: the file is the input again, and
/// the delete's answer is the file as it was.
fn assert_round_trip(text: &str, name: &str, keep_notes: bool) {
    let repo = repo_with(text);
    let hash = api::read_inbox(repo.path()).unwrap().hash;
    let (inbox, before) = api::remove_category(repo.path(), name, keep_notes, &hash).unwrap();
    assert_eq!(before, text);
    assert_ne!(repo.read(INBOX), text, "{name} {keep_notes}");
    api::restore_category(repo.path(), &before, &inbox.hash).unwrap();
    assert_eq!(repo.read(INBOX), text, "{name} {keep_notes}");
}

#[test]
fn delete_then_restore_gives_the_file_back_byte_for_byte() {
    let two = "# Inbox\n\n- loose\n\n## UI\n\n- a\n\n## Prompts\n\n- p\n\n## UI\n\n- z\n";
    let no_newline = TEXT.trim_end_matches('\n');
    let crlf = TEXT.replace('\n', "\r\n");
    let before_title = "- first\n\n# Inbox\n\n## UI\n\n- a\n";
    let cases = [
        (TEXT, "UI"),
        (TEXT, "Prompts"),
        (two, "UI"),
        (no_newline, "Prompts"),
        (no_newline, "UI"),
        (crlf.as_str(), "UI"),
        (crlf.as_str(), "Prompts"),
        (before_title, "UI"),
        ("# Inbox\n\n## UI\n\n- a\n\n## Prompts\n\n- p\n", "UI"),
    ];
    for (text, name) in cases {
        for keep_notes in [true, false] {
            assert_round_trip(text, name, keep_notes);
        }
    }
}

#[test]
fn a_restore_over_a_changed_file_is_refused_and_writes_nothing() {
    let repo = repo_with(TEXT);
    let hash = api::read_inbox(repo.path()).unwrap().hash;
    let (inbox, before) = api::remove_category(repo.path(), "UI", true, &hash).unwrap();
    let later = format!("{}- typed\n", repo.read(INBOX));
    repo.write(INBOX, &later);

    assert!(api::restore_category(repo.path(), &before, &inbox.hash).is_err());
    assert_eq!(repo.read(INBOX), later);
}

fn refusal(result: Result<impl Sized, uraeda_core::api::ApiError>) -> String {
    result.err().expect("a refusal").to_string()
}

#[test]
fn a_name_is_refused_when_empty_taken_missing_or_not_a_heading() {
    let repo = repo_with(TEXT);
    let hash = api::read_inbox(repo.path()).unwrap().hash;
    let p = repo.path();
    assert_eq!(
        refusal(api::add_category(p, "   ", &hash)),
        "A category needs a name."
    );
    assert_eq!(
        refusal(api::add_category(p, " Prompts ", &hash)),
        "A category named Prompts exists."
    );
    assert_eq!(
        refusal(api::rename_category(p, "UI", "Prompts", &hash)),
        "A category named Prompts exists."
    );
    assert_eq!(
        refusal(api::add_category(p, "Ideas #", &hash)),
        "Ideas # cannot be written as a heading."
    );
    assert_eq!(
        refusal(api::rename_category(p, "UI", "a\nb", &hash)),
        "a\nb cannot be written as a heading."
    );
    assert_eq!(
        refusal(api::rename_category(p, "Nope", "X", &hash)),
        "No category named Nope."
    );
    assert_eq!(
        refusal(api::remove_category(p, "Nope", true, &hash)),
        "No category named Nope."
    );
    // Names compare exactly, so a different case is another category.
    api::add_category(p, "prompts", &hash).unwrap();
    assert_eq!(repo.read(INBOX), format!("{TEXT}\n## prompts\n"));
}
