//! The sandbox's sessions, written in its data folder's store as the runner leaves a finished
//! turn: the sample chats of `fixtures/sandbox/chats.json`, finished, failed, stopped, and stopped
//! by a usage limit; and on demand a chat of 20,000 messages, for the frame benchmarks.

use std::time::{Duration, SystemTime};

use serde::Deserialize;
use serde_json::Value;

use super::fixture_text;
use crate::runner::{
    Event, NewSession, NewTurn, Origin, Store, StoreError, TurnEnd, TurnKind, TurnState,
};

/// The title of the long chat, by which a sandbox finds whether it has one.
pub const LONG_CHAT: &str = "A very long chat";

/// The messages of the long chat: the human's and the agent's, one turn for two.
pub const LONG_CHAT_MESSAGES: usize = 20_000;

/// The sample chats, as their file holds them.
#[derive(Deserialize)]
struct Chats {
    chats: Vec<Chat>,
}

/// A sample chat: its message, and the events of the agent's turn.
#[derive(Deserialize)]
struct Chat {
    text: String,
    script: Vec<Value>,
}

/// Writes the sample chats of the project at `root`, its main checkout as the runner names it,
/// each a minute after the one before, from `at`.
pub(super) fn seed(store: &Store, root: &str, at: SystemTime) -> Result<(), String> {
    let chats: Chats = serde_json::from_str::<Value>(&fixture_text("sandbox/chats.json")?)
        .and_then(serde_json::from_value)
        .map_err(|error| format!("fixtures/sandbox/chats.json: {error}"))?;
    for (index, chat) in chats.chats.into_iter().enumerate() {
        let script = chat.script.into_iter().map(serde_json::from_value);
        let script: Vec<Event> = script
            .collect::<Result<_, _>>()
            .map_err(|error| format!("fixtures/sandbox/chats.json: {error}"))?;
        let at = at + Duration::from_secs(60 * u64::try_from(index).unwrap_or_default());
        let session = new_chat(store, root, Some(&chat.text), at)?;
        turn(store, &session, &chat.text, script, at).map_err(|error| error.to_string())?;
    }
    Ok(())
}

/// Writes the long chat of the project at `root`: 10,000 turns, each a question and its reply.
pub(super) fn long_chat(store: &Store, root: &str, at: SystemTime) -> Result<(), String> {
    let session = new_chat(store, root, Some(LONG_CHAT), at)?;
    for index in 0..LONG_CHAT_MESSAGES / 2 {
        let reply = format!(
            "Reply {index}: the sandbox's long chat holds {LONG_CHAT_MESSAGES} messages, so a \
             transcript can be scrolled from its end to its start."
        );
        let at = at + Duration::from_millis(u64::try_from(index).unwrap_or_default() * 500);
        let script = vec![Event::Text { text: reply }];
        turn(store, &session, &format!("Question {index}"), script, at)
            .map_err(|error| error.to_string())?;
    }
    Ok(())
}

/// Whether the store holds the long chat.
pub(super) fn has_long_chat(store: &Store, root: &str) -> Result<bool, String> {
    let sessions = store
        .sessions_of(root, u32::MAX, Some(LONG_CHAT))
        .map_err(|error| error.to_string())?;
    Ok(sessions
        .iter()
        .any(|session| session.title.as_deref() == Some(LONG_CHAT)))
}

/// A new chat of the fake agent.
fn new_chat(
    store: &Store,
    root: &str,
    title: Option<&str>,
    at: SystemTime,
) -> Result<String, String> {
    let made = store.create_session(
        NewSession {
            repo: root.to_owned(),
            folder: None,
            parent: None,
            role: None,
            step: None,
            worktree: None,
            agent: "fake".to_owned(),
            native_id: format!("sandbox-{}", uuid_like(at)),
            title: title.map(str::to_owned),
            model: None,
            effort: None,
        },
        at,
    );
    made.map(|session| session.id)
        .map_err(|error| error.to_string())
}

/// A native id that differs for each chat: its time.
fn uuid_like(at: SystemTime) -> u128 {
    at.duration_since(SystemTime::UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos()
}

/// A finished chat turn: the human's message, read, the agent's events, and its `result`, ended
/// as the result says, a second after it started.
fn turn(
    store: &Store,
    session: &str,
    text: &str,
    mut events: Vec<Event>,
    at: SystemTime,
) -> Result<(), StoreError> {
    let new = NewTurn {
        session_id: session.to_owned(),
        kind: TurnKind::Chat,
        trigger: None,
        step: None,
        allowed: None,
        caught_up_to: None,
        state: TurnState::Running,
    };
    let id = store.add_turn(new, at)?;
    let message = format!("{session}-{id}");
    let mut log = vec![
        Event::Message {
            id: message.clone(),
            origin: Origin::Human,
            text: text.to_owned(),
            opening: None,
            images: Vec::new(),
        },
        Event::Accepted { id: message },
    ];
    if !events
        .iter()
        .any(|event| matches!(event, Event::Result { .. }))
    {
        events.push(Event::Result {
            cost_usd: None,
            denials: Vec::new(),
            errors: Vec::new(),
            interrupted: false,
            models: None,
            ok: true,
        });
    }
    log.append(&mut events);
    let mut end = TurnEnd::of(TurnState::Done);
    for event in &log {
        if let Event::Result {
            errors,
            interrupted,
            ok: false,
            ..
        } = event
        {
            end = match (interrupted, errors.first()) {
                (true, _) => TurnEnd::of(TurnState::Stopped),
                (false, Some(error)) => TurnEnd::because(TurnState::Failed, error.clone()),
                (false, None) => TurnEnd::of(TurnState::Failed),
            };
        }
        store.append(id, at, event)?;
    }
    store.end_turn(id, &end, at + Duration::from_secs(1))
}
