//! The sessions, over `/live`, on the fake runtime: a reply that streams to a subscriber, a
//! session through a restart of the server, a turn stopped, and, in `sessions/`, what the Node
//! server's tests named as costly to lose: queued and steered messages, a message taken back, a
//! blocked action allowed, the agents a workflow run starts, the restart's sweep, and a process
//! that does not answer.

use crate::support;

#[path = "sessions/agents.rs"]
mod agents;
#[path = "sessions/background.rs"]
mod background;
#[path = "sessions/catch_ups.rs"]
mod catch_ups;
#[path = "sessions/escalation.rs"]
mod escalation;
#[path = "sessions/life.rs"]
mod life;
#[path = "sessions/messages.rs"]
mod messages;
#[path = "sessions/pages.rs"]
mod pages;
#[path = "sessions/seams.rs"]
mod seams;
#[path = "sessions/tools.rs"]
mod tools;

use std::sync::Arc;

use serde_json::{Value, json};
use support::{Held, Live, TestRepo, TestServer, fixture_repo};
use uraeda_protocol::{ClientMessage, Op, ServerMessage};
use uraeda_server::runner::Event;
use uraeda_server::runtimes::fake::{Fake, Script};
use uraeda_server::runtimes::{self, Runtimes};

/// The name of the tests' repository in the server's list: its folder's.
const REPO: &str = "todo-app";

/// The fixture's feature that waits on the agent: its spec is approved, and its plan not written.
const AGENT: &str = "2026-10-12-cli-tuis";

/// The fixture's feature that waits on the human: its questions are not answered.
const HUMAN: &str = "2026-10-11-web-ui";

/// The settings of a server whose only runtime on is the fake: the built-in ones are off, so a
/// new session never picks an agent that is not installed.
const FAKE_ONLY: &str = "[extensions.claude]\non = []\n\n[extensions.codex]\non = []\n";

/// A server that lists the fixture's repository, with the fake runtime registered and checked.
struct Stage {
    repo: TestRepo,
    server: TestServer,
    fake: Fake,
}

/// Registers a fake runtime with a server, as `fake`, and waits for the check that finds it
/// available.
async fn register(server: &TestServer) -> Fake {
    let fake = Fake::new();
    let registered = runtimes::register(server.shared(), "fake", Arc::new(fake.clone()));
    drop(registered.expect("the fake registers"));
    let runtimes = server.shared().get::<Runtimes>();
    let checked = tokio::task::spawn_blocking(move || runtimes.check());
    checked.await.expect("the runtimes are checked");
    fake
}

/// A server on a repository, with the settings of [`FAKE_ONLY`] and `more` after them.
async fn serving(repo: &TestRepo, more: &str) -> TestServer {
    let config = format!("{FAKE_ONLY}\n{more}");
    let setup = support::setup().config("config.toml", &config);
    setup.folder(repo.path()).start().await
}

/// The fixture's repository, a server that lists it, and the fake runtime.
async fn stage() -> Stage {
    staged("").await
}

/// [`stage`], with more settings.
async fn staged(more: &str) -> Stage {
    let repo = fixture_repo(REPO);
    let server = serving(&repo, more).await;
    let fake = register(&server).await;
    Stage { repo, server, fake }
}

impl Stage {
    /// Calls an action on the tests' repository, which answers: its output. `input` is the
    /// action's input without its `repo`.
    async fn done(&self, action: &str, input: Value) -> Value {
        match self.asked(action, input).await {
            Ok(output) => output,
            Err((code, message)) => panic!("`{action}` is refused: {code:?}: {message}"),
        }
    }

    /// Calls an action on the tests' repository: its output, or its refusal.
    async fn asked(&self, action: &str, mut input: Value) -> Result<Value, support::Refused> {
        input["repo"] = json!(REPO);
        support::call(&self.server, action, input).await
    }

    /// Calls an action that is refused: why.
    async fn refused(&self, action: &str, input: Value) -> String {
        match self.asked(action, input).await {
            Ok(output) => panic!("`{action}` answered {output}"),
            Err((_, message)) => message,
        }
    }

