//! The inbox's actions: each writes `INBOX.md` on the default branch, or moves a note into the
//! priorities or a proposal file, and a later read of the lists and the files shows it.

use serde_json::{Value, json};
use uraeda_protocol::ErrorCode;

use super::{HUMAN, Held, REPO, call, done, hash_of, of_item, of_repo, served};

/// The notes of a category of the inbox as read, by its name, as their texts.
fn notes(inbox: &Value, category: Option<&str>) -> Vec<String> {
    let categories = inbox["categories"].as_array().expect("categories");
    let named = |each: &&Value| each["name"].as_str() == category;
    let Some(found) = categories.iter().find(named) else {
        return Vec::new();
    };
    let notes = found["notes"].as_array().expect("notes");
    notes
        .iter()
        .map(|note| note["text"].as_str().unwrap().to_owned())
        .collect()
}

/// The texts of the proposals of a section of the priorities as read.
fn proposals(priorities: &Value, section: &str) -> Vec<String> {
    let sections = priorities["sections"].as_array().expect("sections");
    let found = sections
        .iter()
        .find(|each| each["section"] == section)
        .expect("the section");
    let proposals = found["proposals"].as_array().expect("proposals");
    proposals
        .iter()
        .map(|each| each["text"].as_str().unwrap().to_owned())
        .collect()
}

#[tokio::test]
async fn adding_a_note_writes_the_inbox_and_answers_its_undo() {
    let (repo, server) = served().await;
    let hash = hash_of(&server, "Inbox").await;

    let input = json!({ "text": "Dark mode", "category": "UI", "about": HUMAN, "hash": hash });
    let written = done(&server, "inbox.add", input).await;

    let text = repo.read("specs/INBOX.md");
    assert!(text.contains("- [web-ui] Dark mode\n"), "{text}");
    let inbox = of_repo(&server, "Inbox").await;
    assert_eq!(
        notes(&inbox, Some("UI")).last().map(String::as_str),
        Some("Dark mode")
    );
    assert_eq!(
        (&inbox["count"], &inbox["changes"]),
        (&json!(11), &json!(1))
    );
    // The answer carries the hash to write over next, and the change an undo writes back.
    assert_eq!(written["hash"], inbox["hash"]);
    assert_eq!(written["change"]["files"][0]["path"], "specs/INBOX.md");
}

#[tokio::test]
async fn a_write_over_a_list_that_changed_since_is_a_conflict() {
    let (repo, server) = served().await;
    let hash = hash_of(&server, "Inbox").await;
    let before = repo.read("specs/INBOX.md");
    repo.write("specs/INBOX.md", &format!("{before}- Written elsewhere\n"));

    let input = json!({ "repo": REPO, "text": "Dark mode", "hash": hash });
    let (code, _) = call(&server, "inbox.add", input)
        .await
        .expect_err("a conflict");

    assert_eq!(code, ErrorCode::Conflict);
    assert_eq!(
        repo.read("specs/INBOX.md"),
        format!("{before}- Written elsewhere\n")
    );
}

#[tokio::test]
async fn a_subscriber_of_the_inbox_sees_a_note_another_client_adds() {
    let (_repo, server) = served().await;
    let mut held = Held::open(&server, "Inbox", json!({ "repo": REPO })).await;
    let hash = held.value["hash"].as_str().unwrap().to_owned();

    done(
        &server,
        "inbox.add",
        json!({ "text": "Dark mode", "hash": hash }),
    )
    .await;

    let inbox = held.until("the note", |inbox| inbox["count"] == 11).await;
    assert_eq!(
        notes(inbox, None).last().map(String::as_str),
        Some("Dark mode")
    );
}

#[tokio::test]
async fn editing_a_note_writes_its_text() {
    let (repo, server) = served().await;
    let hash = hash_of(&server, "Inbox").await;

    let input = json!({ "note": "note-3", "text": "We need a house icon", "hash": hash });
    let written = done(&server, "inbox.edit", input).await;

    assert!(
        repo.read("specs/INBOX.md")
            .contains("- We need a house icon\n")
    );
    assert_eq!(written["change"], Value::Null);
    assert_eq!(written["hash"], hash_of(&server, "Inbox").await);
}

