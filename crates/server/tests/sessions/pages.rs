//! A turn's transcript by pages: what a client subscribes to, read from the store, with what
//! came after a page and changed a line of it; the same pages for a store written before
//! lines were numbered; and how long a very long reply takes to stream.

use std::time::{Duration, Instant, SystemTime};

use rusqlite::Connection;
use serde_json::{Value, json};
use tempfile::TempDir;
use uraeda_protocol::Item;
use uraeda_server::runner::{Event, FILE, NewSession, NewTurn, Store, TurnKind, TurnState};
use uraeda_server::runtimes::fake::Script;

use super::{REPO, event, lines, stage};
use crate::support::Held;

/// A chat's running turn, in a store of its own.
fn started(folder: &TempDir) -> (Store, i64) {
    let store = Store::open(folder.path()).expect("a store");
    let chat = NewSession {
        repo: "/repo".to_owned(),
        folder: None,
        parent: None,
        role: None,
        step: None,
        worktree: None,
        agent: "fake".to_owned(),
        native_id: "native".to_owned(),
        title: None,
        model: None,
        effort: None,
    };
    let session = store.create_session(chat, at(0)).expect("a session");
    let turn = NewTurn {
        session_id: session.id,
        kind: TurnKind::Chat,
        trigger: None,
        step: None,
        allowed: None,
        caught_up_to: None,
        state: TurnState::Running,
    };
    let turn = store.add_turn(turn, at(0)).expect("a turn");
    (store, turn)
}

/// A time, some seconds after the tests' start.
fn at(seconds: u64) -> SystemTime {
    SystemTime::UNIX_EPOCH + crate::support::START + Duration::from_secs(seconds)
}

/// Writes a turn of 102 lines over two pages, with what a transcript changes after the fact:
/// a message read, a tool call that ends late, a blocked action allowed, skipped output
/// counted, and a text that goes on past its page's end.
fn written(store: &Store, turn: i64) {
    let mut second = 0;
    let mut add = |json: Value| {
        second += 1;
        store
            .append(turn, at(second), &event(json))
            .expect("an event")
            .seq
    };
    let tool = |id: &str| {
        json!({
            "type": "toolStart", "id": id, "kind": "execute", "name": "Bash",
            "input": {}, "target": "make",
        })
    };
    add(json!({ "type": "message", "id": "m1", "origin": "human", "text": "Build it" }));
    add(tool("t1"));
    let denial = add(json!({ "type": "denial", "tool": "Bash", "rule": "Bash(make)" }));
    add(json!({ "type": "skipped" }));
    for line in 0..95 {
        add(json!({ "type": "notice", "text": format!("Line {line}") }));
    }
    // The last line of the first page: a text that is still written as the page ends.
    add(json!({ "type": "textDelta", "text": "The " }));
    add(tool("t2"));
    add(json!({ "type": "textDelta", "text": "end" }));
    add(json!({ "type": "text", "text": "The end." }));
    add(json!({ "type": "toolEnd", "id": "t1", "isError": false, "output": "x".repeat(5000) }));
    add(json!({ "type": "accepted", "id": "m1" }));
    add(json!({ "type": "allowed", "denial": denial }));
    add(json!({ "type": "skipped" }));
    add(json!({ "type": "skipped" }));
    add(json!({ "type": "notice", "text": "Last" }));
    add(json!({ "type": "toolEnd", "id": "t2", "isError": true, "output": "no rule" }));
}

/// A page's items, as the protocol sends them.
fn sent(items: &[Item]) -> Vec<Value> {
    let sent = items.iter().map(|item| serde_json::to_value(item).unwrap());
    sent.collect()
}

