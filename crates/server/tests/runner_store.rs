//! The session store, `sessions.sqlite`: a turn's transcript as an append-only log, the schema's
//! number, and the one-time import of the Node server's `runner.sqlite`.
//!
//! The old store of these tests is `fixtures/runner/old.sqlite`, which the Node server's own
//! store wrote, and which is frozen since that store went: see `fixtures/runner/README.md`.
//! Each test imports a copy of it, in a temporary folder.

use crate::support;

use std::fs;
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime};

use serde_json::{Map, Value, json};
use tempfile::TempDir;
use uraeda_server::runner::{
    self, Activity, Appended, BackgroundKind, BackgroundTask, ChatImage, ContinueReason, Denial,
    Event, Growth, ImportError, Imported, Importing, Limit, LimitKind, Logged, NewSession, NewTurn,
    Origin, Replace, Session, Store, StoreError, Subagent, TokenCounts, ToolKind, Turn, TurnKind,
    TurnState, UsageWindow,
};

/// 2026-11-01 at 00:00 UTC, in seconds: the day the old store was written on.
const DAY: u64 = 1_793_491_200;

/// A time of that day, to the millisecond.
fn at(hours: u64, minutes: u64, seconds: u64, millis: u64) -> SystemTime {
    let seconds = DAY + hours * 3600 + minutes * 60 + seconds;
    SystemTime::UNIX_EPOCH + Duration::from_millis(seconds * 1000 + millis)
}

/// The milliseconds of a time since 1970, as a log's JSON below shows it.
fn millis(time: SystemTime) -> u64 {
    let since = time.duration_since(SystemTime::UNIX_EPOCH).unwrap();
    u64::try_from(since.as_millis()).unwrap()
}

/// A new chat's fields.
fn chat() -> NewSession {
    NewSession {
        repo: "/home/sample/todo".to_owned(),
        folder: None,
        parent: None,
        role: None,
        step: None,
        worktree: None,
        agent: "fake".to_owned(),
        native_id: "native".to_owned(),
        title: Some("Où est le réglage ?".to_owned()),
        model: Some("opus".to_owned()),
        effort: None,
    }
}

/// A new running chat turn of a session.
fn turn_of(session: &Session) -> NewTurn {
    NewTurn {
        session_id: session.id.clone(),
        kind: TurnKind::Chat,
        trigger: None,
        step: None,
        allowed: None,
        caught_up_to: None,
        state: TurnState::Running,
    }
}

/// A store with one session and one running turn.
fn started(folder: &Path) -> (Store, Session, i64) {
    let store = Store::open(folder).unwrap();
    let session = store.create_session(chat(), at(9, 0, 0, 0)).unwrap();
    let turn = store.add_turn(turn_of(&session), at(9, 0, 1, 0)).unwrap();
    // As the turn left it: a turn's start updates its session.
    let session = store.session(&session.id).unwrap().expect("the session");
    (store, session, turn)
}

fn object(value: Value) -> Map<String, Value> {
    value.as_object().expect("an object").clone()
}

fn text(text: &str) -> Event {
    Event::Text {
        text: text.to_owned(),
    }
}

fn delta(text: &str) -> Event {
    Event::TextDelta {
        text: text.to_owned(),
    }
}

/// One event of each kind, with every optional field given, and text outside ASCII.
fn every_kind() -> Vec<Event> {
    let mut events = written_in_the_transcript();
    events.extend(read_by_the_runner());
    events
}

/// The events a transcript shows: a message and what became of it, the agent's lines, thoughts,
/// tool calls, and texts.
fn written_in_the_transcript() -> Vec<Event> {
    vec![
        Event::Init {
            session_id: "native-1".to_owned(),
            problem: Some("The Uraeda skill did not load.".to_owned()),
        },
        Event::RunsOn {
            model: "Opus 5".to_owned(),
            effort: Some("High".to_owned()),
        },
        Event::Message {
            id: "message-1".to_owned(),
            origin: Origin::Human,
            text: "Où est le réglage ? 🎉".to_owned(),
            opening: Some("A human is chatting with you.".to_owned()),
            images: vec![ChatImage {
                height: 600,
                id: "11111111-2222-4333-8444-555555555555.webp".to_owned(),
                width: 800,
            }],
        },
        Event::Accepted {
            id: "message-1".to_owned(),
        },
        Event::Cancelled {
            id: "message-2".to_owned(),
        },
        Event::Notice {
            text: "Started a new session.".to_owned(),
        },
        Event::Activity {
            activity: Activity::Thinking,
        },
        Event::Activity {
            activity: Activity::Tool {
                name: "Bash".to_owned(),
                target: Some("cargo test".to_owned()),
            },
        },
        Event::Thought {
            parent: Some("tool-1".to_owned()),
            text: Some("質問は三つです".to_owned()),
        },
        Event::ToolStart {
            id: "tool-1".to_owned(),
            input: object(json!({ "command": "cargo test", "timeout": 30 })),
            kind: ToolKind::Execute,
            name: "Bash".to_owned(),
            parent: Some("tool-0".to_owned()),
            subagent: Some(Subagent {
                description: "Run the tests".to_owned(),
            }),
            target: Some("cargo test".to_owned()),
        },
        Event::ToolEnd {
            id: "tool-1".to_owned(),
            is_error: true,
            output: "error: no such file\n".to_owned(),
        },
        delta("Bon"),
        text("Bonjour"),
    ]
}

