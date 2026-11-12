//! Codex's runtime, the built-in `codex`: what it makes of Codex's notifications, what it
//! starts `codex` with, and what it writes to it.
//!
//! No test runs the real `codex`: a stand-in is first on the `PATH` of the test's server, which
//! replays exchanges recorded from the real one, answers the runtime's requests as recorded,
//! and writes down its arguments and what it read. See `codex/stage.rs`.

#[path = "codex/asked.rs"]
mod asked;
#[path = "codex/process.rs"]
mod process;
#[path = "codex/real.rs"]
mod real;
#[path = "codex/stage.rs"]
mod stage;
mod support;

use std::fs;
use std::path::{Path, PathBuf};

use serde_json::{Value, json};
use uraeda_server::runner::Denial;
use uraeda_server::runtimes::{Events, Options};

use stage::{
    Stage, fixtures, message, next, options, params, requests, same, stage, until, written,
};
use support::{gone, group_members};

/// The folder every exchange names as its session's.
const SESSION_DIR: &str = "/session-dir";

/// An exchange with Codex, with the events the Node runtime made of it.
struct Exchange {
    name: String,
    /// The file, as it was recorded: see `fixtures/runtimes/README.md`.
    lines: String,
    /// One event a line, as the Node runtime made them: frozen.
    events: Vec<Value>,
}

impl Exchange {
    /// The exchange of a name, as `reply` or `written/denied`.
    fn read(name: &str) -> Exchange {
        let read = |end: &str| {
            let path = fixtures().join(format!("{name}{end}"));
            fs::read_to_string(&path).unwrap_or_else(|_| panic!("{} is there", path.display()))
        };
        let events = read(".events.jsonl");
        let events = events
            .lines()
            .map(|line| serde_json::from_str(line).unwrap());
        Exchange {
            name: name.to_owned(),
            lines: read(".jsonl"),
            events: events.collect(),
        }
    }

    /// Each line of the exchange, as JSON: how it opens first.
    fn json(&self) -> Vec<Value> {
        let lines = self.lines.lines();
        lines
            .map(|line| serde_json::from_str(line).unwrap())
            .collect()
    }

    /// How its process opens in a folder, and the message it is sent.
    fn start(&self, dir: &Path) -> (Options, uraeda_server::runtimes::Outgoing) {
        let header = &self.json()[0];
        let text = |value: &Value| value.as_str().map(str::to_owned);
        let opened = Options {
            model: text(&header["open"]["model"]),
            effort: text(&header["open"]["effort"]),
            ..options(dir)
        };
        let mut sent = message("m1", header["message"]["text"].as_str().unwrap());
        sent.review = header["message"]["review"] == true;
        (opened, sent)
    }
}

/// The exchanges kept: the recorded ones, and the ones of `written/`.
fn exchanges() -> Vec<Exchange> {
    let named = |folder: &str| {
        let mut names: Vec<String> = fs::read_dir(fixtures().join(folder))
            .unwrap()
            .map(|entry| entry.unwrap().file_name().into_string().unwrap())
            .filter(|name| name.ends_with(".jsonl") && !name.ends_with(".events.jsonl"))
            .map(|name| format!("{folder}{}", name.trim_end_matches(".jsonl")))
            .collect();
        names.sort();
        names
    };
    let names = named("").into_iter().chain(named("written/"));
    names.map(|name| Exchange::read(&name)).collect()
}

/// A value with the session's folder under the name every exchange gives it.
fn scrubbed(value: &Value, dir: &Path) -> Value {
    let text = value
        .to_string()
        .replace(dir.to_str().unwrap(), SESSION_DIR);
    serde_json::from_str(&text).unwrap()
}