// A client draws a turn by pages of 100 lines. A page holds its own lines, each as it reads
// now: what came after the page, and changed one of its lines, is in it, and nothing of the
// next page is.
#[test]
fn a_transcript_reads_by_pages_each_with_what_later_changed_its_lines() {
    let folder = TempDir::new().unwrap();
    let (store, turn) = started(&folder);
    written(&store, turn);

    assert_eq!(store.pages(turn).unwrap(), 2);
    let first = sent(&store.page(turn, 0, "Fake agent").unwrap());
    assert_eq!(first.len(), 100);
    assert_eq!(
        (&first[0]["kind"], &first[0]["read"]),
        (&json!("message"), &json!(true))
    );
    let ended = &first[1];
    assert_eq!(
        (&ended["status"], &ended["durationMs"]),
        (&json!("completed"), &json!(102_000))
    );
    assert_eq!(
        ended["output"].as_str().unwrap().len(),
        4000,
        "cut to 4,000 characters"
    );
    assert_eq!(
        (&first[2]["kind"], &first[2]["allowed"]),
        (&json!("denial"), &json!(true))
    );
    let skipped = "Skipped 3 lines Fake agent printed that Uraeda does not read.";
    assert_eq!(first[3]["text"], skipped);
    assert_eq!(
        (
            &first[99]["kind"],
            &first[99]["text"],
            &first[99]["streaming"]
        ),
        (&json!("text"), &json!("The end."), &json!(false))
    );
    // Each line is named by the place of the event that started it, for good.
    assert_eq!(
        (&first[0]["id"], &first[99]["id"]),
        (&json!("0"), &json!("99"))
    );

    let second = sent(&store.page(turn, 1, "Fake agent").unwrap());
    assert_eq!(lines(&second), ["tool Bash failed", "system: Last"]);
    assert_eq!(
        (&second[0]["id"], &second[1]["id"]),
        (&json!("100"), &json!("108"))
    );
    assert_eq!(store.page_of(turn, 100).unwrap(), Some(1));
    assert_eq!(
        store.page_of(turn, 101).unwrap(),
        None,
        "a piece starts no line"
    );
    assert_eq!(
        store.page(turn, 2, "Fake agent").unwrap(),
        Vec::<Item>::new()
    );
}

// A store written before its lines were numbered, as an import made it, reads by the same
// pages once the server opened it: each event that starts a line is numbered as a new one is.
#[test]
fn a_store_written_before_its_lines_were_numbered_reads_by_the_same_pages() {
    let folder = TempDir::new().unwrap();
    let (store, turn) = started(&folder);
    written(&store, turn);
    let pages = |store: &Store| {
        let page = |page| store.page(turn, page, "Fake agent").unwrap();
        (store.pages(turn).unwrap(), page(0), page(1))
    };
    let before = pages(&store);
    store.close();

    // Back to the first schema: no line is numbered, and no session has an account.
    let db = Connection::open(folder.path().join(FILE)).unwrap();
    db.execute_batch(
        "DROP INDEX events_of_items; DROP INDEX events_by_type;
         ALTER TABLE events DROP COLUMN item; ALTER TABLE sessions DROP COLUMN account;
         PRAGMA user_version = 1;",
    )
    .unwrap();
    drop(db);

    let store = Store::open(folder.path()).expect("the store, brought up to this schema");
    assert_eq!(pages(&store), before);
    // And it is written on as any other.
    let last = json!({ "type": "notice", "text": "After" });
    let added = store.append(turn, at(200), &event(last)).unwrap();
    assert_eq!(store.page_of(turn, added.seq).unwrap(), Some(1));
}

// How long a reply of 20,000 pieces takes from the agent to a subscriber, whole: what task 53
// measures against a frame. Run it by hand:
// `cargo nextest run -p uraeda-server --test sessions --run-ignored only long_reply`.
#[tokio::test]
#[ignore = "a measure, run by hand"]
async fn a_long_reply_of_20000_pieces_streams_to_a_subscriber() {
    let stage = stage().await;
    let chat = stage.chat().await;
    let words: Vec<String> = (0..20_000).map(|word| format!("word{word} ")).collect();
    let reply = words.concat();
    // No wait between two pieces: the fake's own waits would be what is measured.
    let piece = |text: &String| Event::TextDelta { text: text.clone() };
    let whole = Event::Text {
        text: reply.clone(),
    };
    let pieces: Vec<Event> = words.iter().map(piece).chain([whole]).collect();
    stage.fake.script(Script::from(pieces));
    let began = Instant::now();
    let turn = stage.send(&chat, "Write a lot").await;
    let args = json!({ "repo": REPO, "turn": turn, "page": 0 });
    let mut log = Held::open(&stage.server, "TurnLog", args).await;
    let whole = |log: &Value| log["items"][1]["streaming"] == false;
    let read = log.until("the whole reply", whole).await;
    assert_eq!(read["items"][1]["text"], reply);
    println!(
        "20,000 pieces reached a subscriber in {:?}",
        began.elapsed()
    );
    stage.server.stop().await;
}