/// The events the runner reads and acts on: retries, usage, limits, results, and the process's
/// end, with a blocked action and its allowing.
fn read_by_the_runner() -> Vec<Event> {
    vec![
        Event::Retry {
            attempt: 2,
            delay_ms: 12_000,
            error: "rate_limit".to_owned(),
        },
        Event::Usage {
            windows: vec![UsageWindow {
                id: "five-hours".to_owned(),
                label: "5 hours".to_owned(),
                resets_at: "2026-11-01T14:00:00.000Z".to_owned(),
                used: 0.75,
            }],
        },
        Event::Background {
            tasks: vec![BackgroundTask {
                kind: BackgroundKind::Command,
                tool: "tool-1".to_owned(),
            }],
        },
        Event::Limit {
            limit: Limit {
                kind: LimitKind::Session,
                resets_at: Some("2026-11-01T14:00:00.000Z".to_owned()),
                text: Some("You've hit your session limit.".to_owned()),
            },
        },
        Event::Wakeup {
            at: "2026-11-01T10:00:00.000Z".to_owned(),
        },
        Event::Tokens {
            total: TokenCounts {
                cache_read: 9000,
                cache_write: 1200,
                input: 340,
                output: 5600,
            },
        },
        Event::Denial {
            tool: "Edit".to_owned(),
            target: Some("src/settings.rs".to_owned()),
            rule: Some("Edit(src/settings.rs)".to_owned()),
        },
        Event::Allowed { denial: 19 },
        Event::Result {
            cost_usd: Some(0.25),
            denials: vec![Denial {
                input: object(json!({ "file_path": "src/settings.rs" })),
                tool: "Edit".to_owned(),
            }],
            errors: vec!["The API failed.".to_owned()],
            interrupted: false,
            models: Some(vec!["claude-opus-5".to_owned()]),
            ok: false,
        },
        Event::Skipped,
        Event::Exit {
            code: None,
            missing: Some(true),
            stderr: "claude: command not found".to_owned(),
        },
    ]
}

/// The events of a log, without their places and times.
fn events(log: &[Logged]) -> Vec<Event> {
    log.iter().map(|logged| logged.event.clone()).collect()
}

// The stored format: what is appended to a turn is what its log gives back, in the order it was
// appended, after the store closed and opened again.
#[test]
fn a_transcript_reads_back_as_it_was_written() {
    let folder = TempDir::new().unwrap();
    let (store, session, turn) = started(folder.path());
    let other = store.add_turn(turn_of(&session), at(9, 5, 0, 0)).unwrap();
    let written = every_kind();
    for (place, event) in written.iter().enumerate() {
        let time = at(9, 0, 2, place as u64);
        let appended = store.append(turn, time, event).unwrap();
        assert_eq!(appended.seq, place as u64, "{event:?} takes the next place");
    }
    store.append(other, at(9, 5, 1, 0), &text("Autre")).unwrap();
    let nowhere = store.append(turn + other, at(9, 5, 2, 0), &text("Perdu"));
    assert!(nowhere.is_err(), "an event belongs to a turn");
    store.close();

    let store = Store::open(folder.path()).unwrap();
    let log = store.log(turn, 0).unwrap();

    assert_eq!(events(&log), written, "every event, in its order");
    for (place, logged) in log.iter().enumerate() {
        assert_eq!(logged.seq, place as u64);
        assert_eq!(logged.at, at(9, 0, 2, place as u64));
    }
    assert_eq!(
        store.log(turn, 20).unwrap(),
        log[20..],
        "a log from a place"
    );
    assert_eq!(store.log(turn, 99).unwrap(), [], "past its end");
    assert_eq!(events(&store.log(other, 0).unwrap()), [text("Autre")]);
    // Its latest turn's start is its last change.
    let updated = Session {
        updated_at: at(9, 5, 0, 0),
        ..session.clone()
    };
    assert_eq!(store.session(&session.id).unwrap(), Some(updated));
    assert_eq!(store.session("no-such-session").unwrap(), None);
    let turns = store.turns(&session.id).unwrap();
    assert_eq!(
        turns.iter().map(|turn| turn.id).collect::<Vec<_>>(),
        [turn, other]
    );
    assert_eq!(
        turns[0],
        Turn {
            id: turn,
            session_id: session.id.clone(),
            kind: TurnKind::Chat,
            trigger: None,
            step: None,
            allowed: None,
            caught_up_to: None,
            state: TurnState::Running,
            reason: None,
            started_at: Some(at(9, 0, 1, 0)),
            ended_at: None,
            dismissed_at: None,
            continue_at: None,
            continue_reason: None,
            tokens: None,
        }
    );
}

