//! A reply that ended while its background tasks run: the run lifecycle decision's check of a
//! command that never ends, which would hold the turn forever, and its parent's call with it.

use std::time::Duration;

use serde_json::json;
use uraeda_server::runtimes::When;

use super::{REPO, Stage, done, event, lines, stage};
use crate::support::Held;

/// How long a reply waits for its background tasks without output before it is asked about
/// them, and then for an answer.
const QUIET: Duration = Duration::from_secs(10 * 60);

/// Moves the server's clock on by `wait`, the timers due meanwhile fired.
async fn later(wait: Duration) {
    tokio::time::pause();
    tokio::time::advance(wait).await;
    tokio::time::resume();
}

/// The first page of a turn's transcript, held.
async fn held_log(stage: &Stage, turn: &str) -> Held {
    let args = json!({ "repo": REPO, "turn": turn, "page": 0 });
    Held::open(&stage.server, "TurnLog", args).await
}

/// A chat whose agent replied while a command of its runs in the background: its turn.
async fn replied_with_a_command(stage: &Stage, chat: &str) -> String {
    let turn = stage.send(chat, "Review it").await;
    stage.turn_in(&turn, "running").await;
    let tasks = json!([{ "kind": "command", "tool": "bash-1" }]);
    stage
        .fake
        .emit(event(json!({ "type": "background", "tasks": tasks })));
    stage.fake.emit(event(
        json!({ "type": "text", "text": "The review passed." }),
    ));
    stage.fake.emit(done());
    let mut held = stage.held("Turn", &turn).await;
    held.until("the reply to wait for its command", |turn| {
        turn["activity"]["label"] == "Waiting for 1 background command"
    })
    .await;
    turn
}

// 10 minutes without output, the agent is asked about the command, in a message steered into
// its turn; 10 minutes later without an answer, the turn fails, its check taken back, and its
// process closes, which ends its command.
#[tokio::test]
async fn a_reply_waiting_for_a_background_command_is_asked_about_it_then_fails_unanswered() {
    let stage = stage().await;
    let chat = stage.chat().await;
    let turn = replied_with_a_command(&stage, &chat).await;

    later(QUIET - Duration::from_secs(1)).await;
    assert_eq!(
        stage.fake.sent().len(),
        1,
        "nothing is asked before 10 minutes"
    );
    later(Duration::from_secs(1)).await;
    let mut log = held_log(&stage, &turn).await;
    log.until("the check", |log| {
        log["items"].as_array().unwrap().len() == 3
    })
    .await;
    let check = stage.fake.sent().pop().expect("the check");
    assert_eq!(check.when, When::Steer);
    assert!(
        check.text.starts_with("Uraeda's check: ")
            && check.text.contains(" Waiting for 1 background command. "),
        "{}",
        check.text
    );
    assert_eq!(
        lines(&stage.log(&turn).await)[2],
        format!("workflow: {}", check.text)
    );
    assert_eq!(stage.read("Turn", &turn).await["state"], "running");

    later(QUIET).await;
    let failed = stage.turn_in(&turn, "failed").await;
    assert_eq!(
        failed["reason"],
        "No answer for 10 minutes to the check of its background tasks."
    );
    assert_eq!(stage.fake.taken_back(), [check.id]);
    assert_eq!(stage.fake.closes(), 1);
    stage.server.stop().await;
}

// An agent that answers each check keeps its turn: a long build costs one short answer every
// 10 quiet minutes.
#[tokio::test]
async fn a_reply_whose_agent_answers_the_check_keeps_waiting() {
    let stage = stage().await;
    let chat = stage.chat().await;
    let turn = replied_with_a_command(&stage, &chat).await;

    for round in 1..=3 {
        later(QUIET).await;
        let mut log = held_log(&stage, &turn).await;
        log.until("the check", |log| {
            log["items"].as_array().unwrap().len() == 1 + 2 * round
        })
        .await;
        let check = stage.fake.sent().pop().expect("the check").id;
        stage
            .fake
            .emit(event(json!({ "type": "accepted", "id": check })));
        stage
            .fake
            .emit(event(json!({ "type": "text", "text": "It still runs." })));
        stage.fake.emit(done());
        log.until("the answer", |log| {
            log["items"].as_array().unwrap().len() == 2 + 2 * round
        })
        .await;
    }
    assert_eq!(stage.read("Turn", &turn).await["state"], "running");
    assert_eq!(stage.fake.closes(), 0);
    stage.server.stop().await;
}

// A turn still at work, its reply not ended, is never asked: only its watchdog watches it.
#[tokio::test]
async fn a_reply_that_has_not_ended_is_never_asked() {
    let stage = stage().await;
    let chat = stage.chat().await;
    let turn = stage.send(&chat, "Review it").await;
    stage.turn_in(&turn, "running").await;
    stage
        .fake
        .emit(event(json!({ "type": "text", "text": "Reviewing." })));
    let mut log = held_log(&stage, &turn).await;
    log.until("the text", |log| {
        log["items"].as_array().unwrap().len() == 2
    })
    .await;

    later(2 * QUIET).await;
    tokio::task::yield_now().await;
    assert_eq!(stage.fake.sent().len(), 1);
    assert_eq!(stage.read("Turn", &turn).await["state"], "running");
    stage.server.stop().await;
}
