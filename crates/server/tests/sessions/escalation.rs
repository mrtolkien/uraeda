//! A process that does not answer: an interrupt, then a close, each followed by signals at 10
//! second steps, on a paused clock. And the sweep of a restart, which stops what a server left
//! running, and continues only what a server's stop cut.

use std::sync::Arc;
use std::time::Duration;

use serde_json::json;
use uraeda_server::runner::{
    IMPORTED, NewSession, NewTurn, Store, TERMINATE_AFTER, TurnEnd, TurnKind, TurnState,
};
use uraeda_server::runtimes::fake::Fake;
use uraeda_server::runtimes::{self, Signal};

use super::{Stage, script, stage};

/// Lets the tasks a moment of the clock woke run.
async fn settle() {
    for _ in 0..50 {
        tokio::task::yield_now().await;
    }
}

/// Moves the paused clock on by one step of the escalation.
async fn step() {
    tokio::time::advance(TERMINATE_AFTER).await;
    settle().await;
}

// Stop asks the agent to interrupt its turn. One that does not answer gets `SIGINT` 10 seconds
// later, and `SIGTERM` 10 seconds after that: the turn ends as stopped once its process does.
// A closed process that does not exit gets `SIGTERM`, then `SIGKILL`, so the server's stop
// never waits for it for ever.
#[tokio::test]
async fn an_unanswered_interrupt_or_close_is_followed_by_signals_at_ten_second_steps() {
    let stage = stage().await;
    stage.fake.set(|fake| {
        fake.ignore_interrupt = true;
        fake.ignore_close = true;
        fake.ignore_term = true;
    });
    let chat = stage.chat().await;
    let turn = stage.send(&chat, "Read the README").await;
    stage.turn_in(&turn, "running").await;
    stage.done("session.stop", json!({ "session": chat })).await;
    assert_eq!((stage.fake.interrupts(), stage.fake.kills()), (1, vec![]));

    // The interrupt goes unanswered: a signal at each step.
    tokio::time::pause();
    tokio::time::advance(TERMINATE_AFTER - Duration::from_secs(1)).await;
    settle().await;
    assert_eq!(stage.fake.kills(), vec![]);
    step().await;
    assert_eq!(stage.fake.kills(), [Signal::Interrupt]);
    step().await;
    assert_eq!(stage.fake.kills(), [Signal::Interrupt, Signal::Terminate]);
    tokio::time::resume();
    // Its process ends at last: the turn reads stopped, as the human asked, not failed.
    stage.fake.exit(143, "");
    let stopped = stage.turn_in(&turn, "stopped").await;
    assert_eq!(stopped["reason"], serde_json::Value::Null);

    // The server stops while a turn runs on a process that ignores its close: it is closed,
    // then signalled, and killed 20 seconds later, which ends the stop.
    let next = stage.send(&chat, "Go on").await;
    stage.turn_in(&next, "running").await;
    let before = stage.fake.kills().len();
    let fake = stage.fake.clone();
    tokio::time::pause();
    let stopping = tokio::spawn(stage.server.stop());
    // The stop closes the process on a thread of its own: once it did, its signals are armed.
    while fake.closes() == 0 {
        tokio::task::yield_now().await;
        std::thread::sleep(Duration::from_millis(1));
    }
    std::thread::sleep(Duration::from_millis(50));
    settle().await;
    // A timer fires once the clock is past its time, to the millisecond.
    tokio::time::advance(Duration::from_millis(10)).await;
    step().await;
    let mut first = fake.kills()[before..].to_vec();
    first.sort_by_key(|signal| signal.name());
    assert_eq!(first, [Signal::Interrupt, Signal::Terminate]);
    assert_eq!(fake.running(), 1);
    step().await;
    assert!(fake.kills()[before..].contains(&Signal::Kill));
    tokio::time::resume();
    stopping.await.expect("the server stops");
    assert_eq!(fake.running(), 0);
}

/// A chat with one turn that started a minute ago and stopped for `reason`, written in the
/// store as an earlier server left it: its session's id, and its turn's.
fn stopped_chat(stage: &Stage, native: &str, reason: &str) -> (String, i64) {
    let store = stage.server.shared().get::<Store>();
    let started = stage.server.clock().now() - Duration::from_secs(60);
    let chat = NewSession {
        repo: stage.repo.path().to_string_lossy().into_owned(),
        folder: None,
        parent: None,
        role: None,
        step: None,
        worktree: None,
        agent: "fake".to_owned(),
        native_id: native.to_owned(),
        title: Some("An earlier chat".to_owned()),
        model: None,
        effort: None,
    };
    let session = store.create_session(chat, started).expect("a session");
    let turn = NewTurn {
        session_id: session.id.clone(),
        kind: TurnKind::Chat,
        trigger: None,
        step: None,
        allowed: None,
        caught_up_to: None,
        state: TurnState::Running,
    };
    let turn = store.add_turn(turn, started).expect("a turn");
    let end = TurnEnd::because(TurnState::Stopped, reason);
    store.end_turn(turn, &end, started).expect("its end");
    (session.id, turn)
}

// A restart continues the runs the server's own stop cut, and nothing else: a turn the import
// stopped ran in the earlier server, which may still run it, so it only asks.
#[tokio::test]
async fn a_restart_continues_a_cut_run_and_never_an_imported_one() {
    let stage = stage().await;
    let cut = "Stopped: the server stopped while it ran.";
    let (imported, imported_turn) = stopped_chat(&stage, "native-imported", IMPORTED);
    let (stopped, _) = stopped_chat(&stage, "native-cut", cut);
    // A turn a killed server left running is swept as the next one starts.
    let left = stage.chat().await;
    let running = stage.send(&left, "Read the README").await;
    stage.turn_in(&running, "running").await;
    let native = stage.fake.opens()[0].native_id.clone();

    let Stage { repo, server, .. } = stage;
    let server = server.restart().await;
    let fake = Fake::new();
    fake.set(|fake| {
        for native in ["native-imported", "native-cut", native.as_str()] {
            fake.sessions.insert(native.to_owned());
        }
    });
    fake.fallback(|_| Some(script(json!([{ "type": "text", "text": "Done." }]))));
    let registered = runtimes::register(server.shared(), "fake", Arc::new(fake.clone()));
    drop(registered.expect("the fake registers"));
    let stage = Stage { repo, server, fake };

    // Both cut runs go on, each in a turn of its own.
    for session in [&stopped, &left] {
        let mut held = stage.held("Session", session).await;
        held.until("the cut run to continue", |session| {
            session["turns"].as_array().unwrap().len() == 2 && session["status"] == "unread"
        })
        .await;
    }
    // The imported one was not continued: it reads stopped, and asks.
    let session = stage.read("Session", &imported).await;
    assert_eq!(session["turns"], json!([imported_turn.to_string()]));
    assert_eq!(
        (
            &session["status"],
            &session["statusReason"],
            &session["continues"]
        ),
        (&json!("attention"), &json!("stopped"), &json!(0))
    );
    let resumed: Vec<String> = stage
        .fake
        .opens()
        .into_iter()
        .map(|open| open.native_id)
        .collect();
    assert!(
        !resumed.contains(&"native-imported".to_owned()),
        "{resumed:?}"
    );
    stage.server.stop().await;
}