// What `Bus::append` needs of a growing text, without a read: where the text started, and how
// long it was, in bytes, before each piece.
#[test]
fn a_piece_of_text_says_where_its_text_started_and_how_long_it_was() {
    let folder = TempDir::new().unwrap();
    let (store, _, turn) = started(folder.path());
    let add = |event: &Event| store.append(turn, at(9, 0, 2, 0), event).unwrap();
    let grew = |seq, start, at| Appended {
        seq,
        text: Some(Growth { start, at }),
    };
    let tool = Event::ToolEnd {
        id: "tool-1".to_owned(),
        is_error: false,
        output: "done".to_owned(),
    };

    assert_eq!(
        add(&text("Whole.")).text,
        None,
        "a whole text grows nothing"
    );
    assert_eq!(add(&delta("Où ")), grew(1, 1, 0));
    assert_eq!(
        add(&delta("est 質問")),
        grew(2, 1, 4),
        "bytes, not characters"
    );
    // Another event between two pieces does not end the text.
    assert_eq!(add(&tool).text, None);
    assert_eq!(add(&delta(" ?")), grew(4, 1, 14));
    assert_eq!(add(&text("Où est 質問 ?")).text, None);
    assert_eq!(
        add(&delta("Next")),
        grew(6, 6, 0),
        "a new text after a whole one"
    );

    // The length is the log's, not this process's memory.
    store.close();
    let store = Store::open(folder.path()).unwrap();
    let again = store.append(turn, at(9, 0, 3, 0), &delta(" one")).unwrap();
    assert_eq!(again, grew(7, 6, 4));
}

/// A small generator of the same numbers at each run.
struct Random(u64);

impl Random {
    fn next(&mut self) -> u64 {
        self.0 ^= self.0 << 13;
        self.0 ^= self.0 >> 7;
        self.0 ^= self.0 << 17;
        self.0
    }

    fn below(&mut self, limit: u64) -> u64 {
        self.next() % limit
    }

    /// A short text, with characters of one to four bytes.
    fn text(&mut self) -> String {
        const PIECES: [&str; 6] = ["a", "é", "質", "🎉", " ", "\n"];
        (0..self.below(6))
            .map(|_| PIECES[self.below(6) as usize])
            .collect()
    }

    /// An event, half of them a text or a piece of one.
    fn event(&mut self) -> Event {
        let all = every_kind();
        match self.below(4) {
            0 => delta(&self.text()),
            1 => text(&self.text()),
            _ => all[self.below(all.len() as u64) as usize].clone(),
        }
    }
}

/// What a reader of the log expects of a piece appended after `before`: the place of the first
/// piece since the last whole text, and the bytes of the pieces since.
fn growth(before: &[Event]) -> Growth {
    let whole = before
        .iter()
        .rposition(|event| matches!(event, Event::Text { .. }));
    let from = whole.map_or(0, |place| place + 1);
    let pieces = before[from..]
        .iter()
        .enumerate()
        .filter_map(|(place, event)| match event {
            Event::TextDelta { text } => Some((from + place, text.len())),
            _ => None,
        });
    let pieces: Vec<_> = pieces.collect();
    Growth {
        start: pieces.first().map_or(before.len(), |(place, _)| *place) as u64,
        at: pieces.iter().map(|(_, bytes)| *bytes as u64).sum(),
    }
}

// Any sequence of events, on several turns at once, reads back equal after a close, a log from a
// place is the end of the whole log, and each piece of text knew its text's length.
#[test]
fn any_sequence_of_events_reads_back_equal_and_a_log_from_a_place_is_its_tail() {
    for seed in 1..=20_u64 {
        let mut random = Random(seed.wrapping_mul(0x9E37_79B9_7F4A_7C15));
        let folder = TempDir::new().unwrap();
        let (store, session, first) = started(folder.path());
        let second = store.add_turn(turn_of(&session), at(9, 0, 1, 0)).unwrap();
        let turns = [first, second];
        let mut written: [Vec<Event>; 2] = [Vec::new(), Vec::new()];
        for step in 0..random.below(60) {
            let which = random.below(2) as usize;
            let event = random.event();
            let appended = store
                .append(turns[which], at(10, 0, 0, step), &event)
                .unwrap();
            let expected =
                matches!(event, Event::TextDelta { .. }).then(|| growth(&written[which]));
            assert_eq!(appended.text, expected, "seed {seed}, step {step}");
            written[which].push(event);
        }
        store.close();

        let store = Store::open(folder.path()).unwrap();
        for (turn, written) in turns.iter().zip(&written) {
            let log = store.log(*turn, 0).unwrap();
            assert_eq!(&events(&log), written, "seed {seed}");
            let from = random.below(written.len() as u64 + 2);
            let tail = log.iter().skip(from as usize).cloned().collect::<Vec<_>>();
            assert_eq!(store.log(*turn, from).unwrap(), tail, "seed {seed}");
        }
    }
}

