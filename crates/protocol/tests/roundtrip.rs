//! The protocol's contract, on the examples of `fixtures/protocol/`, which a client's tests can
//! read too: a change's operations, and each message's JSON.

use std::collections::BTreeSet;
use std::path::PathBuf;

use serde::Deserialize;
use serde::de::DeserializeOwned;
use serde_json::{Value, json};
use uraeda_protocol::{
    ClientMessage, ErrorCode, Op, PROTOCOL, Refusal, ServerMessage, SignIn, apply, diff, handshake,
};

/// A file of `fixtures/protocol/`, read as JSON.
fn fixture<T: DeserializeOwned>(name: &str) -> T {
    let path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../fixtures/protocol")
        .join(name);
    serde_json::from_str(&std::fs::read_to_string(path).unwrap()).unwrap()
}

/// A row of `changes.json`: a value before and after, and the change between them.
#[derive(Deserialize)]
struct Row {
    name: String,
    old: Value,
    new: Value,
    ops: Value,
}

/// The examples of `messages.json`, each side's.
#[derive(Deserialize)]
struct Messages {
    client: Vec<Value>,
    server: Vec<Value>,
}

// The break it catches: a change that leaves a client with another value than the server's, or a
// list sent whole again when one of its items changed.
#[test]
fn a_change_applied_to_the_old_value_gives_the_new_value() {
    for row in fixture::<Vec<Row>>("changes.json") {
        let ops = diff(&row.old, &row.new);
        assert_eq!(json!(ops), row.ops, "{}: its change", row.name);

        let mut value = row.old.clone();
        apply(&mut value, &ops).unwrap_or_else(|error| panic!("{}: {error}", row.name));
        assert_eq!(value, row.new, "{}: the value after it", row.name);
    }
}

// The break it catches: a whole-value resend on each chunk of a reply.
#[test]
fn a_string_that_only_grew_is_one_append() {
    let old = json!({ "items": [{ "id": "m1", "text": "A long reply, so " }] });
    let new = json!({ "items": [{ "id": "m1", "text": "A long reply, so far" }] });

    let ops = diff(&old, &new);

    let path = ["items", "m1", "text"].map(String::from).to_vec();
    let text = "far".to_owned();
    assert_eq!(ops, [Op::Append { path, text }]);
}

/// The name of a client's message, which no arm can be forgotten for.
fn client_name(message: &ClientMessage) -> &'static str {
    match message {
        ClientMessage::Hello { .. } => "hello",
        ClientMessage::Sub { .. } => "sub",
        ClientMessage::Unsub { .. } => "unsub",
        ClientMessage::Call { .. } => "call",
        ClientMessage::Resume { .. } => "resume",
    }
}

/// The names of a server's message and of what it holds, which no arm can be forgotten for.
fn server_names(message: &ServerMessage) -> Vec<&'static str> {
    match message {
        ServerMessage::Welcome { .. } => vec!["welcome"],
        ServerMessage::Refused { reason, .. } => vec![
            "refused",
            match reason {
                Refusal::ClientTooOld => "client-too-old",
                Refusal::ServerTooOld => "server-too-old",
                Refusal::NotSignedIn => "not-signed-in",
            },
        ],
        ServerMessage::Data { .. } => vec!["data"],
        ServerMessage::Change { ops, .. } => std::iter::once("change")
            .chain(ops.iter().map(|op| match op {
                Op::Set { .. } => "set",
                Op::Append { .. } => "append",
                Op::Insert { .. } => "insert",
                Op::Remove { .. } => "remove",
                Op::Move { .. } => "move",
            }))
            .collect(),
        ServerMessage::Result { .. } => vec!["result"],
        ServerMessage::Error { .. } => vec!["error"],
    }
}

/// Reads each example as a message, checks that it is written back as it was read, and gives the
/// names `names` finds in them.
fn survivors<M: DeserializeOwned + serde::Serialize>(
    examples: &[Value],
    names: impl Fn(&M) -> Vec<&'static str>,
) -> BTreeSet<&'static str> {
    let mut seen = BTreeSet::new();
    for example in examples {
        let message: M = serde_json::from_value(example.clone())
            .unwrap_or_else(|error| panic!("{example}: {error}"));
        assert_eq!(&json!(message), example);
        seen.extend(names(&message));
    }
    seen
}

