//! Claude Code's runtime, the built-in `claude`: what it makes of Claude Code's output, what it
//! starts `claude` with, and what it writes to it.
//!
//! No test runs the real `claude`: a shell script stands in for it, first on the `PATH` of the
//! test's server, which plays lines recorded from the real one, and writes down its arguments
//! and what it read. See `claude/stage.rs`.

#[path = "claude/accounts.rs"]
mod accounts;
#[path = "claude/asked.rs"]
mod asked;
#[path = "claude/process.rs"]
mod process;
#[path = "claude/real.rs"]
mod real;
#[path = "claude/stage.rs"]
mod stage;
mod support;

use std::fs;
use std::path::{Path, PathBuf};

use serde_json::{Value, json};
use uraeda_server::runner::Denial;
use uraeda_server::runtimes::{Events, Options, Signal};

use stage::{REPLAY, Stage, args, message, next, options, rest, same, stage};
use support::{START, gone, group_members};

/// The folder every recorded stream names as its session's.
const SESSION_DIR: &str = "/session-dir";

/// A recorded stream, with the events the Node runner made of it.
struct Recorded {
    name: String,
    lines: String,
    /// One event a line, as the Node runner made them: frozen, see `fixtures/runtimes/README.md`.
    events: String,
    /// When the stream is read, in seconds since 1970.
    at: u64,
}

/// The streams of a folder of `fixtures/`, whose events are in a folder of
/// `fixtures/runtimes/claude/`.
fn recorded(streams: &str, events: &str) -> Vec<Recorded> {
    let fixtures = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../fixtures");
    let events = fixtures.join("runtimes/claude").join(events);
    let mut names: Vec<String> = fs::read_dir(fixtures.join(streams))
        .unwrap()
        .map(|entry| entry.unwrap().file_name().into_string().unwrap())
        .filter(|name| name.ends_with(".jsonl") && !name.ends_with(".events.jsonl"))
        .collect();
    names.sort();
    let read = |name: String| {
        let stem = name.trim_end_matches(".jsonl");
        let at = stem.rsplit_once(".at-").map(|(_, at)| at.parse().unwrap());
        Recorded {
            lines: fs::read_to_string(fixtures.join(streams).join(&name)).unwrap(),
            events: fs::read_to_string(events.join(format!("{stem}.events.jsonl"))).unwrap(),
            at: at.unwrap_or(START.as_secs()),
            name: format!("{streams}/{name}"),
        }
    };
    names.into_iter().map(read).collect()
}

/// The events the runtime makes of a stream, played by a stand-in in a new session's folder,
/// without the exit that ends them: the folder, and the events.
async fn played(stage: &Stage, lines: &str) -> (PathBuf, Vec<Value>) {
    let dir = stage.session_dir();
    let here = lines.replace(SESSION_DIR, dir.to_str().unwrap());
    fs::write(dir.join("stream.jsonl"), here).unwrap();
    let mut process = stage.open(options(&dir)).await;
    let mut events = process.events();
    process.send(message("m1", "Go."));
    process.close();
    let mut events = rest(&mut events).await;
    let exit = events.pop().expect("an exit");
    assert_eq!(exit, json!({ "type": "exit", "code": 0, "stderr": "" }));
    (dir, events)
}

#[tokio::test]
async fn a_recorded_stream_becomes_the_same_events_as_the_node_runner_made() {
    let stage = stage(REPLAY).await;
    let streams = [
        // Recorded from Claude Code 2.1.322: a reply in pieces, a tool call and its result, a
        // thought, a blocked action, a sub-agent, and a result that is an error.
        recorded("runtimes/claude", ""),
        // The Node tests' own recorded lines: the usage limits, the wakeups, a retry.
        recorded("claude", "lines"),
        // Written by hand: the cases of the Node parser's tests.
        recorded("runtimes/claude/written", "written"),
    ];
    let mut compared = 0;
    for stream in streams.into_iter().flatten() {
        stage.at(stream.at);
        let (dir, events) = played(&stage, &stream.lines).await;
        let expected: Vec<Value> = stream
            .events
            .lines()
            .map(|line| line.replace(SESSION_DIR, dir.to_str().unwrap()))
            .map(|line| serde_json::from_str(&line).unwrap())
            .collect();
        for (at, expected) in expected.iter().enumerate() {
            let event = events.get(at).unwrap_or(&Value::Null);
            assert!(
                same(event, expected),
                "{}, event {at}:\n  the runtime's: {event}\n  the Node runner's: {expected}",
                stream.name
            );
            compared += 1;
        }
        let more = events.get(expected.len()..).unwrap_or_default();
        assert_eq!(more, [] as [Value; 0], "{}: events too many", stream.name);
    }
    assert!(
        compared > 300,
        "every stream was compared: {compared} events"
    );
    stage.server.stop().await;
}