// A store written by a later version is not this version's to read or to change: it is refused,
// and its file keeps every byte.
#[test]
fn a_store_of_a_newer_schema_is_refused_untouched() {
    let folder = TempDir::new().unwrap();
    let (store, session, _) = started(folder.path());
    store.close();
    let file = folder.path().join(runner::FILE);
    let known: u32 = {
        let later = rusqlite::Connection::open(&file).unwrap();
        let known = later
            .query_row("PRAGMA user_version", [], |row| row.get(0))
            .unwrap();
        later
            .pragma_update(None, "user_version", known + 1)
            .unwrap();
        known
    };
    let before = fs::read(&file).unwrap();

    let refused = Store::open(folder.path()).err().expect("a refusal");

    assert!(
        matches!(refused, StoreError::Newer { found, known: read, .. }
            if found == known + 1 && read == known),
        "{refused}"
    );
    assert_eq!(
        refused.to_string(),
        format!(
            "{} was written by a newer Uraeda (schema {}, this one reads {known}): it is left as it is",
            file.display(),
            known + 1
        )
    );
    assert_eq!(fs::read(&file).unwrap(), before, "every byte is kept");

    // Once it is this version's again, nothing of it was lost.
    rusqlite::Connection::open(&file)
        .unwrap()
        .pragma_update(None, "user_version", known)
        .unwrap();
    let store = Store::open(folder.path()).unwrap();
    assert_eq!(store.session(&session.id).unwrap(), Some(session));
}

/// A Node server's data folder, in a temporary folder: the fixture as its `runner.sqlite`, and
/// the one image its messages hold.
fn old_data() -> TempDir {
    let folder = TempDir::new().unwrap();
    let fixture = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../fixtures/runner/old.sqlite");
    fs::copy(fixture, folder.path().join("runner.sqlite")).unwrap();
    fs::create_dir(folder.path().join("images")).unwrap();
    fs::write(folder.path().join("images").join(IMAGE), b"an image").unwrap();
    folder
}

/// The image a message of the old store holds.
const IMAGE: &str = "11111111-2222-4333-8444-555555555555.webp";

/// The old store's sessions, by the order they were made in.
fn id(number: u32) -> String {
    format!("00000000-0000-4000-8000-{number:012}")
}

/// A turn's log as JSON: each event with its place and its time in milliseconds.
fn log_of(store: &Store, turn: i64) -> Value {
    let lines = store.log(turn, 0).unwrap().into_iter().map(|logged| {
        let mut line = object(serde_json::to_value(&logged.event).unwrap());
        line.insert("seq".to_owned(), json!(logged.seq));
        line.insert("at".to_owned(), json!(millis(logged.at)));
        Value::Object(line)
    });
    Value::Array(lines.collect())
}

/// The kinds of a turn's events, in order.
fn kinds(store: &Store, turn: i64) -> Vec<String> {
    let log = log_of(store, turn);
    let kinds = log.as_array().unwrap().iter();
    kinds
        .map(|line| line["type"].as_str().unwrap().to_owned())
        .collect()
}

/// The milliseconds of a time of the old store's day.
fn ms(hours: u64, minutes: u64, seconds: u64, millis_: u64) -> u64 {
    millis(at(hours, minutes, seconds, millis_))
}

/// The feature's session of the old store, as it is imported.
fn feature_session() -> Session {
    Session {
        id: id(1),
        repo: "/home/sample/todo".to_owned(),
        folder: Some("2026-10-06-recurring-tasks".to_owned()),
        parent: None,
        role: None,
        step: Some("spec".to_owned()),
        worktree: None,
        agent: "claude".to_owned(),
        native_id: "native-spec".to_owned(),
        title: None,
        model: Some("opus".to_owned()),
        effort: Some("high".to_owned()),
        ran_model: Some("Opus 5".to_owned()),
        ran_effort: Some("High".to_owned()),
        continues: 2,
        account: Some("/home/sample/.claude-b".to_owned()),
        created_at: at(9, 0, 0, 0),
        updated_at: at(9, 0, 26, 0),
        seen_at: None,
        archived_at: None,
    }
}

/// A turn with nothing but what every turn has.
fn plain(id: i64, session: u32, kind: TurnKind, state: TurnState) -> Turn {
    Turn {
        id,
        session_id: self::id(session),
        kind,
        trigger: None,
        step: None,
        allowed: None,
        caught_up_to: None,
        state,
        reason: None,
        started_at: None,
        ended_at: None,
        dismissed_at: None,
        continue_at: None,
        continue_reason: None,
        tokens: None,
    }
}

