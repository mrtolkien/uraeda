//! A session's life beyond a turn: a run a usage limit stopped, which waits for the reset and
//! goes on by itself; a chat that becomes a change; and the human's edits of a session.

use std::time::Duration;

use serde_json::{Value, json};

use super::{REPO, lines, script, stage};
use crate::support::read;

// The run lifecycle decision: a run a session's usage limit failed does not ask. It waits,
// reads "Waiting" with the time it goes on, a minute after the reset, and then continues by
// itself, in a turn that says why, counted toward the cap.
#[tokio::test]
async fn a_run_a_usage_limit_stopped_waits_for_its_reset_then_continues() {
    let stage = stage().await;
    let chat = stage.chat().await;
    // The limit resets a minute after the tests' start.
    let limited = json!([
        { "type": "limit", "limit": { "kind": "session", "resetsAt": "2026-11-10T09:01:00Z" } },
        {
            "type": "result", "ok": false, "interrupted": false, "denials": [],
            "errors": ["You have hit your limit."],
        },
    ]);
    stage.fake.script(script(limited));
    stage
        .fake
        .script(script(json!([{ "type": "text", "text": "Done." }])));
    let turn = stage.send(&chat, "Rename the helper").await;
    let failed = stage.turn_in(&turn, "failed").await;
    assert_eq!(failed["reason"], "You have hit your limit.");

    let session = stage.status(&chat, "working").await;
    assert_eq!(
        (&session["statusLabel"], &session["statusReason"]),
        (&json!("Waiting"), &json!("waiting"))
    );
    assert_eq!(
        session["wait"],
        json!({ "at": "2026-11-10T09:02:00Z", "reason": "limit" })
    );
    assert_eq!(stage.fake.sent().len(), 1, "nothing goes before the reset");

    // Its time comes: two minutes on the server's clock, from when it was decided.
    tokio::time::pause();
    tokio::time::advance(Duration::from_secs(121)).await;
    tokio::time::resume();
    let mut held = stage.held("Session", &chat).await;
    let continued = held
        .until("the run to continue", |session| {
            session["turns"].as_array().unwrap().len() == 2 && session["status"] == "unread"
        })
        .await
        .clone();
    assert_eq!(continued["continues"], 1);
    let next = continued["turns"][1].as_str().unwrap();
    assert_eq!(
        lines(&stage.log(next).await),
        [
            "system: Continued after the usage limit's reset.",
            "workflow: The usage limit has reset. Continue where you left off.",
            "text: Done.",
        ]
    );
    stage.server.stop().await;
}

// Stop while a run waits to continue ends the wait for good: the run reads stopped, and
// nothing goes on at the reset.
#[tokio::test]
async fn stopping_a_run_that_waits_to_continue_ends_its_wait() {
    let stage = stage().await;
    let chat = stage.chat().await;
    let limited = json!([
        { "type": "limit", "limit": { "kind": "session", "resetsAt": "2026-11-10T09:01:00Z" } },
        { "type": "result", "ok": false, "interrupted": false, "denials": [], "errors": [] },
    ]);
    stage.fake.script(script(limited));
    let turn = stage.send(&chat, "Rename the helper").await;
    stage.turn_in(&turn, "failed").await;
    stage.status(&chat, "working").await;

    stage.done("session.stop", json!({ "session": chat })).await;
    let stopped = stage.status(&chat, "attention").await;
    assert_eq!(
        (&stopped["statusReason"], &stopped["wait"]),
        (&json!("stopped"), &Value::Null)
    );
    tokio::time::pause();
    tokio::time::advance(Duration::from_secs(121)).await;
    tokio::time::resume();
    tokio::time::sleep(Duration::from_millis(100)).await;
    assert_eq!(stage.read("Session", &chat).await["turns"], json!([turn]));
    stage.server.stop().await;
}

// A chat that turns out to be a change becomes it: the change starts, the session moves to
// it, and its next turn runs in the change's worktree, on the agent's same session, after the
// line that tells the agent where it works now.
#[tokio::test]
async fn a_chat_becomes_a_change_and_goes_on_in_its_worktree() {
    let stage = stage().await;
    let chat = stage.chat().await;
    stage.fake.script(script(
        json!([{ "type": "text", "text": "The README has a typo." }]),
    ));
    let first = stage.send(&chat, "Read the README").await;
    stage.turn_in(&first, "done").await;

    let text = "Fix the README's typo\n\nThe word is misspelled.";
    let moved = json!({ "session": chat, "text": text, "slug": "readme-typo" });
    let moved = stage.done("session.toChange", moved).await;
    let folder = moved["folder"]
        .as_str()
        .expect("the change's folder")
        .to_owned();
    assert!(folder.ends_with("-readme-typo"), "{folder}");

    let mut held = stage.held("Session", &chat).await;
    let session = held
        .until("its run in the change", |session| {
            session["turns"].as_array().unwrap().len() == 2
        })
        .await
        .clone();
    assert_eq!(session["folder"], folder);
    let run = session["turns"][1].as_str().unwrap();
    let running = stage.turn_in(run, "running").await;
    assert_eq!(
        (&running["kind"], &running["trigger"]),
        (&json!("workflow"), &json!("start"))
    );
    let opening = stage.log(run).await[0]["opening"]
        .as_str()
        .expect("its opening")
        .to_owned();
    let wanted = format!("This session is now the change specs/changes/{folder}/, on branch");
    assert!(opening.starts_with(&wanted), "{opening}");
    // The same agent session, in the change's worktree: the first process closed.
    let opens = stage.fake.opens();
    assert_eq!(opens.len(), 2);
    assert_eq!(
        (opens[1].resume, &opens[1].native_id),
        (true, &opens[0].native_id)
    );
    assert!(
        opens[1].cwd.ends_with(format!(".worktrees/{folder}")),
        "{:?}",
        opens[1].cwd
    );
    let feature = read(
        &stage.server,
        "Feature",
        json!({ "repo": REPO, "id": folder }),
    )
    .await;
    assert_eq!(feature["session"], chat);
    stage.server.stop().await;
}

