//! A feature's and a change's life: started from a proposal file, a typed text, or a note,
//! named, given run options, made a feature, dropped, and its record's links repaired. Each on
//! what git, the files, and a later read show.

use serde_json::{Value, json};
use uraeda_protocol::ErrorCode;

use super::{
    HUMAN, Held, REPO, call, done, fixture_repo, hash_of, idle, of_item, of_repo, served, serving,
    subjects,
};

const LISTENER: &str = "specs/proposals/git-listener.md";

/// Whether a line of a section of the priorities as read links the feature of this folder.
fn links(priorities: &Value, section: &str, folder: &str) -> bool {
    let sections = priorities["sections"].as_array().expect("sections");
    let found = sections
        .iter()
        .find(|each| each["section"] == section)
        .expect("the section");
    let proposals = found["proposals"].as_array().expect("proposals");
    proposals.iter().any(|each| {
        each["text"]
            .as_str()
            .is_some_and(|text| text.contains(folder))
    })
}

#[tokio::test]
async fn starting_a_proposal_file_makes_its_feature_on_a_branch_of_its_own() {
    let (repo, server) = served().await;

    let plan = done(&server, "feature.start", json!({ "proposal": LISTENER })).await;

    let folder = plan["folder"].as_str().expect("the folder");
    assert!(folder.ends_with("-git-listener"), "{folder}");
    assert_eq!(plan["title"], "Git listener process");
    // The message of its first step, which its session's composer holds.
    let message = format!(
        "/uraeda Continue the feature specs/{folder}/ on branch {folder}: Investigate it and ask \
         me your questions, starting with skills/uraeda/references/discovery.md.\nStop when the \
         questions wait for my answers, and earlier only if you need a decision from me.\n"
    );
    assert_eq!(plan["message"], message);
    // Git holds it: its branch, with its proposal, and the start commit on the default branch.
    let proposal = format!("{folder}:specs/{folder}/proposal.md");
    assert!(
        repo.git(&["show", &proposal])
            .starts_with("# Git listener process")
    );
    assert!(!repo.exists(LISTENER));
    assert!(links(&of_repo(&server, "Priorities").await, "now", folder));
    let feature = of_item(&server, "Feature", folder).await;
    assert_eq!(
        (&feature["kind"], &feature["branch"]),
        (&json!("feature"), &json!(folder))
    );
}

#[tokio::test]
async fn a_start_the_core_refuses_writes_nothing() {
    let (repo, server) = served().await;
    let head = repo.git(&["rev-parse", "HEAD"]);

    let gone = json!({ "repo": REPO, "proposal": "specs/proposals/nothing.md" });
    let (code, _) = call(&server, "feature.start", gone)
        .await
        .expect_err("a refusal");

    assert_eq!(code, ErrorCode::Refused);
    assert_eq!(repo.git(&["rev-parse", "HEAD"]), head);
    assert!(repo.exists(LISTENER));
}

#[tokio::test]
async fn starting_a_typed_feature_writes_its_proposal_and_keeps_its_run_options() {
    let (repo, server) = served().await;

    let options = json!({ "steps": [{ "step": "build", "effort": "high" }] });
    let text = "Pair a phone\n\nFrom a code shown on the host.";
    let input =
        json!({ "text": text, "slug": "pair-a-phone", "discovery": "low", "options": options });
    let plan = done(&server, "feature.startText", input).await;

    let folder = plan["folder"].as_str().expect("the folder");
    assert!(folder.ends_with("-pair-a-phone"), "{folder}");
    let proposal = repo.git(&["show", &format!("{folder}:specs/{folder}/proposal.md")]);
    assert!(
        proposal.contains("From a code shown on the host."),
        "{proposal}"
    );
    assert!(proposal.contains("discovery: low"), "{proposal}");
    let feature = of_item(&server, "Feature", folder).await;
    assert_eq!(feature["runOptions"]["own"]["steps"][0]["effort"], "high");
}

#[tokio::test]
async fn starting_a_typed_change_makes_it_on_a_change_branch() {
    let (repo, server) = served().await;

    let text = "Fix the sidebar's width\n\nIt overflows on a phone.";
    let started = done(
        &server,
        "change.start",
        json!({ "text": text, "slug": "sidebar-width" }),
    )
    .await;

    let folder = started["folder"].as_str().expect("the folder");
    assert!(folder.ends_with("-sidebar-width"), "{folder}");
    // No run is sent until the sessions exist: its page offers the message unsent.
    assert_eq!(started["session"], Value::Null);
    let feature = of_item(&server, "Feature", folder).await;
    let branch = format!("change/{folder}");
    assert_eq!(
        (&feature["kind"], &feature["branch"]),
        (&json!("change"), &json!(branch))
    );
    let proposal = repo.git(&[
        "show",
        &format!("{branch}:specs/changes/{folder}/proposal.md"),
    ]);
    assert!(proposal.contains("It overflows on a phone."), "{proposal}");
}

