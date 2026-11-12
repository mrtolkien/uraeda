//! The messages of the one WebSocket at `/live`, each a JSON object with its `type`.
//!
//! A receiver ignores a field it does not know, so a field can be added without a new version.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use ts_rs::TS;

use crate::change::Op;

/// The protocol's version. It rises with each change an older client or server cannot read: the
/// two sides of a connection have the same one, or refuse each other.
pub const PROTOCOL: u32 = 2;

/// What a client sends.
///
/// A `sub`, a `call`, and a `resume` carry an `id` the client picks, unique among the
/// subscriptions and the calls it has open on the connection: every answer names it.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, TS)]
#[serde(
    tag = "type",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum ClientMessage {
    /// The first message of a connection: the client's version, and how it signs in.
    Hello { protocol: u32, sign_in: SignIn },
    /// Subscribes to a record, by its name and its arguments: `data` answers, then `change`s.
    Sub {
        id: u32,
        record: String,
        #[serde(default)]
        args: Value,
    },
    /// Ends a subscription. Nothing answers.
    Unsub { id: u32 },
    /// Runs an action, by its name, on an input: `result` or `error` answers.
    Call {
        id: u32,
        action: String,
        #[serde(default)]
        input: Value,
    },
    /// Subscribes again to a record the client still holds, as of the change `seq` it last
    /// applied, under the `epoch` of the `welcome` it got it under: the `change`s after `seq`
    /// answer, or `data` when the server no longer has them.
    Resume {
        id: u32,
        record: String,
        #[serde(default)]
        args: Value,
        epoch: String,
        seq: u64,
    },
}

/// How a client signs in.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(tag = "by", content = "token", rename_all = "camelCase")]
pub enum SignIn {
    /// With the session cookie of the request that opened the connection, as a browser does.
    Cookie,
    /// With a paired device's token.
    Token(String),
}

/// What a server sends.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, TS)]
#[serde(
    tag = "type",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum ServerMessage {
    /// Answers a `hello`: the connection is open. `epoch` names this start of the server, and a
    /// sequence number means something under its own epoch only. `time_zone` is the server's zone,
    /// an IANA name ("Europe/Paris", "UTC" when the machine names none): every time a client shows
    /// reads in it, whatever the device's.
    Welcome {
        protocol: u32,
        epoch: String,
        time_zone: String,
    },
    /// Answers a `hello` the server turns down, with its own version. The server then closes the
    /// connection.
    Refused { reason: Refusal, protocol: u32 },
    /// A subscription's whole value, as of the change `seq`. It answers a `sub`, and comes again
    /// whenever the server cannot send the changes a client misses.
    Data { id: u32, seq: u64, value: Value },
    /// A subscription's next change, numbered one more than the one before it: operations to
    /// apply, in order, to the value the client holds.
    Change { id: u32, seq: u64, ops: Vec<Op> },
    /// A call's output.
    Result { id: u32, output: Value },
    /// What went wrong, with a `message` for a person to read: with the `id` of the `sub`,
    /// `call`, or `resume` it answers, or with none when it answers no message the server could
    /// read.
    Error {
        #[serde(default, skip_serializing_if = "Option::is_none")]
        id: Option<u32>,
        code: ErrorCode,
        message: String,
    },
}

/// Why a server turns a `hello` down.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "kebab-case")]
pub enum Refusal {
    /// The client's version is lower than the server's: update the client.
    ClientTooOld,
    /// The client's version is higher than the server's: update the server.
    ServerTooOld,
    /// The sign-in is not valid: the cookie's session or the device's token is unknown, or revoked.
    NotSignedIn,
}

/// What an `error` is about.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "kebab-case")]
pub enum ErrorCode {
    /// A message came before a `hello` that was welcomed.
    NotSignedIn,
    /// The message is not JSON, or not a message of this version.
    BadMessage,
    /// No record has this name.
    UnknownRecord,
    /// No action has this name.
    UnknownAction,
    /// The arguments are not the record's.
    BadArgs,
    /// The input is not the action's.
    BadInput,
    /// The server will not do it, as things are: the message says why.
    Refused,
    /// What the client acted on changed since it read it.
    Conflict,
    /// A git hook of the repository stopped it: the message holds the hook's output.
    Hook,
    /// The server failed.
    Internal,
}

/// Reads the first message of a connection: the sign-in to check when it is a `hello` of this
/// version, and otherwise the message to answer before closing.
///
/// A `hello` of another version is refused on its `type` and `protocol` alone, naming the side to
/// update: nothing else of it is read, since another version may write it another way.
///
/// # Errors
///
/// A `refused` for a `hello` of another version, and an `error` for anything else.
pub fn handshake(first: &str) -> Result<SignIn, ServerMessage> {
    let message: Value = serde_json::from_str(first).map_err(|error| bad_message(&error))?;
    if message["type"] != "hello" {
        return Err(ServerMessage::Error {
            id: None,
            code: ErrorCode::NotSignedIn,
            message: "the first message of a connection is `hello`".to_owned(),
        });
    }
    if let Some(reason) = message["protocol"].as_u64().and_then(refusal) {
        return Err(ServerMessage::Refused {
            reason,
            protocol: PROTOCOL,
        });
    }
    match serde_json::from_value(message) {
        Ok(ClientMessage::Hello { sign_in, .. }) => Ok(sign_in),
        Ok(_) => unreachable!("its type is `hello`"),
        Err(error) => Err(bad_message(&error)),
    }
}

/// Why a client of this version is refused, or nothing when it is the server's.
fn refusal(client: u64) -> Option<Refusal> {
    match client.cmp(&u64::from(PROTOCOL)) {
        std::cmp::Ordering::Less => Some(Refusal::ClientTooOld),
        std::cmp::Ordering::Equal => None,
        std::cmp::Ordering::Greater => Some(Refusal::ServerTooOld),
    }
}

/// The `error` for a message that could not be read.
fn bad_message(error: &serde_json::Error) -> ServerMessage {
    ServerMessage::Error {
        id: None,
        code: ErrorCode::BadMessage,
        message: error.to_string(),
    }
}
