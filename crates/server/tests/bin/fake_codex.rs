//! A stand-in for the `codex` command, which runs no agent: what the tests of Codex's runtime
//! find first on their server's `PATH`.
//!
//!   fake-codex <folder of its settings> <codex's arguments>
//!
//! As `codex app-server`, it writes what it was started with in the folder it runs in, a
//! session's: `argv`, its arguments as JSON, `token`, its token for Uraeda's tools, `pid`, and
//! `stdin`, each line it read. Then:
//!
//! - **With `exchange.jsonl` in that folder, it replays it**: a recorded exchange of
//!   `fixtures/runtimes/codex/`. It goes through the lines in order: it writes a `server` line,
//!   and waits at a `client` line until it has read the runtime's message of that method, or
//!   that answer. An answer is given the id the runtime gave its request, and `/session-dir`
//!   reads as the folder it runs in.
//! - **Without, it answers as Codex 0.163.0 does**, from `pages` and `config`. A turn whose text
//!   says `ask` sends the client a question and completes once answered; one that says `wait`
//!   completes when steered, failed if it says `fail on steer`, the steer then refused; any
//!   other completes at once. A review runs as a turn on its target's instructions.
//!
//! `options.json`, in the folder of its settings, changes the second: `applied`, the
//! permissions its thread's answers say it applied; `catalogFails` and `catalogMs`, for
//! `codex debug models`; `completesFirst`, a turn completed before `turn/start` is answered;
//! `hang`, a method it never answers; `refuse`, one it refuses; `stubborn`, a process that
//! outlives SIGTERM and the end of its stdin; `leaves`, a process that starts a `sleep` it
//! leaves running, as a tool of the agent's would; `config`, the `config` of its `config/read`
//! answer.

use std::fs::{self, OpenOptions};
use std::io::{BufRead, Write};
use std::path::Path;
use std::process::{Command, ExitCode, Stdio};
use std::time::Duration;

use serde_json::{Value, json};

fn main() -> ExitCode {
    let mut args = std::env::args().skip(1);
    let settings = args.next().expect("the folder of its settings");
    let args: Vec<String> = args.collect();
    let options = fs::read_to_string(Path::new(&settings).join("options.json"));
    let options: Value = options.map_or(json!({}), |text| {
        serde_json::from_str(&text).expect("options.json reads")
    });
    match args.first().map(String::as_str) {
        Some("--version") => print!("codex-cli 0.163.0\nmore\n"),
        Some("debug") => return catalog(&settings, &options),
        _ => app_server(&args, &options),
    }
    ExitCode::SUCCESS
}

/// Appends a line to a file, made if missing.
fn append(file: impl AsRef<Path>, line: &str) {
    let opened = OpenOptions::new().create(true).append(true).open(file);
    let mut file = opened.expect("the file opens");
    writeln!(file, "{line}").expect("the line is written");
}

/// Writes a message to the runtime, a line. A runtime that left is no failure.
fn out(message: &Value) {
    let mut stdout = std::io::stdout().lock();
    let _ = writeln!(stdout, "{message}");
    let _ = stdout.flush();
}

/// `codex debug models`: the catalog, after a while, or a refusal.
fn catalog(settings: &str, options: &Value) -> ExitCode {
    let cwd = std::env::current_dir().expect("a working folder");
    append(Path::new(settings).join("debug"), &cwd.to_string_lossy());
    std::thread::sleep(Duration::from_millis(
        options["catalogMs"].as_u64().unwrap_or(0),
    ));
    if options["catalogFails"] == true {
        eprint!("signed out");
        return ExitCode::FAILURE;
    }
    print!(
        "{}",
        json!({ "models": [{ "multi_agent_version": "v2", "slug": "gpt-6-luna" }] })
    );
    ExitCode::SUCCESS
}

