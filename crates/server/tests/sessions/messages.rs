//! A message's way in and out: steered into a running turn, queued behind it, taken back
//! before the agent read it, and a blocked action allowed and tried again.

use serde_json::{Value, json};
use uraeda_server::runtimes::When;

use super::{REPO, Stage, done, event, lines, script, stage};
use crate::support::Held;

/// The page of a turn's transcript, held by a client of its own.
async fn page(stage: &Stage, turn: &str) -> Held {
    let args = json!({ "repo": REPO, "turn": turn, "page": 0 });
    Held::open(&stage.server, "TurnLog", args).await
}

/// The own id of a turn's message of this text, which a take-back names.
fn message_of(items: &[Value], text: &str) -> String {
    let found = items.iter().find(|item| item["text"] == text);
    let message = found.unwrap_or_else(|| panic!("no message `{text}` in {items:?}"));
    message["message"]
        .as_str()
        .expect("a message's id")
        .to_owned()
}

// A message sent while the agent works is never lost, and never starts a second process: the
// human's joins the running turn when the agent can steer, and waits for the next one when it
// cannot. A queued turn starts by itself, on the same process, once the running one ends.
#[tokio::test]
async fn a_message_during_a_turn_is_steered_or_queued_behind_it() {
    let stage = stage().await;
    let chat = stage.chat().await;
    let first = stage.send(&chat, "Read the README").await;
    stage.turn_in(&first, "running").await;

    // Steered: the same turn, written to the agent at once, pending until it reads it.
    assert_eq!(stage.send(&chat, "And the license").await, first);
    let sent = stage.fake.sent();
    assert_eq!((sent[0].when, sent[1].when), (When::Queue, When::Steer));
    let mut log = page(&stage, &first).await;
    assert_eq!(
        lines(log.value["items"].as_array().unwrap()),
        ["human: Read the README", "human: And the license"]
    );
    assert_eq!(log.value["items"][1]["read"], false);
    stage
        .fake
        .emit(event(json!({ "type": "accepted", "id": sent[1].id })));
    log.until("the steered message to be read", |log| {
        log["items"][1]["read"] == true
    })
    .await;
    stage.fake.emit(done());
    stage.turn_in(&first, "done").await;

    // An agent that cannot steer: the message waits in a turn of its own, which shows as
    // queued, and the session works.
    let queueing = super::staged("").await;
    queueing.fake.set(|fake| fake.capabilities.steer = false);
    let chat = queueing.chat().await;
    let running = queueing.send(&chat, "Read the README").await;
    queueing.turn_in(&running, "running").await;
    let queued = queueing.send(&chat, "And the license").await;
    assert_ne!(queued, running);
    assert_eq!(queueing.turn_in(&queued, "queued").await["kind"], "chat");
    assert_eq!(
        queueing.fake.sent().len(),
        1,
        "written once its turn starts"
    );
    assert_eq!(
        queueing.status(&chat, "working").await["turns"],
        json!([running, queued])
    );

    // The running turn ends: the queued one starts by itself, on the same process.
    queueing
        .fake
        .script(script(json!([{ "type": "text", "text": "MIT." }])));
    queueing.fake.emit(done());
    queueing.turn_in(&queued, "done").await;
    let sent = queueing.fake.sent();
    assert_eq!((sent.len(), sent[1].when), (2, When::Queue));
    assert_eq!(sent[1].text, "And the license");
    assert_eq!(queueing.fake.opens().len(), 1);
    assert_eq!(
        lines(&queueing.log(&queued).await),
        ["human: And the license", "text: MIT."]
    );
    stage.server.stop().await;
    queueing.server.stop().await;
}