#[tokio::test]
async fn starting_a_proposal_file_as_a_change_moves_it_to_the_changes() {
    let (repo, server) = served().await;

    let started = done(
        &server,
        "change.startProposal",
        json!({ "proposal": LISTENER }),
    )
    .await;

    let folder = started["folder"].as_str().expect("the folder");
    assert_eq!(of_item(&server, "Feature", folder).await["kind"], "change");
    assert!(!repo.exists(LISTENER));
}

#[tokio::test]
async fn starting_a_change_from_a_note_takes_the_note_out_of_the_inbox() {
    let (repo, server) = served().await;
    let hash = hash_of(&server, "Inbox").await;

    let started = done(
        &server,
        "change.fromNote",
        json!({ "note": "note-3", "hash": hash }),
    )
    .await;

    let folder = started["folder"].as_str().expect("the folder");
    let feature = of_item(&server, "Feature", folder).await;
    assert_eq!(
        (&feature["kind"], &feature["title"]),
        (&json!("change"), &json!("We need a home icon"))
    );
    // The note left the inbox, in a commit of the inbox alone.
    let inbox = of_repo(&server, "Inbox").await;
    assert_eq!((&inbox["count"], &inbox["changes"]), (&json!(9), &json!(0)));
    assert_eq!(
        repo.git(&["show", "--name-only", "--format=", "HEAD"])
            .trim(),
        "specs/INBOX.md"
    );
}

#[tokio::test]
async fn a_note_that_changed_since_starts_no_change() {
    let (repo, server) = served().await;
    let hash = hash_of(&server, "Inbox").await;
    let inbox = repo.read("specs/INBOX.md");
    repo.write("specs/INBOX.md", &format!("{inbox}- Written elsewhere\n"));

    let input = json!({ "repo": REPO, "note": "note-3", "hash": hash });
    let (code, _) = call(&server, "change.fromNote", input)
        .await
        .expect_err("a conflict");

    assert_eq!(code, ErrorCode::Conflict);
    assert_eq!(subjects(&repo, "main").len(), 2);
}

#[tokio::test]
async fn making_a_change_a_feature_moves_it_in_place() {
    let (_repo, server) = served().await;
    let text = "Fix the sidebar's width\n\nIt overflows on a phone.";
    let started = done(
        &server,
        "change.start",
        json!({ "text": text, "slug": "sidebar-width" }),
    )
    .await;
    let folder = started["folder"].as_str().unwrap();
    let mut held = Held::open(&server, "Feature", json!({ "repo": REPO, "id": folder })).await;

    let promoted = done(&server, "feature.promote", json!({ "folder": folder })).await;

    assert_eq!(
        (&promoted["folder"], &promoted["branch"]),
        (&json!(folder), &json!(folder))
    );
    // A client that holds the change sees it become a feature.
    let feature = held
        .until("the feature", |feature| feature["kind"] == "feature")
        .await;
    assert_eq!(feature["path"], format!("specs/{folder}"));
    assert!(links(&of_repo(&server, "Priorities").await, "now", folder));
}

#[tokio::test]
async fn dropping_a_change_takes_it_out_of_the_priorities_and_keeps_its_branch() {
    let (repo, server) = served().await;
    let text = "Fix the sidebar's width\n\nIt overflows on a phone.";
    let started = done(
        &server,
        "change.start",
        json!({ "text": text, "slug": "sidebar-width" }),
    )
    .await;
    let folder = started["folder"].as_str().unwrap();
    assert!(links(&of_repo(&server, "Priorities").await, "now", folder));

    let dropped = done(&server, "feature.drop", json!({ "folder": folder })).await;
    // The drop answers once its files are written: its commit lands behind it.
    assert_eq!(idle(&server, REPO).await, Vec::<String>::new());

    let branch = format!("change/{folder}");
    assert_eq!(
        dropped,
        json!({ "branch": branch, "worktreeLeft": null, "committed": true })
    );
    assert!(!links(&of_repo(&server, "Priorities").await, "now", folder));
    assert!(repo.git(&["branch", "--list", &branch]).contains(&branch));
    assert_eq!(repo.git(&["status", "--porcelain"]), "");
}

