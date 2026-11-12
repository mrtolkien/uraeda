//! A message's frame: text, or binary with its large part compressed, as the contract's
//! "Frames" says; and what a client refuses to inflate.

use std::io::Write as _;
use std::path::PathBuf;

use flate2::Compression;
use flate2::write::DeflateEncoder;
use serde::Deserialize;
use serde_json::{Value, json};
use uraeda_protocol::{
    CEILING, ErrorCode, Frame, Op, PACK_ABOVE, Refusal, ServerMessage, frame, unpack,
};

/// A text of `bytes` bytes, which compresses as a record's JSON does.
fn long(bytes: usize) -> String {
    "a decision's title, its summary, and its state; ".repeat(bytes / 48 + 1)[..bytes].to_owned()
}

/// What a client reads in a frame.
fn read(frame: &Frame) -> ServerMessage {
    let text = match frame {
        Frame::Text(text) => text.clone(),
        Frame::Binary(bytes) => unpack(bytes).expect("a frame the server wrote unpacks"),
    };
    serde_json::from_str(&text).expect("a server message")
}

// The break it catches: a record's first value sent whole as text, or read back another.
#[test]
fn a_long_part_is_compressed_and_reads_the_same() {
    let value = json!({ "id": "t7", "text": long(200_000) });
    let data = ServerMessage::Data {
        id: 1,
        seq: 40,
        value,
    };
    let sent = frame(&data);
    let Frame::Binary(bytes) = &sent else {
        panic!("a value past {PACK_ABOVE} bytes is a binary frame");
    };
    assert!(bytes.len() < 20_000, "{} bytes compressed", bytes.len());
    assert_eq!(read(&sent), data);

    // A call's long output, and a change that is more than appends, are compressed too.
    let output = json!([long(5_000)]);
    let result = ServerMessage::Result { id: 3, output };
    let set = ServerMessage::Change {
        id: 1,
        seq: 41,
        ops: vec![Op::Set {
            path: vec!["text".to_owned()],
            value: json!(long(5_000)),
        }],
    };
    for message in [result, set] {
        let sent = frame(&message);
        assert!(matches!(sent, Frame::Binary(_)), "{message:?}");
        assert_eq!(read(&sent), message);
    }
}

// The break it catches: a reply's pieces held up by a compression they do not need, or a
// refusal an older client cannot read.
#[test]
fn a_short_message_and_an_append_stay_text() {
    let appended = ServerMessage::Change {
        id: 1,
        seq: 41,
        ops: vec![Op::Append {
            path: vec!["items".to_owned(), "m2".to_owned(), "text".to_owned()],
            text: long(5_000),
        }],
    };
    let messages = [
        ServerMessage::Data {
            id: 1,
            seq: 40,
            value: json!({ "id": "t7", "text": long(PACK_ABOVE - 30) }),
        },
        appended,
        ServerMessage::Refused {
            reason: Refusal::ClientTooOld,
            protocol: 3,
        },
        ServerMessage::Error {
            id: Some(5),
            code: ErrorCode::Refused,
            message: long(5_000),
        },
    ];
    for message in messages {
        let sent = frame(&message);
        assert_eq!(
            sent,
            Frame::Text(serde_json::to_string(&message).unwrap()),
            "{message:?}"
        );
    }
}

/// A binary frame by hand: its head's text, then `body` compressed.
fn crafted(head: &str, body: &[u8]) -> Vec<u8> {
    let mut encoder = DeflateEncoder::new(Vec::new(), Compression::default());
    encoder.write_all(body).unwrap();
    let mut bytes = format!("{head}\n").into_bytes();
    bytes.extend(encoder.finish().unwrap());
    bytes
}

// The break it catches: a broken or hostile server that makes the app allocate without limit, or
// a frame the app cannot read that leaves a subscription waiting with no words.
#[test]
fn a_frame_past_its_size_or_the_ceiling_is_refused_naming_its_id() {
    let value = br#"{"text":"hello"}"#;
    let ok = crafted(r#"{"type":"data","id":7,"seq":2,"size":16}"#, value);
    assert_eq!(
        serde_json::from_str::<Value>(&unpack(&ok).unwrap()).unwrap(),
        json!({ "type": "data", "id": 7, "seq": 2, "value": { "text": "hello" } })
    );

    let rows = [
        (
            format!(r#"{{"type":"data","id":7,"seq":2,"size":{}}}"#, CEILING + 1),
            &value[..],
            "more than",
        ),
        (
            r#"{"type":"data","id":7,"seq":2,"size":4}"#.to_owned(),
            &value[..],
            "longer than",
        ),
        (
            r#"{"type":"data","id":7,"seq":2,"size":40}"#.to_owned(),
            &value[..],
            "shorter than",
        ),
        (
            r#"{"type":"data","id":7,"seq":2,"size":5}"#.to_owned(),
            &b"{oops"[..],
            "not JSON",
        ),
        (
            r#"{"type":"welcome","id":7,"size":16}"#.to_owned(),
            &value[..],
            "welcome",
        ),
    ];
    for (head, body, part) in rows {
        let refused = unpack(&crafted(&head, body)).unwrap_err();
        assert_eq!(refused.id, Some(7), "{head}");
        assert!(
            refused.why.contains(part),
            "`{}` has no `{part}`",
            refused.why
        );
    }
    // A frame with no head names nothing.
    let refused = unpack(b"\x00\x01\x02").unwrap_err();
    assert_eq!(refused.id, None);
}

/// The example of `fixtures/protocol/frames.json`, which the client's tests read too.
#[derive(Deserialize)]
struct Example {
    frame: Vec<u8>,
    message: Value,
}

// The break it catches: the server and the app reading one frame two ways.
#[test]
fn the_contracts_frame_reads_as_its_message() {
    let path =
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../fixtures/protocol/frames.json");
    let example: Example = serde_json::from_str(&std::fs::read_to_string(path).unwrap()).unwrap();

    let text = unpack(&example.frame).unwrap();

    assert_eq!(
        serde_json::from_str::<Value>(&text).unwrap(),
        example.message
    );
}