/// Plays an exchange through a session's process, as the Node script did: its message is sent
/// as it opens, and it is closed at its result. Every event it gave, and the folder it ran in.
async fn play(stage: &Stage, exchange: &Exchange) -> (Vec<Value>, PathBuf) {
    let dir = stage.session_dir();
    fs::write(dir.join("exchange.jsonl"), &exchange.lines).unwrap();
    let (opened, sent) = exchange.start(&dir);
    let mut process = stage.open(opened).await;
    let mut events: Events = process.events();
    process.send(sent);
    let mut read = Vec::new();
    while let Some(event) = next(&mut events).await {
        let refused = event["type"] == "init" && event.get("problem").is_some();
        if event["type"] == "result" || refused {
            process.close();
        }
        read.push(scrubbed(&event, &dir));
    }
    (read, dir)
}

/// The requests of an exchange that carry what a session asks: the runtime's are compared with
/// them.
const COMPARED: [&str; 6] = [
    "initialize",
    "model/list",
    "config/read",
    "thread/start",
    "turn/start",
    "review/start",
];

/// A request's parameters, without the instructions, which name the server's own folders.
fn asked(mut params: Value) -> Value {
    if let Some(params) = params.as_object_mut() {
        params.remove("developerInstructions");
    }
    params
}

#[tokio::test]
async fn a_recorded_stream_becomes_the_same_events_as_the_node_runner_made() {
    let stage = stage(json!({})).await;
    let exchanges = exchanges();
    let names: Vec<&str> = exchanges.iter().map(|each| each.name.as_str()).collect();
    for kept in ["command", "error", "reasoning", "reply", "review"] {
        assert!(names.contains(&kept), "{kept} was recorded from Codex");
    }
    for exchange in &exchanges {
        let (events, dir) = play(&stage, exchange).await;
        let name = &exchange.name;
        for (at, (made, node)) in events.iter().zip(&exchange.events).enumerate() {
            assert!(
                same(made, node),
                "{name}, event {at}:\n  the runtime's: {made}\n  the Node runtime's: {node}"
            );
        }
        assert_eq!(
            events.len(),
            exchange.events.len(),
            "{name}: as many events as the Node runtime made: {events:?}"
        );

        // What it asked of Codex is what the Node runtime asked.
        let recorded = exchange.json();
        let recorded = recorded.iter().filter_map(|line| line.get("client"));
        let recorded: Vec<&Value> = recorded
            .filter(|line| line.get("method").is_some())
            .collect();
        let methods = |lines: &[&Value]| -> Vec<String> {
            let methods = lines.iter().map(|line| line["method"].as_str().unwrap());
            methods.map(str::to_owned).collect()
        };
        let wrote = requests(&dir);
        assert_eq!(
            methods(&wrote.iter().collect::<Vec<_>>()),
            methods(&recorded),
            "{name}: the same requests, in the same order"
        );
        for line in recorded {
            let method = line["method"].as_str().unwrap();
            if !COMPARED.contains(&method) || line.get("params").is_none() {
                continue;
            }
            let wrote = asked(scrubbed(&params(&dir, method), &dir));
            let node = asked(line["params"].clone());
            assert!(
                same(&wrote, &node),
                "{name}, {method}:\n  the runtime's: {wrote}\n  the Node runtime's: {node}"
            );
        }
    }
    stage.stop().await;
}