/// The turns of the old store's feature session, as they are imported.
fn feature_turns() -> Vec<Turn> {
    vec![
        Turn {
            trigger: Some("start".to_owned()),
            step: Some("discovery".to_owned()),
            started_at: Some(at(9, 0, 1, 0)),
            ended_at: Some(at(9, 0, 11, 0)),
            tokens: Some(TokenCounts {
                cache_read: 9000,
                cache_write: 1200,
                input: 340,
                output: 5600,
            }),
            ..plain(1, 1, TurnKind::Workflow, TurnState::Done)
        },
        Turn {
            reason: Some("Claude Code ended the turn with an error.".to_owned()),
            started_at: Some(at(9, 0, 12, 0)),
            ended_at: Some(at(9, 0, 19, 0)),
            ..plain(2, 1, TurnKind::Chat, TurnState::Failed)
        },
        Turn {
            allowed: Some("Bash(cargo test)".to_owned()),
            caught_up_to: Some("0123456789abcdef0123456789abcdef01234567".to_owned()),
            reason: Some("Stopped: the server stopped while it ran.".to_owned()),
            started_at: Some(at(9, 0, 20, 0)),
            ended_at: Some(at(9, 0, 24, 0)),
            dismissed_at: Some(at(9, 0, 25, 0)),
            ..plain(3, 1, TurnKind::Allow, TurnState::Stopped)
        },
        // The Node server's stop cut the turn before, and the human dismissed it: it stays as
        // it was. This one waited behind another turn there: here it is stopped, at its last
        // event.
        Turn {
            trigger: Some("answers".to_owned()),
            step: Some("spec".to_owned()),
            reason: Some(runner::IMPORTED.to_owned()),
            ended_at: Some(at(9, 20, 0, 0)),
            ..plain(4, 1, TurnKind::Workflow, TurnState::Stopped)
        },
    ]
}

/// The log of the old store's first turn, as it is imported: every kind of item the agent's work
/// leaves.
fn discovery_log() -> Value {
    json!([
        { "seq": 0, "at": ms(9, 0, 2, 0), "type": "notice",
          "text": "Started a new session: the agent cleared the turns above." },
        { "seq": 1, "at": ms(9, 0, 2, 500), "type": "message", "id": "message-start",
          "origin": "workflow", "opening": "A human is chatting with you about the feature.",
          "text": "/uraeda Continue the feature specs/2026-10-06-recurring-tasks/" },
        { "seq": 2, "at": ms(9, 0, 2, 500), "type": "accepted", "id": "message-start" },
        // A thought of 2.3 s: its start, then the thought.
        { "seq": 3, "at": ms(9, 0, 1, 700), "type": "activity",
          "activity": { "kind": "thinking" } },
        { "seq": 4, "at": ms(9, 0, 4, 0), "type": "thought",
          "text": "Les tâches récurrentes : faut-il une règle par fuseau horaire ?" },
        { "seq": 5, "at": ms(9, 0, 5, 0), "type": "toolStart", "id": "tool-read",
          "input": {}, "kind": "read", "name": "Read", "target": "specs/PRIORITIES.md" },
        { "seq": 6, "at": ms(9, 0, 5, 40), "type": "toolEnd", "id": "tool-read",
          "isError": false, "output": "# Priorities\n\n- Recurring tasks\n" },
        { "seq": 7, "at": ms(9, 0, 6, 0), "type": "toolStart", "id": "tool-agent",
          "input": {}, "kind": "think", "name": "Agent",
          "subagent": { "description": "Read the parser" } },
        { "seq": 8, "at": ms(9, 0, 7, 0), "type": "toolStart", "id": "tool-bash",
          "input": {}, "kind": "execute", "name": "Bash", "parent": "tool-agent",
          "target": "cat src/parser.rs" },
        { "seq": 9, "at": ms(9, 0, 8, 0), "type": "thought", "parent": "tool-agent" },
        { "seq": 10, "at": ms(9, 0, 8, 200), "type": "toolEnd", "id": "tool-bash",
          "isError": true, "output": "error: no such file" },
        { "seq": 11, "at": ms(9, 0, 9, 0), "type": "notice",
          "text": "Rate limited, retrying in 12 s." },
        { "seq": 12, "at": ms(9, 0, 10, 0), "type": "text",
          "text": "Trois questions vous attendent — 質問は三つです 🎉" },
        // The sub-agent's call lasted 61 s: it ends after everything that started meanwhile.
        { "seq": 13, "at": ms(9, 1, 7, 0), "type": "toolEnd", "id": "tool-agent",
          "isError": false, "output": "The parser has no rule for a month's last day." },
    ])
}