#[tokio::test]
async fn a_notes_outline_is_edited() {
    let (repo, server) = served().await;
    let hash = hash_of(&server, "Inbox").await;

    let input =
        json!({ "note": "note-3", "kind": "append-child", "text": "in the sidebar", "hash": hash });
    done(&server, "inbox.outline", input).await;

    let text = repo.read("specs/INBOX.md");
    assert!(
        text.contains("- We need a home icon\n  - in the sidebar\n"),
        "{text}"
    );
}

#[tokio::test]
async fn a_note_moves_between_categories_and_places() {
    let (_repo, server) = served().await;

    let hash = hash_of(&server, "Inbox").await;
    let moved = json!({ "note": "note-1", "category": "CLI", "hash": hash });
    let written = done(&server, "inbox.category", moved).await;
    let inbox = of_repo(&server, "Inbox").await;
    let long = "Specs are still way too long and hard to read";
    assert_eq!(
        notes(&inbox, Some("CLI")).last().map(String::as_str),
        Some(long)
    );

    // Placed first among the notes without a category, over the hash the move answered.
    let note = last_id(&inbox, "CLI");
    let placed = json!({ "note": note, "index": 0, "hash": written["hash"] });
    let written = done(&server, "inbox.place", placed).await;
    let inbox = of_repo(&server, "Inbox").await;
    assert_eq!(notes(&inbox, None)[0], long);

    // Dropped under the next note, as a nested line.
    let dropped =
        json!({ "note": "note-1", "index": 0, "under": "note-2", "hash": written["hash"] });
    done(&server, "inbox.drop", dropped).await;
    let inbox = of_repo(&server, "Inbox").await;
    assert_eq!(
        inbox["categories"][0]["notes"][0]["nested"],
        json!([format!("  - {long}")])
    );
}

/// The id of the last note of a category of the inbox as read.
fn last_id(inbox: &Value, category: &str) -> String {
    let categories = inbox["categories"].as_array().unwrap();
    let found = categories
        .iter()
        .find(|each| each["name"] == category)
        .unwrap();
    let last = found["notes"].as_array().unwrap().last().unwrap();
    last["id"].as_str().unwrap().to_owned()
}

#[tokio::test]
async fn removing_a_note_writes_the_inbox() {
    let (repo, server) = served().await;
    let hash = hash_of(&server, "Inbox").await;

    let written = done(
        &server,
        "inbox.remove",
        json!({ "note": "note-3", "hash": hash }),
    )
    .await;

    assert!(!repo.read("specs/INBOX.md").contains("We need a home icon"));
    assert_eq!(of_repo(&server, "Inbox").await["count"], 9);
    assert!(
        written["change"]["files"]
            .as_array()
            .is_some_and(|files| !files.is_empty())
    );
}

#[tokio::test]
async fn the_categories_are_added_renamed_and_removed() {
    let (repo, server) = served().await;

    let hash = hash_of(&server, "Inbox").await;
    let written = done(
        &server,
        "inbox.addCategory",
        json!({ "name": "Docs", "hash": hash }),
    )
    .await;
    assert!(repo.read("specs/INBOX.md").ends_with("## Docs\n"));

    let renamed = json!({ "from": "Docs", "to": "Guides", "hash": written["hash"] });
    let written = done(&server, "inbox.renameCategory", renamed).await;
    assert_eq!(
        of_repo(&server, "Inbox").await["names"],
        json!(["UI", "CLI", "Guides"])
    );

    let removed = json!({ "name": "CLI", "keepNotes": true, "hash": written["hash"] });
    done(&server, "inbox.removeCategory", removed).await;
    let inbox = of_repo(&server, "Inbox").await;
    assert_eq!(inbox["names"], json!(["UI", "Guides"]));
    // Its notes stay, without a category.
    assert_eq!(
        (notes(&inbox, None).len(), &inbox["count"]),
        (5, &json!(10))
    );
}