/// The contract has no permission request (ruling R99), and Codex has no denial either: an
/// action that needs more than its sandbox gives is reviewed by Codex's own reviewer, never the
/// human, and a request Codex makes of its client is refused at once, so no turn waits on an
/// answer nobody gives.
#[tokio::test]
async fn a_permission_request_waits_for_an_answer() {
    let stage = stage(json!({})).await;

    // An action Codex's reviewer refused: its verdict is a line of the transcript, the tool
    // call ends as failed, and the turn goes on to its result, which names no blocked action.
    let (events, _) = play(&stage, &Exchange::read("written/denied")).await;
    let kinds: Vec<&str> = events
        .iter()
        .map(|event| event["type"].as_str().unwrap())
        .collect();
    let start = kinds.iter().rposition(|kind| *kind == "toolStart").unwrap();
    assert_eq!(kinds[start..start + 3], ["toolStart", "notice", "toolEnd"]);
    assert_eq!(events[start]["target"], "git push origin main");
    assert_eq!(
        events[start + 1]["text"],
        "Automatic review denied (risk: high): It pushes to a remote."
    );
    assert_eq!(events[start + 2]["isError"], true);
    let result = events
        .iter()
        .find(|event| event["type"] == "result")
        .unwrap();
    assert_eq!(result["denials"], json!([]));
    assert_eq!(result["ok"], true, "a refused action fails no turn");

    // So there is nothing for the human to allow: no rule, and no approvals to offer.
    let runtime = stage.runtime();
    let denial = Denial {
        input: json!({ "command": "git push origin main" })
            .as_object()
            .unwrap()
            .clone(),
        tool: "Shell".to_owned(),
    };
    assert_eq!(runtime.allow_rule(&denial), None);
    assert!(!runtime.capabilities().approvals);

    // A question Codex asks its client gets an error at once, and the turn ends by itself.
    let dir = stage.session_dir();
    let mut process = stage.open(options(&dir)).await;
    let mut events = process.events();
    process.send(message("m1", "ask me"));
    let read = until(&mut events, "result").await;
    let inits: Vec<&Value> = read
        .iter()
        .filter(|event| event["type"] == "init")
        .collect();
    assert_eq!(inits, [&json!({ "sessionId": "t-1", "type": "init" })]);
    assert_eq!(read.last().unwrap()["ok"], true);
    let answer = written(&dir).into_iter().find(|line| line["id"] == "ask-1");
    let refusal = json!({
        "error": { "code": -32_601, "message": "Uraeda does not answer item/tool/requestUserInput" },
        "id": "ask-1",
    });
    assert_eq!(answer, Some(refusal));
    process.close();
    assert_eq!(
        until(&mut events, "exit").await,
        [json!({ "code": 0, "stderr": "", "type": "exit" })]
    );
    stage.stop().await;
}

/// The process group a session's stand-in leads, once it wrote its pid.
async fn group_of(dir: &Path) -> u32 {
    for _ in 0..600 {
        if let Ok(Ok(pid)) = fs::read_to_string(dir.join("pid")).map(|pid| pid.parse()) {
            return pid;
        }
        tokio::time::sleep(std::time::Duration::from_millis(50)).await;
    }
    panic!("the stand-in started");
}

#[tokio::test]
async fn closing_a_session_leaves_no_codex_process() {
    // A stand-in that leaves a command running, as a tool of the agent's would.
    let stage = stage(json!({ "leaves": true })).await;
    let dir = stage.session_dir();
    let mut process = stage.open(options(&dir)).await;
    let mut events = process.events();
    process.send(message("m1", "Hi"));
    until(&mut events, "result").await;
    let group = group_of(&dir).await;
    assert_eq!(group_members(group).len(), 2, "codex, and what it started");

    process.close();

    assert_eq!(until(&mut events, "exit").await.len(), 1);
    assert_eq!(gone(group).await, Vec::<u32>::new(), "nothing is left");

    // Nor does a server that stops leave one of a session still open.
    let dir = stage.session_dir();
    let mut open = stage.open(options(&dir)).await;
    let mut events = open.events();
    open.send(message("m1", "wait"));
    until(&mut events, "accepted").await;
    let group = group_of(&dir).await;
    assert_eq!(group_members(group).len(), 2);

    stage.stop().await;

    assert_eq!(
        gone(group).await,
        Vec::<u32>::new(),
        "nothing outlives the server"
    );
    assert_eq!(
        until(&mut events, "exit").await.last().unwrap()["type"],
        "exit"
    );
}

// No test's server starts the machine's agents (ruling R118): the other built-in's command is
// a stand-in on this stage too, which the server asked for its models as it started.
#[tokio::test]
async fn the_stage_runs_no_agent_of_the_machine() {
    let stage = stage(json!({})).await;

    stage.server.runs_no_agent_of_the_machine().await;
}