    /// A new chat: its session's id.
    async fn chat(&self) -> String {
        let made = self.done("session.newChat", json!({})).await;
        made["session"].as_str().expect("a session").to_owned()
    }

    /// Sends a text to a session: the turn it went to.
    async fn send(&self, session: &str, text: &str) -> String {
        let input = json!({ "session": session, "text": text });
        let sent = self.done("session.send", input).await;
        sent["turn"].as_str().expect("a turn").to_owned()
    }

    /// A record of one session or turn of the tests' repository, held by a client of its own.
    async fn held(&self, record: &str, id: &str) -> Held {
        Held::open(&self.server, record, json!({ "repo": REPO, "id": id })).await
    }

    /// A record of one session or turn, read once.
    async fn read(&self, record: &str, id: &str) -> Value {
        self.held(record, id).await.value
    }

    /// Waits until a turn is in a state, and gives it.
    async fn turn_in(&self, turn: &str, state: &str) -> Value {
        let mut held = self.held("Turn", turn).await;
        let what = format!("turn {turn} to be {state}");
        held.until(&what, |turn| turn["state"] == state)
            .await
            .clone()
    }

    /// The first page of a turn's transcript, read once.
    async fn log(&self, turn: &str) -> Vec<Value> {
        log_of(&self.server, turn).await
    }

    /// Waits until a session's status is `status`, and gives the session.
    async fn status(&self, session: &str, status: &str) -> Value {
        let mut held = self.held("Session", session).await;
        let what = format!("session {session} to be {status}");
        held.until(&what, |session| session["status"] == status)
            .await
            .clone()
    }
}

/// The first page of a turn's transcript, read once.
async fn log_of(server: &TestServer, turn: &str) -> Vec<Value> {
    let args = json!({ "repo": REPO, "turn": turn, "page": 0 });
    let page = support::read(server, "TurnLog", args).await;
    page["items"].as_array().expect("a page's items").clone()
}

/// The lines of a transcript's page, in short: each as its kind and what it says.
fn lines(items: &[Value]) -> Vec<String> {
    let line = |item: &Value| {
        let text = |field: &str| item[field].as_str().unwrap_or_default().to_owned();
        match item["kind"].as_str().unwrap_or_default() {
            "message" => format!("{}: {}", text("origin"), text("text")),
            "tool" => format!("tool {} {}", text("name"), text("status")),
            "denial" => format!("denial {} {}", text("tool"), item["allowed"]),
            kind => format!("{kind}: {}", text("text")),
        }
    };
    items.iter().map(line).collect()
}

/// A script, from the JSON a sample is written in.
fn script(steps: Value) -> Script {
    serde_json::from_value(steps).expect("a script")
}

/// An event, from its JSON.
fn event(json: Value) -> Event {
    serde_json::from_value(json).expect("an event")
}