#[tokio::test]
async fn a_note_moves_to_the_priorities_as_a_line_and_under_a_line() {
    let (repo, server) = served().await;

    let (inbox, priorities) = (
        hash_of(&server, "Inbox").await,
        hash_of(&server, "Priorities").await,
    );
    let input =
        json!({ "note": "note-3", "section": "next", "hash": inbox, "prioritiesHash": priorities });
    let moved = done(&server, "inbox.toProposal", input).await;
    let read = of_repo(&server, "Priorities").await;
    assert_eq!(
        proposals(&read, "next").last().map(String::as_str),
        Some("We need a home icon")
    );
    assert!(!repo.read("specs/INBOX.md").contains("We need a home icon"));
    // One change holds both lists, so one undo writes both back.
    let files: Vec<_> = moved["change"]["files"]
        .as_array()
        .unwrap()
        .iter()
        .map(|file| &file["path"])
        .collect();
    assert_eq!(files, ["specs/INBOX.md", "specs/PRIORITIES.md"]);

    let (inbox, priorities) = (
        hash_of(&server, "Inbox").await,
        hash_of(&server, "Priorities").await,
    );
    let input = json!({ "note": "note-1", "proposal": "next-1", "hash": inbox, "prioritiesHash": priorities });
    done(&server, "inbox.underProposal", input).await;
    let text = repo.read("specs/PRIORITIES.md");
    let nested = "- Claude Code runner (triggered manually)\n  - Specs are still way too long and hard to read\n";
    assert!(text.contains(nested), "{text}");
}

#[tokio::test]
async fn a_note_moves_to_the_priorities_as_a_proposal_file() {
    let (repo, server) = served().await;
    let (inbox, priorities) = (
        hash_of(&server, "Inbox").await,
        hash_of(&server, "Priorities").await,
    );

    let input = json!({ "note": "note-3", "section": "later", "hash": inbox, "prioritiesHash": priorities });
    let written = done(&server, "inbox.toProposalFile", input).await;

    let path = written["path"].as_str().expect("the file's path");
    assert!(path.starts_with("specs/proposals/"), "{path}");
    let text = repo.read(path);
    assert!(text.contains("\n# We need a home icon\n"), "{text}");
    // The answer's path opens the file's page.
    let file = of_item(&server, "ProposalFile", path).await;
    assert_eq!(file["proposal"]["section"], "later");
    assert!(
        written["change"]["files"]
            .as_array()
            .is_some_and(|files| files.len() >= 3)
    );
}

#[tokio::test]
async fn a_note_moves_into_a_proposal_file() {
    let (repo, server) = served().await;
    let hash = hash_of(&server, "Inbox").await;

    let file = "specs/proposals/git-listener.md";
    let input = json!({ "note": "note-3", "file": file, "hash": hash });
    let written = done(&server, "inbox.intoProposal", input).await;

    assert_eq!(written["path"], file);
    assert!(repo.read(file).contains("We need a home icon"));
    assert_eq!(of_repo(&server, "Inbox").await["count"], 9);
}

#[tokio::test]
async fn a_note_file_moves_into_a_line_of_the_priorities_and_loses_an_image() {
    let (repo, server) = served().await;
    // A note with a note file, which links an image.
    repo.write(
        "specs/notes/home-icon/note.md",
        "# Home icon\n\nA house.\n\n![icon](images/icon.png)\n",
    );
    repo.write("specs/notes/home-icon/images/icon.png", "not read here");
    let inbox = repo.read("specs/INBOX.md").replace(
        "- We need a home icon\n",
        "- [Home icon](notes/home-icon/note.md)\n",
    );
    repo.write("specs/INBOX.md", &inbox);
    repo.commit("chore: a note file");

    // Its image is taken out of the note file, over the file's hash.
    let note = "specs/notes/home-icon/note.md";
    let hash = of_item(&server, "ProposalFile", note).await["hash"].clone();
    let image = "specs/notes/home-icon/images/icon.png";
    let removed = json!({ "file": note, "image": image, "hash": hash });
    let written = done(&server, "inbox.removeImage", removed).await;
    assert!(!repo.read(note).contains("icon.png"));
    // The image is kept with the change, since the next commit deletes it unlinked.
    let kept = written["change"]["files"]
        .as_array()
        .unwrap()
        .iter()
        .any(|file| file["path"] == image);
    assert!(kept, "{written}");

    // The note file goes into a line of the priorities that has no file yet.
    let priorities = hash_of(&server, "Priorities").await;
    let input = json!({ "note": "note-3", "proposal": "next-1", "hash": written["hash"], "prioritiesHash": priorities });
    let written = done(&server, "inbox.intoProposalLine", input).await;
    let path = written["path"].as_str().expect("the file's path");
    assert!(repo.read(path).contains("A house."), "{path}");
    assert!(repo.read("specs/PRIORITIES.md").contains("](proposals/"));
    assert_eq!(of_repo(&server, "Inbox").await["count"], 9);
}