/// The log of the old store's second turn: messages read and taken back, with an image, and the
/// blocked actions, one of them allowed since.
fn chat_log() -> Value {
    json!([
        { "seq": 0, "at": ms(9, 10, 0, 0), "type": "message", "id": "message-chat",
          "origin": "human", "text": "Où est le réglage ? Voir l'image.",
          "images": [{ "height": 600, "id": IMAGE, "width": 800 }] },
        { "seq": 1, "at": ms(9, 10, 0, 0), "type": "accepted", "id": "message-chat" },
        { "seq": 2, "at": ms(9, 10, 30, 0), "type": "message", "id": "message-steer",
          "origin": "human", "text": "Never mind." },
        { "seq": 3, "at": ms(9, 10, 30, 0), "type": "cancelled", "id": "message-steer" },
        { "seq": 4, "at": ms(9, 0, 15, 0), "type": "text",
          "text": "I need to change two files." },
        // It still waits to be allowed, with the rule that allows it.
        { "seq": 5, "at": ms(9, 0, 16, 0), "type": "denial", "tool": "Edit",
          "target": "src/settings.rs", "rule": "Edit(src/settings.rs)" },
        { "seq": 6, "at": ms(9, 0, 17, 0), "type": "denial", "tool": "Bash",
          "target": "cargo test", "rule": "Bash(cargo test)" },
        { "seq": 7, "at": ms(9, 0, 18, 0), "type": "denial", "tool": "WebFetch" },
        { "seq": 8, "at": ms(9, 0, 17, 0), "type": "allowed", "denial": 6 },
    ])
}

// The stored format's one change: every session, turn, and line of the Node server's store is in
// the new one, under the same ids, and nothing that ran or waited there runs here.
#[test]
fn an_old_store_imports_with_every_session_and_event() {
    let (old, new) = (old_data(), TempDir::new().unwrap());
    let store = Importing::open(new.path()).unwrap();

    let imported = runner::import(old.path(), &store, at(12, 0, 0, 0), Replace::No).unwrap();

    assert_eq!(
        imported,
        Imported {
            sessions: 4,
            turns: 9,
            events: 40,
            unread: 0,
            stopped: 3,
            continues: 1,
            images: 1,
            job_runs: 4,
        }
    );
    assert_eq!(store.session(&id(1)).unwrap(), Some(feature_session()));
    assert_eq!(store.turns(&id(1)).unwrap(), feature_turns());
    assert_eq!(log_of(&store, 1), discovery_log());
    assert_eq!(log_of(&store, 2), chat_log());
    // Cut mid-stream: a message read, a tool call with no end, and a text with no whole.
    assert_eq!(
        log_of(&store, 3),
        json!([
            { "seq": 0, "at": ms(9, 0, 21, 0), "type": "message", "id": "message-allow",
              "origin": "human",
              "text": "Try the blocked action again, now allowed: Bash cargo test" },
            { "seq": 1, "at": ms(9, 0, 21, 0), "type": "accepted", "id": "message-allow" },
            { "seq": 2, "at": ms(9, 0, 22, 0), "type": "toolStart", "id": "tool-test",
              "input": {}, "kind": "execute", "name": "Bash", "target": "cargo test" },
            { "seq": 3, "at": ms(9, 0, 23, 0), "type": "textDelta",
              "text": "Running the tests, the fir" },
        ])
    );
    // A message the agent never read stays pending.
    assert_eq!(kinds(&store, 4), ["notice", "message"]);

    // The image a message holds comes with it.
    let image = new.path().join("images").join(IMAGE);
    assert_eq!(fs::read(image).unwrap(), b"an image");
}