// The human's edits of a session: its name, its effort, when they saw it, a failed run
// dismissed, and a chat put away; and the search, over titles and messages.
#[tokio::test]
async fn a_session_is_renamed_seen_dismissed_archived_and_found() {
    let stage = stage().await;
    let chat = stage.chat().await;
    assert_eq!(stage.read("Session", &chat).await["title"], "New session");
    stage.fake.script(script(
        json!([{ "type": "text", "text": "The helper is `slug`." }]),
    ));
    let turn = stage
        .send(&chat, "Where is the helper?\nIn the core.")
        .await;
    stage.turn_in(&turn, "done").await;
    // Titled by its first message's first line, and unread until the human saw it.
    let session = stage.status(&chat, "unread").await;
    assert_eq!(
        (&session["title"], &session["unseen"]),
        (&json!("Where is the helper?"), &json!(true))
    );
    stage.done("session.seen", json!({ "session": chat })).await;
    stage.status(&chat, "idle").await;

    stage
        .done(
            "session.rename",
            json!({ "session": chat, "title": "  The helper\nmore" }),
        )
        .await;
    assert_eq!(stage.read("Session", &chat).await["title"], "The helper");
    let blank = stage
        .refused("session.rename", json!({ "session": chat, "title": " " }))
        .await;
    assert_eq!(blank, "The message is empty.");

    // An effort its model takes is kept for its next turn; one it does not take is refused.
    stage
        .done(
            "session.setEffort",
            json!({ "session": chat, "effort": "high" }),
        )
        .await;
    assert_eq!(stage.read("Session", &chat).await["effort"], "high");
    let effort = json!({ "session": chat, "effort": "enormous" });
    let refused = stage.refused("session.setEffort", effort).await;
    assert_eq!(refused, "Fake Big takes no enormous effort: pick another");
    stage
        .fake
        .script(script(json!([{ "type": "text", "text": "Yes." }])));
    let next = stage.send(&chat, "Sure?").await;
    stage.turn_in(&next, "done").await;
    assert_eq!(stage.fake.efforts(), [Some("high".to_owned())]);

    // A failed run asks until it is dismissed.
    let failing = json!([{
        "type": "result", "ok": false, "interrupted": false, "denials": [],
        "errors": ["The model is overloaded."],
    }]);
    stage.fake.script(script(failing));
    let failed = stage.send(&chat, "Again").await;
    stage.turn_in(&failed, "failed").await;
    assert_eq!(
        stage.status(&chat, "attention").await["statusReason"],
        "failed"
    );
    stage
        .done("session.dismiss", json!({ "turn": failed }))
        .await;
    stage.status(&chat, "idle").await;

    // Found by its title and by its messages, whatever their case, and put away.
    for (query, found) in [("HELPER", true), ("slug", true), ("nowhere", false)] {
        let search = json!({ "repo": REPO, "query": query });
        let rows = read(&stage.server, "SessionSearch", search).await["rows"].clone();
        let ids: Vec<&Value> = rows
            .as_array()
            .unwrap()
            .iter()
            .map(|row| &row["id"])
            .collect();
        assert_eq!(ids.contains(&&json!(chat)), found, "{query}: {ids:?}");
    }
    stage
        .done(
            "session.archive",
            json!({ "session": chat, "archived": true }),
        )
        .await;
    let list = read(&stage.server, "SessionList", json!({ "repo": REPO })).await;
    assert_eq!(list["rows"][0]["archived"], true);
    stage.server.stop().await;
}

// The break it catches: a feature's session renamed, its name shown in its page's head, while
// the sessions' list, a tab, and Home kept the feature's title, so the rename seemed lost.
#[tokio::test]
async fn a_features_renamed_session_is_listed_by_its_new_name() {
    let stage = stage().await;
    stage
        .fake
        .script(script(json!([{ "type": "text", "text": "Here." }])));
    let sent = json!({ "folder": super::AGENT, "text": "Where are we?" });
    let sent = stage.done("session.send", sent).await;
    let session = sent["session"].as_str().expect("a session").to_owned();
    stage.turn_in(sent["turn"].as_str().unwrap(), "done").await;
    let title = |list: &Value| {
        let rows = list["rows"].as_array().expect("rows");
        let row = rows.iter().find(|row| row["id"] == session.as_str());
        row.expect("the session's row")["title"].clone()
    };
    let list = read(&stage.server, "SessionList", json!({ "repo": REPO })).await;
    assert_eq!(title(&list), "CLI TUIs");

    let rename = json!({ "session": session, "title": "The TUI's keys" });
    stage.done("session.rename", rename).await;

    let list = read(&stage.server, "SessionList", json!({ "repo": REPO })).await;
    assert_eq!(title(&list), "The TUI's keys");
    assert_eq!(
        stage.read("Session", &session).await["title"],
        "The TUI's keys"
    );
}