/// `codex app-server`: writes what it was started with, then reads the runtime's messages
/// until its stdin ends.
#[expect(
    clippy::zombie_processes,
    reason = "the `sleep` it leaves is left on purpose: the test checks the runtime stops it"
)]
fn app_server(args: &[String], options: &Value) {
    append("argv", &json!(args).to_string());
    let token = std::env::var("URAEDA_MCP_TOKEN").unwrap_or_default();
    fs::write("token", token).expect("its token is written");
    fs::write("pid", std::process::id().to_string()).expect("its pid is written");
    let stubborn = options["stubborn"] == true;
    if stubborn {
        // SAFETY: ignoring a signal changes nothing another thread reads.
        unsafe { libc::signal(libc::SIGTERM, libc::SIG_IGN) };
    }
    if options["leaves"] == true {
        // In the process's group, holding none of its output, and outliving it.
        let mut sleep = Command::new("sleep");
        let quiet = sleep.arg("600").stdin(Stdio::null());
        let quiet = quiet.stdout(Stdio::null()).stderr(Stdio::null());
        quiet.spawn().expect("sleep starts");
    }
    let mut read: Box<dyn FnMut(Value)> = match fs::read_to_string("exchange.jsonl") {
        Ok(exchange) => Box::new(replay(&exchange)),
        Err(_) => Box::new(answer(options.clone())),
    };
    for line in std::io::stdin().lock().lines() {
        let Ok(line) = line else { break };
        append("stdin", &line);
        read(serde_json::from_str(&line).expect("the runtime writes JSON"));
    }
    if stubborn {
        loop {
            std::thread::sleep(Duration::from_secs(1));
        }
    }
}

/// Replays an exchange: what reads each message of the runtime's.
fn replay(exchange: &str) -> impl FnMut(Value) + use<> {
    let cwd = std::env::current_dir().expect("a working folder");
    let cwd = json!(cwd).to_string();
    let exchange = exchange.replace("/session-dir", &cwd[1..cwd.len() - 1]);
    // The first line says what the exchange is.
    let lines = exchange.lines().filter(|line| !line.is_empty()).skip(1);
    let lines: Vec<Value> = lines
        .map(|line| serde_json::from_str(line).expect("a line of the exchange"))
        .collect();
    // The runtime's messages no recorded line was matched with yet.
    let mut unread: Vec<Value> = Vec::new();
    // The id the runtime gave each request, by the id it has in the exchange.
    let mut ids: Vec<(Value, Value)> = Vec::new();
    let mut at = 0;
    let mut play = move |unread: &mut Vec<Value>| {
        while let Some(line) = lines.get(at) {
            if let Some(server) = line.get("server") {
                let given = ids
                    .iter()
                    .find(|(recorded, _)| Some(recorded) == server.get("id"));
                match given.filter(|_| server.get("method").is_none()) {
                    Some((_, id)) => {
                        let mut answer = server.clone();
                        answer["id"] = id.clone();
                        out(&answer);
                    }
                    None => out(server),
                }
            } else {
                let client = &line["client"];
                let same = |got: &Value| match client.get("method") {
                    None => got.get("method").is_none() && got.get("id") == client.get("id"),
                    Some(method) => got.get("method") == Some(method),
                };
                let Some(index) = unread.iter().position(same) else {
                    break;
                };
                let got = unread.remove(index);
                if let (Some(_), Some(id)) = (client.get("method"), client.get("id")) {
                    ids.push((id.clone(), got["id"].clone()));
                }
            }
            at += 1;
        }
    };
    play(&mut unread);
    move |message| {
        unread.push(message);
        play(&mut unread);
    }
}

/// Two pages of `model/list`, as Codex 0.163.0 gives them, a hidden model among them.
fn pages() -> [Value; 2] {
    let model = |id: &str, name: &str, description: &str, default: &str, efforts: &[&str]| {
        let efforts: Vec<Value> = efforts
            .iter()
            .map(|effort| json!({ "description": "", "reasoningEffort": effort }))
            .collect();
        json!({
            "defaultReasoningEffort": default, "description": description, "displayName": name,
            "hidden": id == "gpt-reserve", "id": id, "isDefault": id == "gpt-6.1-sol",
            "model": id, "supportedReasoningEfforts": efforts,
        })
    };
    let sol = model(
        "gpt-6.1-sol",
        "GPT-6.1-Sol",
        "The default.",
        "medium",
        &["low", "ultra"],
    );
    let reserve = model("gpt-reserve", "GPT-Reserve", "", "medium", &["low"]);
    let luna = model("gpt-6-luna", "GPT-6-Luna", "Fast.", "low", &["xhigh"]);
    [
        json!({ "data": [sol, reserve], "nextCursor": "2" }),
        json!({ "data": [luna], "nextCursor": null }),
    ]
}