// What the import keeps of where a session is, and what it changes on purpose: nothing that ran
// or waited in the Node server runs or continues by itself in this one.
#[test]
fn an_imported_session_keeps_its_place_and_runs_nothing_by_itself() {
    let (old, new) = (old_data(), TempDir::new().unwrap());
    let store = Importing::open(new.path()).unwrap();
    runner::import(old.path(), &store, at(12, 0, 0, 0), Replace::No).unwrap();

    // The sub-session keeps its parent, its role, and its worktree.
    let sub = store.session(&id(2)).unwrap().expect("the sub-session");
    assert_eq!(
        (sub.parent, sub.role.as_deref(), sub.title.as_deref()),
        (Some(id(1)), Some("implementer"), Some("Task 3: the parser"))
    );
    assert_eq!(
        (
            sub.agent.as_str(),
            sub.model.as_deref(),
            sub.step.as_deref()
        ),
        ("codex", Some("gpt-6"), Some("build"))
    );
    assert_eq!(
        sub.worktree.as_deref(),
        Some("/home/sample/todo/.worktrees/2026-10-06-recurring-tasks-task-3")
    );
    let built = store.turns(&id(2)).unwrap();
    assert_eq!(kinds(&store, 5), ["text"]);
    assert_eq!(kinds(&store, 6), ["notice"]);
    // Its continue waited for the Node server's timer: no server continues it twice.
    assert_eq!(
        built[1],
        Turn {
            trigger: Some("next-step".to_owned()),
            step: Some("implementation".to_owned()),
            reason: Some("You've hit your session limit.".to_owned()),
            started_at: Some(at(9, 0, 33, 0)),
            ended_at: Some(at(9, 0, 35, 0)),
            ..plain(6, 2, TurnKind::Workflow, TurnState::Failed)
        }
    );

    // The Node server's stop cut it, and its next start would continue it: not this server too.
    assert_eq!(
        built[2],
        Turn {
            trigger: Some("manual".to_owned()),
            step: Some("implementation".to_owned()),
            reason: Some(runner::IMPORTED.to_owned()),
            started_at: Some(at(9, 0, 46, 0)),
            ended_at: Some(at(9, 0, 48, 0)),
            ..plain(9, 2, TurnKind::Workflow, TurnState::Stopped)
        }
    );
    assert_eq!(kinds(&store, 9), ["text"]);

    // The chat keeps its title, and when it was seen and archived.
    let chat = store.session(&id(3)).unwrap().expect("the chat");
    assert_eq!(
        (chat.folder, chat.title.as_deref()),
        (None, Some("Où est le réglage ?"))
    );
    assert_eq!(
        (chat.seen_at, chat.archived_at),
        (Some(at(9, 45, 0, 0)), Some(at(10, 0, 0, 0)))
    );
    // A run past its cap keeps why it would have continued.
    let capped = &store.turns(&id(3)).unwrap()[0];
    assert_eq!(
        (capped.continue_at, capped.continue_reason),
        (None, Some(ContinueReason::Restart))
    );
    assert_eq!(
        log_of(&store, 7),
        json!([
            { "seq": 0, "at": ms(9, 30, 0, 0), "type": "message", "id": "message-question",
              "origin": "human", "text": "Où est le réglage ?" },
            { "seq": 1, "at": ms(9, 30, 0, 0), "type": "accepted", "id": "message-question" },
            { "seq": 2, "at": ms(9, 0, 38, 100), "type": "activity",
              "activity": { "kind": "thinking" } },
            { "seq": 3, "at": ms(9, 0, 39, 0), "type": "thought" },
            { "seq": 4, "at": ms(9, 0, 40, 0), "type": "text", "text": "Dans Réglages › Thème." },
        ])
    );

    // A turn that ran in the Node server is stopped here: that server may still run it.
    let ran = &store.turns(&id(4)).unwrap()[0];
    assert_eq!(
        (ran.state, ran.reason.as_deref(), ran.ended_at),
        (
            TurnState::Stopped,
            Some(runner::IMPORTED),
            Some(at(9, 40, 0, 0))
        )
    );
    assert_eq!(kinds(&store, 8), ["message", "accepted", "textDelta"]);
}

/// Every file of a folder, with its bytes.
fn files(folder: &Path) -> Vec<(PathBuf, Vec<u8>)> {
    let mut files: Vec<_> = fs::read_dir(folder)
        .unwrap()
        .map(|entry| entry.unwrap().path())
        .filter(|path| path.is_file())
        .map(|path| (path.clone(), fs::read(path).unwrap()))
        .collect();
    files.sort();
    files
}

/// Everything a store holds, as a reader sees it.
fn held(store: &Store) -> Value {
    let sessions = (1..=4).map(|number| {
        let session = store.session(&id(number)).unwrap();
        let turns = store.turns(&id(number)).unwrap();
        let logs: Vec<_> = turns.iter().map(|turn| log_of(store, turn.id)).collect();
        json!({ "session": format!("{session:?}"), "turns": format!("{turns:?}"), "logs": logs })
    });
    Value::Array(sessions.collect())
}

// The import reads the old store and never writes it, and a second run changes nothing: a store
// that holds sessions is only imported into when told to replace them.
#[test]
fn an_import_keeps_the_old_store_and_never_runs_twice_by_mistake() {
    let (old, new) = (old_data(), TempDir::new().unwrap());
    let file = old.path().join("runner.sqlite");
    let before = fs::read(&file).unwrap();
    let store = Importing::open(new.path()).unwrap();
    runner::import(old.path(), &store, at(12, 0, 0, 0), Replace::No).unwrap();
    assert_eq!(
        fs::read(&file).unwrap(),
        before,
        "the old store is as it was"
    );
    // Reading a store in SQLite's write-ahead mode leaves its two side files, as the Node
    // server's own reads do: the log beside the store is empty, so nothing was written to it.
    for (path, bytes) in files(old.path()) {
        match path.file_name().and_then(|name| name.to_str()) {
            Some("runner.sqlite" | "runner.sqlite-shm") => {}
            Some("runner.sqlite-wal") => assert!(bytes.is_empty(), "nothing waits to be written"),
            other => panic!("the import made {other:?} in the folder it reads"),
        }
    }
    // A session made here since.
    let own = store.create_session(chat(), at(12, 30, 0, 0)).unwrap();
    let first = held(&store);

    let again = runner::import(old.path(), &store, at(13, 0, 0, 0), Replace::No);

    let refused = again.expect_err("a refusal");
    assert!(
        matches!(refused, ImportError::Holds { sessions: 5 }),
        "{refused}"
    );
    assert_eq!(held(&store), first, "nothing was imported twice");
    assert_eq!(store.session(&own.id).unwrap(), Some(own.clone()));

    // Told to replace them, it starts again from the old store: the same sessions, and no other.
    let replaced = runner::import(old.path(), &store, at(13, 0, 0, 0), Replace::Yes).unwrap();
    assert_eq!(replaced.sessions, 4);
    assert_eq!(held(&store), first);
    assert_eq!(store.session(&own.id).unwrap(), None);
    assert_eq!(fs::read(&file).unwrap(), before);
}