// The break it catches: a field renamed on one side only, or a message with no example for the
// client's tests.
#[test]
fn every_message_survives_json() {
    let messages: Messages = fixture("messages.json");

    let client = survivors(&messages.client, |message| vec![client_name(message)]);
    let server = survivors(&messages.server, server_names);

    assert_eq!(
        client,
        BTreeSet::from(["call", "hello", "resume", "sub", "unsub"])
    );
    assert_eq!(
        server,
        BTreeSet::from([
            "append",
            "change",
            "client-too-old",
            "data",
            "error",
            "insert",
            "move",
            "not-signed-in",
            "refused",
            "remove",
            "result",
            "server-too-old",
            "set",
            "welcome",
        ])
    );
}

/// What `handshake` answers a first message that is not welcomed.
fn answer(first: &Value) -> Value {
    json!(handshake(&first.to_string()).unwrap_err())
}

// The break it catches: a client and a server of two versions that talk on, each reading the
// other's messages wrong.
#[test]
fn a_hello_of_another_version_is_refused_naming_the_side_to_update() {
    let hello = |protocol: u32| json!({ "type": "hello", "protocol": protocol, "signIn": { "by": "cookie" } });
    let refused =
        |reason: &str| json!({ "type": "refused", "reason": reason, "protocol": PROTOCOL });

    assert_eq!(
        handshake(&hello(PROTOCOL).to_string()).unwrap(),
        SignIn::Cookie
    );
    assert_eq!(answer(&hello(PROTOCOL - 1)), refused("client-too-old"));
    assert_eq!(answer(&hello(PROTOCOL + 1)), refused("server-too-old"));
    // A later version may sign in another way: it is refused all the same, not misread.
    let later = json!({ "type": "hello", "protocol": PROTOCOL + 1, "signIn": { "by": "passkey" } });
    assert_eq!(answer(&later), refused("server-too-old"));

    // Anything else first is an error, and no sign-in.
    let sub = json!({ "type": "sub", "id": 1, "record": "Workspace", "args": null });
    let ServerMessage::Error { code, id, .. } = handshake(&sub.to_string()).unwrap_err() else {
        panic!("a first message that is no hello is an error");
    };
    assert_eq!((code, id), (ErrorCode::NotSignedIn, None));
    let ServerMessage::Error { code, .. } = handshake("not JSON").unwrap_err() else {
        panic!("a first message that is no JSON is an error");
    };
    assert_eq!(code, ErrorCode::BadMessage);
}

// The break it catches: a reason an older client cannot draw, added without raising the version,
// so the handshake passes and the client throws on the value. A new reason fails to build here:
// raise `PROTOCOL` with it, and write it in this list.
#[test]
fn the_reasons_a_client_draws_are_those_of_its_version() {
    use uraeda_protocol::{NeedsYouReason as N, StatusReason as S};
    let status = |reason: S| match reason {
        S::Blocked
        | S::Step
        | S::Failed
        | S::Stopped
        | S::Interrupted
        | S::Halted
        | S::Conflict
        | S::Capped
        | S::Waiting
        | S::Continue => json!(reason),
    };
    let needs_you = |reason: N| match reason {
        N::Blocked | N::Attention | N::Step | N::PullRequest | N::Continue => json!(reason),
    };
    let statuses = [
        S::Blocked,
        S::Step,
        S::Failed,
        S::Stopped,
        S::Interrupted,
        S::Halted,
        S::Conflict,
        S::Capped,
        S::Waiting,
        S::Continue,
    ];
    let needs = [
        N::Blocked,
        N::Attention,
        N::Step,
        N::PullRequest,
        N::Continue,
    ];
    let seen = (
        PROTOCOL,
        statuses.map(status).to_vec(),
        needs.map(needs_you).to_vec(),
    );
    let reasons = |names: &str| names.split(' ').map(Value::from).collect::<Vec<_>>();
    assert_eq!(
        seen,
        (
            3,
            reasons(
                "blocked step failed stopped interrupted halted conflict capped waiting continue"
            ),
            reasons("blocked attention step pull-request continue"),
        )
    );
}