/// The permissions Codex 0.163.0 says it applied, in its thread's answers, with the options'.
fn applied(options: &Value) -> Value {
    let mut applied = json!({
        "approvalPolicy": "on-request",
        "approvalsReviewer": "auto_review",
        "sandbox": {
            "excludeSlashTmp": false, "excludeTmpdirEnvVar": false, "networkAccess": false,
            "type": "workspaceWrite", "writableRoots": [],
        },
    });
    if let (Some(applied), Some(asked)) = (applied.as_object_mut(), options["applied"].as_object())
    {
        applied.extend(asked.clone());
    }
    applied
}

/// An object with more fields.
fn with(mut object: Value, more: Value) -> Value {
    if let (Some(object), Some(more)) = (object.as_object_mut(), more.as_object()) {
        object.extend(more.clone());
    }
    object
}

/// Answers as Codex does: what reads each message of the runtime's.
fn answer(options: Value) -> impl FnMut(Value) {
    let mut turns = 0;
    let mut thread = json!("t-1");
    let mut waiting = Value::Null;
    let mut waiting_text = String::new();
    let config = options.get("config").cloned();
    let config =
        config.unwrap_or(json!({ "model": "gpt-6-luna", "model_reasoning_effort": "high" }));
    let note = |name: &str, params: Value| out(&json!({ "method": name, "params": params }));
    let complete = move |thread: &Value, id: &Value, status: &str| {
        let turn = json!({ "id": id, "status": status });
        note(
            "turn/completed",
            json!({ "threadId": thread, "turn": turn }),
        );
    };
    move |message| {
        let ok = |result: Value| out(&json!({ "id": message["id"], "result": result }));
        let refused = |why: &str| {
            let error = json!({ "code": -1, "message": why });
            out(&json!({ "error": error, "id": message["id"] }));
        };
        let params = &message["params"];
        let method = message.get("method").and_then(Value::as_str);
        if method.is_some() && method == options["hang"].as_str() {
            return;
        }
        if method.is_some() && method == options["refuse"].as_str() {
            return refused("Refused");
        }
        match method {
            None => {
                if message["id"] == "ask-1" {
                    complete(&thread, &waiting, "completed");
                }
            }
            Some("model/list") => ok(pages()[usize::from(params["cursor"] == "2")].clone()),
            Some("config/read") => ok(json!({ "config": config })),
            Some("thread/start") => {
                ok(with(
                    applied(&options),
                    json!({ "thread": { "id": "t-1" } }),
                ));
                note("thread/started", json!({ "thread": { "id": "t-1" } }));
            }
            Some("thread/resume") => {
                thread = params["threadId"].clone();
                let resumed = json!({
                    "model": "gpt-6-luna", "reasoningEffort": "xhigh", "thread": { "id": thread },
                });
                ok(with(applied(&options), resumed));
            }
            Some("review/start" | "turn/start") => {
                turns += 1;
                let id = json!(format!("turn-{turns}"));
                let started = json!({ "threadId": thread, "turn": { "id": id } });
                if options["completesFirst"] == true {
                    note("turn/started", started);
                    complete(&thread, &id, "completed");
                    return ok(json!({ "turn": { "id": id } }));
                }
                ok(json!({ "turn": { "id": id } }));
                note("turn/started", started);
                let text = match params.get("input") {
                    Some(input) => input[0]["text"].as_str().unwrap_or_default(),
                    None => params["target"]["instructions"]
                        .as_str()
                        .unwrap_or_default(),
                };
                waiting = id.clone();
                waiting_text = text.to_owned();
                if text.contains("ask") {
                    let ask = json!({ "id": "ask-1", "method": "item/tool/requestUserInput", "params": {} });
                    out(&ask);
                } else if !text.contains("wait") {
                    complete(&thread, &id, "completed");
                }
            }
            Some("turn/steer") => {
                if waiting_text.contains("fail on steer") {
                    complete(&thread, &waiting, "failed");
                    return refused("No turn runs");
                }
                ok(json!({ "turnId": params["expectedTurnId"] }));
                complete(&thread, &waiting, "completed");
            }
            Some("turn/interrupt") => {
                ok(json!({}));
                complete(&thread, &waiting, "interrupted");
            }
            Some(_) => ok(json!({})),
        }
    }
}