// A message the agent has not read can be taken back, and then never runs: a queued turn ends
// at once, without a word to the agent, and a steered message goes through the agent's own
// take-back. Once read, it stays.
#[tokio::test]
async fn a_message_not_read_yet_is_taken_back() {
    let stage = stage().await;
    stage.fake.set(|fake| fake.capabilities.steer = false);
    let chat = stage.chat().await;
    let running = stage.send(&chat, "Read the README").await;
    stage.turn_in(&running, "running").await;
    let queued = stage.send(&chat, "And the license").await;
    let message = message_of(&stage.log(&queued).await, "And the license");

    // A queued turn's message: its turn stops as taken back, leaves the transcript, and the
    // session's status skips it.
    let take = json!({ "session": chat, "message": message });
    stage.done("session.takeBack", take).await;
    let taken = stage.turn_in(&queued, "stopped").await;
    assert_eq!(taken["reason"], "Taken back.");
    assert_eq!(stage.log(&queued).await, Vec::<Value>::new());
    stage.fake.emit(done());
    stage.turn_in(&running, "done").await;
    assert_eq!(stage.status(&chat, "unread").await["statusTurn"], running);
    assert_eq!(stage.fake.sent().len(), 1, "the agent never got it");
    let dismiss = stage
        .refused("session.dismiss", json!({ "turn": queued }))
        .await;
    assert_eq!(dismiss, "This message was taken back: it never ran.");

    // A steered message: the agent is asked to take it back, and its `cancelled` takes it out.
    let steering = super::stage().await;
    let chat = steering.chat().await;
    let turn = steering.send(&chat, "Read the README").await;
    steering.turn_in(&turn, "running").await;
    steering.send(&chat, "And the license").await;
    let mut log = page(&steering, &turn).await;
    let message = message_of(log.value["items"].as_array().unwrap(), "And the license");
    let take = json!({ "session": chat, "message": message });
    steering.done("session.takeBack", take).await;
    assert_eq!(steering.fake.taken_back(), std::slice::from_ref(&message));
    steering
        .fake
        .emit(event(json!({ "type": "cancelled", "id": message })));
    log.until("the message to leave", |log| {
        log["items"].as_array().unwrap().len() == 1
    })
    .await;

    // The message that started the turn, and one the agent read, stay.
    let first = message_of(log.value["items"].as_array().unwrap(), "Read the README");
    let read = steering.refused(
        "session.takeBack",
        json!({ "session": chat, "message": first }),
    );
    assert_eq!(read.await, "The agent already read it.");
    stage.server.stop().await;
    steering.server.stop().await;
}

// An action the agent's permissions blocked waits in the transcript for the human. Their yes
// opens the process again with the one rule that allows it, for that process only, and asks
// the agent to try again in a turn of its own: the action then runs.
#[tokio::test]
async fn a_blocked_action_is_allowed_then_tried_again() {
    let stage = stage().await;
    let chat = stage.chat().await;
    let attempt = json!([
        { "try": { "id": "t1", "tool": "Bash", "input": { "command": "curl example.com" } } },
    ]);
    stage.fake.script(script(attempt.clone()));
    let blocked = stage.send(&chat, "Fetch the page").await;
    stage.turn_in(&blocked, "done").await;
    let session = stage.status(&chat, "needs-you").await;
    assert_eq!(
        (&session["statusReason"], &session["allowable"]),
        (&json!("blocked"), &json!(1))
    );
    let log = stage.log(&blocked).await;
    assert_eq!(
        lines(&log),
        [
            "human: Fetch the page",
            "tool Bash failed",
            "denial Bash false"
        ]
    );
    let denial = &log[2];
    assert_eq!(
        (&denial["target"], &denial["rule"]),
        (&json!("curl example.com"), &json!("Bash(curl example.com)"))
    );

    // Allowed: a new process with the rule, and a turn of its own that asks again.
    stage.fake.script(script(attempt));
    let allow = json!({ "session": chat, "turn": blocked, "denial": denial["id"] });
    let retry = stage.done("session.allow", allow).await;
    let retry = retry["turn"].as_str().expect("the retry's turn").to_owned();
    let retried = stage.turn_in(&retry, "done").await;
    assert_eq!(
        (&retried["kind"], &retried["allowed"]),
        (&json!("allow"), &json!("Bash(curl example.com)"))
    );
    let opens = stage.fake.opens();
    assert_eq!(opens.len(), 2);
    assert_eq!(opens[0].allowed, Vec::<String>::new());
    assert_eq!(opens[1].allowed, ["Bash(curl example.com)"]);
    assert!(opens[1].resume, "the agent's same session");
    assert_eq!(stage.fake.closes(), 1);
    assert_eq!(
        lines(&stage.log(&retry).await),
        [
            "human: Try the blocked action again, now allowed: Bash curl example.com",
            "tool Bash completed",
        ]
    );
    // The blocked action reads allowed, and the session no longer asks for it.
    assert_eq!(stage.log(&blocked).await[2]["allowed"], true);
    let session = stage.status(&chat, "unread").await;
    assert_eq!(session["allowable"], 0);

    // An action no rule allows alone cannot be allowed.
    let wide = json!([{ "try": { "id": "t2", "tool": "Bash", "input": { "command": "rm *" } } }]);
    stage.fake.script(script(wide));
    let wide = stage.send(&chat, "Clean up").await;
    stage.turn_in(&wide, "done").await;
    let denial = stage.log(&wide).await[2].clone();
    assert_eq!(denial["rule"], Value::Null);
    let allow = json!({ "session": chat, "turn": wide, "denial": denial["id"] });
    let refused = stage.refused("session.allow", allow).await;
    assert_eq!(refused, "No allow rule can match only this action.");
    let all = stage
        .refused("session.allowAll", json!({ "session": chat }))
        .await;
    assert_eq!(all, "No blocked action to allow.");
    stage.server.stop().await;
}