// Claude Code cuts a long output between the two halves of a character, and prints the half as
// an escape no text holds: the Node runner kept it, and a line that was dropped would leave its
// tool call running for ever.
#[tokio::test]
async fn a_line_cut_inside_a_character_is_read_with_the_half_replaced() {
    let stage = stage(REPLAY).await;
    let lines = [
        r#"{"type":"user","message":{"role":"user","content":[{"type":"tool_result","tool_use_id":"t1","content":"cut here \ud83d"}]}}"#,
        r#"{"type":"assistant","message":{"content":[{"type":"text","text":"\ud83d\ude00 whole, \ude00 half, C:\\ud83d is no escape"}]}}"#,
    ];
    let (_, events) = played(&stage, &lines.join("\n")).await;
    assert_eq!(
        events,
        [
            json!({ "type": "toolEnd", "id": "t1", "isError": false, "output": "cut here \u{FFFD}" }),
            json!({ "type": "text", "text": "😀 whole, \u{FFFD} half, C:\\ud83d is no escape" }),
        ]
    );
    stage.server.stop().await;
}

/// A stand-in that plays `allowed.jsonl` once it is started with the rule of the blocked write,
/// and `stream.jsonl`, where the write is blocked, until then.
const BLOCKED_UNTIL_ALLOWED: &str = r#"
stream=stream.jsonl
for arg in "$@"; do
  case "$arg" in "Edit(/$PWD/blocked.txt)") stream=allowed.jsonl ;; esac
done
while IFS= read -r line; do
  printf '%s\n' "$line" >> stdin
  case "$line" in *'"type":"user"'*) cat "$stream" ;; esac
done
"#;

/// The lines of a turn whose write ran, as Claude Code prints them.
fn allowed_lines(file: &str) -> String {
    let write = json!({
        "type": "assistant", "parent_tool_use_id": null,
        "message": { "role": "assistant", "content": [{
            "type": "tool_use", "id": "toolu_2", "name": "Write",
            "input": { "file_path": file, "content": "hi" },
        }] },
    });
    let written = json!({
        "type": "user", "parent_tool_use_id": null,
        "message": { "role": "user", "content": [{
            "type": "tool_result", "tool_use_id": "toolu_2",
            "content": "File created successfully",
        }] },
    });
    let result = json!({
        "type": "result", "subtype": "success", "is_error": false, "permission_denials": [],
    });
    format!("{write}\n{written}\n{result}\n")
}

/// A turn's result, of its events.
fn result_of(events: &[Value]) -> &Value {
    let result = events.iter().find(|event| event["type"] == "result");
    result.expect("a result")
}