#[tokio::test]
async fn a_features_run_options_are_stored_and_survive_a_restart() {
    let (_repo, server) = served().await;
    let mut held = Held::open(&server, "Feature", json!({ "repo": REPO, "id": HUMAN })).await;

    let options =
        json!({ "steps": [{ "step": "build", "agent": "codex" }], "reviewDepth": "branch" });
    done(
        &server,
        "feature.setRunOptions",
        json!({ "folder": HUMAN, "options": options }),
    )
    .await;

    let set = |feature: &Value| feature["runOptions"]["own"]["reviewDepth"] == "branch";
    let feature = held.until("the options", set).await;
    assert_eq!(feature["runOptions"]["own"]["steps"][0]["agent"], "codex");
    assert_eq!(
        feature["runOptions"]["merged"]["steps"][0]["agent"],
        "codex"
    );
    drop(held);
    // They are the human's choices: a restart keeps them.
    let server = server.restart().await;
    let feature = of_item(&server, "Feature", HUMAN).await;
    assert_eq!(feature["runOptions"]["own"]["reviewDepth"], "branch");
}

#[tokio::test]
async fn run_options_the_core_refuses_are_not_stored() {
    let (_repo, server) = served().await;

    let options = json!({ "steps": [{ "step": "deploy", "agent": "codex" }] });
    let input = json!({ "repo": REPO, "folder": HUMAN, "options": options });
    let (code, _) = call(&server, "feature.setRunOptions", input)
        .await
        .expect_err("a refusal");
    let unknown =
        json!({ "repo": REPO, "folder": "2026-01-01-nothing", "options": { "steps": [] } });
    let (other, _) = call(&server, "feature.setRunOptions", unknown)
        .await
        .expect_err("a refusal");

    assert_eq!((code, other), (ErrorCode::Refused, ErrorCode::Refused));
    let feature = of_item(&server, "Feature", HUMAN).await;
    assert_eq!(feature["runOptions"]["own"]["steps"], json!([]));
}

#[tokio::test]
async fn an_items_name_is_stored_in_the_list_and_shown_on_its_feature() {
    let (_repo, server) = served().await;
    let mut held = Held::open(&server, "Feature", json!({ "repo": REPO, "id": HUMAN })).await;

    done(
        &server,
        "item.settings",
        json!({ "folder": HUMAN, "label": "The web UI" }),
    )
    .await;

    held.until("the name", |feature| feature["label"] == "The web UI")
        .await;
    let list = std::fs::read_to_string(server.data_dir().join("repositories.json")).unwrap();
    assert!(list.contains("The web UI"), "{list}");
    // No name removes it.
    done(&server, "item.settings", json!({ "folder": HUMAN })).await;
    held.until("no name", |feature| feature["label"].is_null())
        .await;
}

/// A record of the feature `title`, finished on 2026-10-31, with its required sections: `body`
/// is its "What and why".
fn record(title: &str, body: &str) -> String {
    format!(
        "---\nkind: feature\nfinished: 2026-10-31\n---\n\n# Record: {title}\n\n> [!NOTE]\n>\n> A \
         record.\n\n## What and why\n\n{body}\n## Behaviour\n\nIt works.\n\n## Design\n\nPlain.\n"
    )
}

#[tokio::test]
async fn a_done_features_moved_link_is_fixed_without_a_commit() {
    let repo = fixture_repo(REPO);
    let done_folder = "2026-10-28-inbox-again";
    let proposal = "specs/2026-10-30-proposal-start/proposal.md";
    repo.write(
        proposal,
        "# Proposal start\n\nStart a proposal from its file.\n",
    );
    let about = format!("See [the start](/{proposal}).\n");
    repo.write(
        &format!("specs/done/{done_folder}.md"),
        &record("Inbox again", &about),
    );
    repo.commit("docs: a record");
    repo.remove(proposal);
    repo.write(
        "specs/done/2026-10-30-proposal-start.md",
        &record("Proposal start", "Started.\n"),
    );
    repo.commit("docs: the start's record");
    let head = repo.git(&["rev-parse", "HEAD"]);
    let server = serving(&repo).await;
    let feature = of_item(&server, "Feature", done_folder).await;
    assert_eq!(feature["notes"][0]["fixable"], true, "{feature}");

    done(
        &server,
        "feature.fixLinks",
        json!({ "folder": done_folder }),
    )
    .await;

    let text = repo.read(&format!("specs/done/{done_folder}.md"));
    assert!(
        text.contains("[the start](/specs/done/2026-10-30-proposal-start.md)"),
        "{text}"
    );
    assert_eq!(repo.git(&["rev-parse", "HEAD"]), head);
    assert_eq!(
        of_item(&server, "Feature", done_folder).await["notes"],
        json!([])
    );
}