// What the import refuses, each leaving the new store empty: a folder with no old store, and an
// old store at a schema this import does not read.
#[test]
fn an_import_refuses_a_store_it_cannot_read_and_imports_nothing() {
    let (old, new, empty) = (old_data(), TempDir::new().unwrap(), TempDir::new().unwrap());
    let store = Importing::open(new.path()).unwrap();

    let missing = runner::import(empty.path(), &store, at(12, 0, 0, 0), Replace::No);
    assert!(
        matches!(missing, Err(ImportError::Missing { .. })),
        "{missing:?}"
    );
    assert_eq!(
        files(empty.path()),
        [],
        "nothing is made in a folder it reads"
    );

    rusqlite::Connection::open(old.path().join("runner.sqlite"))
        .unwrap()
        .pragma_update(None, "user_version", 11)
        .unwrap();
    let older = runner::import(old.path(), &store, at(12, 0, 0, 0), Replace::No);
    assert!(
        matches!(older, Err(ImportError::Schema { found: 11, .. })),
        "{older:?}"
    );
    assert_eq!(store.session(&id(1)).unwrap(), None);
}

// An import never writes the store of a server that runs on the folder: that server's turns,
// timers, and memory would no longer match its store. It opens the store only under the folder's
// lock, which a server holds as it starts and runs: stopped, the server's folder imports.
#[test]
fn an_import_refuses_the_store_of_a_running_server() {
    let (old, new) = (old_data(), TempDir::new().unwrap());
    // A server of this very process holds the folder, and names itself in its status file.
    let held = uraeda_server::status::lock(new.path())
        .unwrap()
        .expect("a free folder");
    let running = uraeda_server::status::write(new.path(), 1).unwrap();

    let refused = Importing::open(new.path()).err().expect("a refusal");

    assert!(
        matches!(refused, ImportError::Running { pid, .. } if pid == running.pid),
        "{refused}"
    );
    assert!(refused.to_string().contains("stop it"), "{refused}");
    assert!(
        !new.path().join(runner::FILE).exists(),
        "the store was opened"
    );

    // Starting, it has no status file yet.
    uraeda_server::status::remove(new.path());
    let refused = Importing::open(new.path()).err().expect("a refusal");
    assert!(matches!(refused, ImportError::Held { .. }), "{refused}");

    drop(held);
    let store = Importing::open(new.path()).unwrap();
    runner::import(old.path(), &store, at(12, 0, 0, 0), Replace::Yes).unwrap();
    assert_eq!(
        store.session(&id(1)).unwrap().map(|session| session.id),
        Some(id(1))
    );
}

// All or nothing holds for the images too: an import that fails after it copied them takes them
// back, so a retry copies them again and counts them.
#[test]
fn a_failed_import_leaves_no_image_behind() {
    let (old, new) = (old_data(), TempDir::new().unwrap());
    let store = Importing::open(new.path()).unwrap();
    // The last thing the import reads is the old store's job runs: without them, it fails.
    let table = rusqlite::Connection::open(old.path().join("runner.sqlite")).unwrap();
    table
        .execute_batch("ALTER TABLE job_runs RENAME TO gone")
        .unwrap();

    let failed = runner::import(old.path(), &store, at(12, 0, 0, 0), Replace::No);

    assert!(matches!(failed, Err(ImportError::Old { .. })), "{failed:?}");
    assert_eq!(store.session(&id(1)).unwrap(), None);
    let image = new.path().join("images").join(IMAGE);
    assert!(!image.exists(), "no image is left");

    table
        .execute_batch("ALTER TABLE gone RENAME TO job_runs")
        .unwrap();
    let imported = runner::import(old.path(), &store, at(12, 0, 0, 0), Replace::No).unwrap();
    assert_eq!(imported.images, 1);
}

// How the store joins the server: the server opens it, every domain reads it by its type, and it
// closes as the server stops.
#[tokio::test]
async fn the_server_opens_the_store_and_closes_it_as_it_stops() {
    let server = support::server().await;
    let store = server.shared().get::<Store>();
    let session = store.create_session(chat(), server.shared().now()).unwrap();

    let server = server.restart().await;

    assert!(
        matches!(store.session(&session.id), Err(StoreError::Closed)),
        "the store of a stopped server is closed"
    );
    let store = server.shared().get::<Store>();
    assert_eq!(store.session(&session.id).unwrap(), Some(session));
}
