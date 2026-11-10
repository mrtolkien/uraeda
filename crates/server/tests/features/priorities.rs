//! The priorities' actions: each writes `PRIORITIES.md` on the default branch, and a later read
//! of the record, the file, and git shows it.

use serde_json::{Value, json};

use super::{done, hash_of, of_item, of_repo, served, subjects};

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

const RUNNER: &str = "Claude Code runner (triggered manually)";

#[tokio::test]
async fn adding_a_proposal_writes_the_priorities_and_answers_its_undo() {
    let (repo, server) = served().await;
    let hash = hash_of(&server, "Priorities").await;

    let input = json!({ "section": "next", "text": "Pair a phone", "hash": hash });
    let written = done(&server, "proposals.add", input).await;

    assert!(
        repo.read("specs/PRIORITIES.md")
            .contains("- Pair a phone\n")
    );
    let priorities = of_repo(&server, "Priorities").await;
    assert_eq!(
        proposals(&priorities, "next").last().map(String::as_str),
        Some("Pair a phone")
    );
    assert_eq!(priorities["changes"], 1);
    assert_eq!(written["hash"], priorities["hash"]);
    assert_eq!(written["change"]["files"][0]["path"], "specs/PRIORITIES.md");
}

#[tokio::test]
async fn a_proposal_is_edited_moved_and_removed() {
    let (repo, server) = served().await;

    let hash = hash_of(&server, "Priorities").await;
    let edited = json!({ "proposal": "next-1", "text": "Claude Code runner", "hash": hash });
    let written = done(&server, "proposals.edit", edited).await;
    assert!(
        repo.read("specs/PRIORITIES.md")
            .contains("- Claude Code runner\n")
    );

    let moved =
        json!({ "proposal": "next-1", "section": "later", "index": 0, "hash": written["hash"] });
    let written = done(&server, "proposals.move", moved).await;
    let priorities = of_repo(&server, "Priorities").await;
    assert_eq!(proposals(&priorities, "later")[0], "Claude Code runner");
    assert_eq!(proposals(&priorities, "next").len(), 1);

    let removed = json!({ "proposal": "later-1", "hash": written["hash"] });
    done(&server, "proposals.remove", removed).await;
    assert!(
        !repo
            .read("specs/PRIORITIES.md")
            .contains("Claude Code runner")
    );
}

#[tokio::test]
async fn a_proposals_outline_is_edited_and_dropped() {
    let (repo, server) = served().await;

    let hash = hash_of(&server, "Priorities").await;
    let child = json!({ "proposal": "next-1", "kind": "append-child", "text": "by hand first", "hash": hash });
    let written = done(&server, "proposals.outline", child).await;
    let text = repo.read("specs/PRIORITIES.md");
    assert!(
        text.contains(&format!("- {RUNNER}\n  - by hand first\n")),
        "{text}"
    );

    // Dropped under the first line of Later, its nested line with it.
    let dropped =
        json!({ "proposal": "next-1", "index": 0, "under": "later-1", "hash": written["hash"] });
    done(&server, "proposals.drop", dropped).await;
    let text = repo.read("specs/PRIORITIES.md");
    let nested =
        format!("- Nix + Docker based execution environments\n  - {RUNNER}\n    - by hand first\n");
    assert!(text.contains(&nested), "{text}");
}

#[tokio::test]
async fn expanding_a_proposal_writes_its_file_and_links_it() {
    let (repo, server) = served().await;
    let hash = hash_of(&server, "Priorities").await;

    let written = done(
        &server,
        "proposals.expand",
        json!({ "proposal": "next-1", "hash": hash }),
    )
    .await;

    let path = written["path"].as_str().expect("the file's path");
    let text = repo.read(path);
    assert!(text.contains(&format!("\n# {RUNNER}\n")), "{text}");
    assert_eq!(
        of_item(&server, "ProposalFile", path).await["proposal"]["id"],
        "next-1"
    );
    let paths: Vec<_> = written["change"]["files"]
        .as_array()
        .unwrap()
        .iter()
        .map(|file| file["path"].clone())
        .collect();
    assert!(
        paths.contains(&json!("specs/PRIORITIES.md")) && paths.contains(&json!(path)),
        "{paths:?}"
    );
}

#[tokio::test]
async fn committing_the_priorities_commits_them_alone() {
    let (repo, server) = served().await;
    let hash = hash_of(&server, "Priorities").await;
    done(
        &server,
        "proposals.add",
        json!({ "section": "next", "text": "Pair a phone", "hash": hash }),
    )
    .await;
    repo.write("notes.txt", "left alone\n");

    let written = done(&server, "priorities.commit", json!({})).await;

    let committed = repo.git(&["show", "--name-only", "--format=", "HEAD"]);
    assert_eq!(committed.trim(), "specs/PRIORITIES.md");
    assert_eq!(subjects(&repo, "main").len(), 3);
    let priorities = of_repo(&server, "Priorities").await;
    assert_eq!(
        (&priorities["changes"], &written["hash"]),
        (&json!(0), &priorities["hash"])
    );
    assert_eq!(written["change"], Value::Null);
}

#[tokio::test]
async fn discarding_the_priorities_restores_the_committed_file() {
    let (repo, server) = served().await;
    let before = repo.read("specs/PRIORITIES.md");
    let hash = hash_of(&server, "Priorities").await;
    done(
        &server,
        "proposals.add",
        json!({ "section": "next", "text": "Pair a phone", "hash": hash }),
    )
    .await;

    let written = done(&server, "priorities.discard", json!({})).await;

    assert_eq!(repo.read("specs/PRIORITIES.md"), before);
    assert_eq!(written["hash"], hash);
}