// A reply is drawn while it is written: each piece reaches a subscriber as an `append` to the
// text it grows, never as the page's items sent again, so a long reply costs what it adds.
#[tokio::test]
async fn a_streaming_reply_reaches_a_subscriber_as_appends() {
    let stage = stage().await;
    let chat = stage.chat().await;
    // The turn stays open: the test says each piece itself.
    let turn = stage.send(&chat, "Tell me about the README").await;
    stage.turn_in(&turn, "running").await;
    let mut client = stage.server.connect().await;
    let args = json!({ "repo": REPO, "turn": turn, "page": 0 });
    let record = "TurnLog".to_owned();
    client
        .send(&ClientMessage::Sub {
            id: 1,
            record,
            args,
        })
        .await;
    let ServerMessage::Data { mut value, .. } = client.next().await else {
        panic!("a sub is answered with the whole value");
    };
    assert_eq!(
        lines(value["items"].as_array().unwrap()),
        ["human: Tell me about the README"]
    );

    // The first piece is a new line of the page: it is inserted, the message left as it is.
    let piece = |text: &str| event(json!({ "type": "textDelta", "text": text }));
    stage.fake.emit(piece("The README "));
    let ServerMessage::Change { ops, .. } = client.next_for("the reply's first piece").await else {
        panic!("a new line is a change");
    };
    let [
        Op::Insert {
            path, value: line, ..
        },
    ] = ops.as_slice()
    else {
        panic!("a new line is inserted alone: {ops:?}");
    };
    assert_eq!(path, &["items"]);
    assert_eq!(
        (&line["kind"], &line["text"]),
        (&json!("text"), &json!("The README "))
    );
    let id = line["id"].as_str().expect("a line's id").to_owned();
    uraeda_protocol::apply(&mut value, &ops).unwrap();

    // Every later piece is an append to that line's text, and nothing else.
    let pieces = [
        "says ",
        "what Uraeda ",
        "is, ",
        "and how to ",
        "install it.",
    ];
    for piece_text in pieces {
        stage.fake.emit(piece(piece_text));
    }
    let mut grown = String::new();
    while grown != pieces.concat() {
        let ServerMessage::Change { ops, .. } = client.next_for("the reply's pieces").await else {
            panic!("a piece is a change");
        };
        for op in &ops {
            let Op::Append { path, text } = op else {
                panic!("a piece of a reply is an append: {op:?}");
            };
            assert_eq!(path, &["items", id.as_str(), "text"]);
            grown.push_str(text);
        }
        uraeda_protocol::apply(&mut value, &ops).unwrap();
    }
    let whole = "The README says what Uraeda is, and how to install it.";
    assert_eq!(value["items"][1]["text"], whole);
    assert_eq!(value["items"][1]["streaming"], true);

    // The whole text ends the reply: the same line, no longer written.
    stage
        .fake
        .emit(event(json!({ "type": "text", "text": whole })));
    stage.fake.emit(done());
    stage.turn_in(&turn, "done").await;
    let log = stage.log(&turn).await;
    assert_eq!(
        lines(&log),
        ["human: Tell me about the README", &format!("text: {whole}")]
    );
    assert_eq!(
        (&log[1]["id"], &log[1]["streaming"]),
        (&json!(id), &json!(false))
    );
    stage.server.stop().await;
}

/// The result a turn ends with when nothing went wrong.
fn done() -> Event {
    event(json!({
        "type": "result", "ok": true, "interrupted": false, "denials": [], "errors": [],
    }))
}

// A session is a row of the store, not of a server: after a restart it reads as it was, the
// turn the stop cut is stopped by the server, and, with the setting on, its run goes on by
// itself, in the agent's same session.
#[tokio::test]
async fn a_session_survives_a_server_restart_and_continues_when_the_decision_says_so() {
    let stage = stage().await;
    let chat = stage.chat().await;
    let first = stage.send(&chat, "Rename the helper").await;
    stage.turn_in(&first, "running").await;
    stage
        .fake
        .emit(event(json!({ "type": "text", "text": "Renaming it." })));
    let mut log = Held::open(
        &stage.server,
        "TurnLog",
        json!({ "repo": REPO, "turn": first, "page": 0 }),
    )
    .await;
    log.until("the reply", |log| {
        log["items"].as_array().unwrap().len() == 2
    })
    .await;
    drop(log);

    // The fake keeps each session's transcript, as an agent does on disk: the next server's
    // fake is told of it.
    let native = stage.fake.opens()[0].native_id.clone();
    let Stage { repo, server, .. } = stage;
    let server = server.restart().await;
    let fake = Fake::new();
    fake.set(|fake| {
        fake.sessions.insert(native.clone());
    });
    fake.script(script(json!([{ "type": "text", "text": "Done." }])));
    let registered = runtimes::register(server.shared(), "fake", Arc::new(fake.clone()));
    drop(registered.expect("the fake registers"));
    let stage = Stage { repo, server, fake };

    // The cut turn is stopped by the server, with its transcript, and a new turn continues it.
    let cut = stage.turn_in(&first, "stopped").await;
    assert_eq!(cut["reason"], "Stopped: the server stopped while it ran.");
    assert_eq!(
        lines(&stage.log(&first).await),
        ["human: Rename the helper", "text: Renaming it."]
    );
    let mut session = stage.held("Session", &chat).await;
    let continued = session
        .until("the run to continue", |session| {
            session["turns"].as_array().unwrap().len() == 2 && session["status"] == "unread"
        })
        .await
        .clone();
    let second = continued["turns"][1].as_str().unwrap().to_owned();
    assert_eq!(continued["continues"], 1);
    assert_eq!(
        lines(&stage.log(&second).await),
        [
            "system: Continued after the server restarted.",
            "workflow: The server restarted while you worked. Continue where you left off.",
            "text: Done.",
        ]
    );
    // It resumed the agent's session, and started no other.
    let opens = stage.fake.opens();
    assert_eq!(opens.len(), 1);
    assert_eq!(
        (opens[0].native_id.as_str(), opens[0].resume),
        (native.as_str(), true)
    );
    stage.server.stop().await;
}