// The contract has no request an agent waits on (ruling R99): a blocked action is skipped, named
// in its turn's result, and runs once the human's yes opened a process with its rule.
#[tokio::test]
async fn a_permission_request_waits_for_an_answer() {
    let stage = stage(BLOCKED_UNTIL_ALLOWED).await;
    let dir = stage.session_dir();
    let file = dir.join("blocked.txt");
    let recorded = &recorded("runtimes/claude", "")[0];
    assert_eq!(recorded.name, "runtimes/claude/denied.jsonl");
    let blocked = recorded.lines.replace(SESSION_DIR, dir.to_str().unwrap());
    fs::write(dir.join("stream.jsonl"), blocked).unwrap();
    fs::write(
        dir.join("allowed.jsonl"),
        allowed_lines(file.to_str().unwrap()),
    )
    .unwrap();

    // The agent tries the write: it is blocked, and the turn ends, waiting for nothing.
    let mut process = stage.open(options(&dir)).await;
    let mut events = process.events();
    process.send(message("m1", "Write the file."));
    process.close();
    let turn = rest(&mut events).await;
    let denials = result_of(&turn)["denials"].clone();
    assert_eq!(
        denials,
        json!([{ "tool": "Write", "input": { "file_path": file, "content": "hi" } }]),
        "the blocked action is a denial of the turn's result"
    );
    let refused = turn
        .iter()
        .find(|event| event["type"] == "toolEnd")
        .unwrap();
    assert_eq!(refused["isError"], true, "the write did not run");

    // The human's yes: the narrowest rule for that action, and a process opened with it.
    let denial: Denial = serde_json::from_value(denials[0].clone()).unwrap();
    let rule = stage.runtime().allow_rule(&denial).expect("a rule");
    assert_eq!(rule, format!("Edit(/{})", file.display()));
    let allowed = Options {
        resume: true,
        allowed: vec![rule.clone()],
        ..options(&dir)
    };
    let mut process = stage.open(allowed).await;
    let mut events = process.events();
    process.send(message("m2", "Try again."));
    process.close();
    let turn = rest(&mut events).await;

    let started = args(&dir);
    assert_eq!(
        started[started.len() - 4..],
        ["--resume", "id", "--allowedTools", &rule],
        "the rule is given to that process, last"
    );
    assert_eq!(result_of(&turn)["denials"], json!([]));
    let ran = turn
        .iter()
        .find(|event| event["type"] == "toolEnd")
        .unwrap();
    assert_eq!(ran["isError"], false, "the write ran");
    stage.server.stop().await;
}

/// A stand-in that, for a session, starts a command of its own, which ignores the end of its
/// input, writes the id of its own process, says a line, and ends with its stdin.
const WITH_A_COMMAND: &str = r#"
if [ "$PWD" != "$HOME" ]; then sleep 600 & fi
echo $$ > pid
echo 'not json'
exec cat >> stdin
"#;

/// The process group of a session's stand-in, which leads it, once it said its line.
async fn started(events: &mut Events, dir: &Path) -> u32 {
    assert_eq!(next(events).await, json!({ "type": "skipped" }));
    let group = fs::read_to_string(dir.join("pid")).unwrap();
    let group = group.trim().parse().unwrap();
    assert_eq!(group_members(group).len(), 2, "claude and its command");
    group
}

// Break: the group's signal sent to its leader alone. The `sleep` then outlives its session.
#[tokio::test]
async fn closing_a_session_leaves_no_claude_process() {
    let stage = stage(WITH_A_COMMAND).await;

    // A session that is closed: `claude` ends with its stdin, and takes what it started.
    let (dir, mut closed) = stage.session().await;
    let mut events = closed.events();
    let group = started(&mut events, &dir).await;
    closed.close();
    assert_eq!(
        rest(&mut events).await,
        [json!({ "type": "exit", "code": 0, "stderr": "" })]
    );
    assert_eq!(gone(group).await, Vec::<u32>::new(), "nothing is left");

    // One that a signal ends, and one that is still open as the server stops.
    let (dir, mut killed) = stage.session().await;
    let mut events = killed.events();
    let killed_group = started(&mut events, &dir).await;
    let (dir, mut open) = stage.session().await;
    let mut open_events = open.events();
    let open_group = started(&mut open_events, &dir).await;

    killed.kill(Signal::Terminate);
    assert_eq!(
        rest(&mut events).await,
        [json!({ "type": "exit", "code": null, "stderr": "" })],
        "ended by its signal"
    );
    assert_eq!(gone(killed_group).await, Vec::<u32>::new());

    stage.server.stop().await;
    assert_eq!(
        gone(open_group).await,
        Vec::<u32>::new(),
        "nor after the server"
    );
    assert_eq!(rest(&mut open_events).await.len(), 1, "its exit");
}

// No test's server starts the machine's agents (ruling R118): the other built-in's command is
// a stand-in on this stage too, which the server asked for its models as it started.
#[tokio::test]
async fn the_stage_runs_no_agent_of_the_machine() {
    let stage = stage(stage::SILENT).await;

    stage.server.runs_no_agent_of_the_machine().await;
}