// With the setting off, a cut run asks: it is the human's to continue.
#[tokio::test]
async fn a_cut_run_asks_when_its_continue_is_off() {
    let stage = staged("[runs]\ncontinue_after_restart = false\n").await;
    let chat = stage.chat().await;
    let turn = stage.send(&chat, "Rename the helper").await;
    stage.turn_in(&turn, "running").await;
    let native = stage.fake.opens()[0].native_id.clone();
    let Stage { repo, server, .. } = stage;
    let server = server.restart().await;
    let fake = register(&server).await;
    fake.set(|fake| {
        fake.sessions.insert(native);
    });
    let stage = Stage { repo, server, fake };

    let session = stage.status(&chat, "attention").await;
    assert_eq!(session["statusReason"], "interrupted");
    assert_eq!(session["turns"], json!([turn]));
    assert_eq!(stage.fake.opens().len(), 0);
    stage.server.stop().await;
}

// Stop ends the running turn through the agent's own interrupt, and keeps the session: the
// turn reads stopped, which is no failure, and the next message starts a turn on the same
// process.
#[tokio::test]
async fn stopping_a_turn_ends_it_as_stopped() {
    let stage = stage().await;
    let chat = stage.chat().await;
    stage.fake.script(script(json!([
        { "type": "textDelta", "text": "Reading " },
        { "wait": 600_000 },
        { "type": "text", "text": "Reading the README." },
    ])));
    let turn = stage.send(&chat, "Read the README").await;
    let mut log = Held::open(
        &stage.server,
        "TurnLog",
        json!({ "repo": REPO, "turn": turn, "page": 0 }),
    )
    .await;
    log.until("the first piece", |log| {
        log["items"].as_array().unwrap().len() == 2
    })
    .await;

    stage.done("session.stop", json!({ "session": chat })).await;
    let stopped = stage.turn_in(&turn, "stopped").await;
    assert_eq!(stopped["reason"], Value::Null);
    assert_eq!(stage.fake.interrupts(), 1);
    let session = stage.status(&chat, "attention").await;
    assert_eq!(session["statusReason"], "stopped");
    // The piece written before the stop stays, cut short.
    assert_eq!(
        lines(&stage.log(&turn).await),
        ["human: Read the README", "text: Reading "]
    );

    // The process was kept: the next message runs on it.
    stage
        .fake
        .script(script(json!([{ "type": "text", "text": "Here." }])));
    let next = stage.send(&chat, "Go on").await;
    stage.turn_in(&next, "done").await;
    assert_eq!(stage.fake.opens().len(), 1);
    assert_eq!(stage.fake.running(), 1);
    let mut live = Live::of(&stage.server).await;
    live.waiting_for("the session to be read");
    let session = live
        .read("Session", json!({ "repo": REPO, "id": chat }))
        .await;
    assert_eq!(session["turns"], json!([turn, next]));
    stage.server.stop().await;
    assert_eq!(stage.fake.running(), 0);
}
