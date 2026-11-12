//! The check of the runtime against this machine's `claude`, signed in. It is ignored: run it by
//! hand, after a Claude Code upgrade, or when runs break.
//!
//!   nix develop -c cargo nextest run -p uraeda-server --test claude --run-ignored only real
//!
//! It uses the owner's account, and costs a few cents: two short messages on Sonnet at a low
//! effort, in a temporary folder outside any repository, with no tool asked for. It starts the
//! server in this process's environment, with the real `claude` on its `PATH`, and removes the
//! transcript Claude Code keeps of the session.

use std::fs;
use std::path::Path;
use std::sync::Arc;
use std::time::SystemTime;

use serde_json::Value;
use tempfile::TempDir;
use uraeda_server::runtimes::{Options, Runtime, Runtimes};
use uraeda_server::{Clock, Options as Start, Server};

use crate::stage::{message, options};

/// This process's environment, without what a `claude` gives the commands it runs.
fn environment() -> Vec<(String, String)> {
    let nested = |name: &str| name.starts_with("CLAUDE") && name != "CLAUDE_CONFIG_DIR";
    std::env::vars().filter(|(name, _)| !nested(name)).collect()
}

/// The first event of a kind.
fn find<'a>(events: &'a [Value], kind: &str) -> &'a Value {
    let found = events.iter().find(|event| event["type"] == kind);
    found.unwrap_or_else(|| panic!("no {kind} in {events:#?}"))
}

/// Removes the transcripts Claude Code kept of the sessions of a folder.
fn forget(claude_dir: &Path, session_dir: &Path) {
    let project = session_dir.to_string_lossy().replace(['/', '.'], "-");
    let _ = fs::remove_dir_all(claude_dir.join("projects").join(project));
}

/// A server in this process's environment, on folders of its own.
async fn server(folders: &Path) -> Server {
    let folder = |name: &str| {
        let path = folders.join(name);
        fs::create_dir(&path).unwrap();
        path
    };
    let start = Start {
        port: Some(0),
        config_dir: folder("config"),
        data_dir: folder("data"),
        folder: None,
        environment: environment(),
        allow_origins: Vec::new(),
        clock: Clock::fixed(SystemTime::now()),
        no_scheduled_jobs: false,
        sandbox: None,
        extension_call_limit: None,
    };
    Server::start(start).await.expect("the server starts")
}

/// Opens a process, sends it one message, closes it at its turn's result, and gives every
/// event to its exit. The message's id is new to the agent's session: Claude Code reads no
/// message whose id its transcript holds already.
async fn run(claude: &Arc<dyn Runtime>, options: Options, id: &str, text: &str) -> Vec<Value> {
    let runtime = claude.clone();
    let opened = tokio::task::spawn_blocking(move || runtime.open(options));
    let mut process = opened.await.unwrap();
    let mut events = process.events();
    process.send(message(id, text));
    let mut turn = Vec::new();
    while let Some(event) = events.next().await {
        let event = serde_json::to_value(&event).unwrap();
        if event["type"] == "result" {
            process.close();
        }
        turn.push(event);
    }
    turn
}

/// What a turn said, in lower case.
fn said(turn: &[Value]) -> String {
    find(turn, "text")["text"].as_str().unwrap().to_lowercase()
}

#[tokio::test]
#[ignore = "runs the real `claude`, on its owner's account: by hand only"]
async fn real_claude_runs_a_session_and_resumes_it() {
    let folders = TempDir::new().unwrap();
    let server = server(folders.path()).await;
    let runtimes = server.shared().get::<Runtimes>();
    let claude = runtimes.get("claude").expect("the built-in runtime");
    fs::create_dir(folders.path().join("session")).unwrap();
    let session_dir = fs::canonicalize(folders.path().join("session")).unwrap();
    let id = "5f0c1f0e-7a52-4c1b-9d0e-0e4f6f3f8a11".to_owned();
    let on_sonnet = |resume| Options {
        native_id: id.clone(),
        model: Some("sonnet".to_owned()),
        effort: Some("low".to_owned()),
        resume,
        ..options(&session_dir)
    };

    let runtime = claude.clone();
    let asked = tokio::task::spawn_blocking(move || (runtime.version(), runtime.models()));
    let (version, models) = asked.await.unwrap();
    let models = models.expect("a list").expect("its models");
    let ids: Vec<&str> = models
        .models
        .iter()
        .map(|model| model.id.as_str())
        .collect();
    println!(
        "version: {version:?}\nmodels: {ids:?}\ndefaults: {:?}",
        models.defaults
    );
    assert!(version.is_some() && !ids.is_empty());

    // A first run: the skill loads from the plugin the server wrote, and the turn ends well.
    let first = "Reply with the single word ready, and do nothing else.";
    let turn = run(&claude, on_sonnet(false), "m1", first).await;
    let kinds: Vec<&str> = turn
        .iter()
        .map(|event| event["type"].as_str().unwrap())
        .collect();
    println!("a first run: {kinds:?}");
    for kind in ["runsOn", "init", "result"] {
        println!("  {}", find(&turn, kind));
    }
    assert_eq!(find(&turn, "accepted")["id"], "m1");
    assert_eq!(find(&turn, "init")["sessionId"], id.as_str());
    assert_eq!(find(&turn, "init").get("problem"), None, "the skill loaded");
    assert_eq!(find(&turn, "result")["ok"], true);
    assert_eq!(find(&turn, "exit")["code"], 0);
    assert!(said(&turn).contains("ready"));
    assert!(
        claude.has_session(&id, None),
        "Claude Code kept its transcript"
    );

    // A resumed run keeps the session, and what was said in it.
    let again = "Which single word did you just reply with? Reply with it.";
    let turn = run(&claude, on_sonnet(true), "m2", again).await;
    println!("a resumed run: {}", find(&turn, "result"));
    assert_eq!(find(&turn, "init")["sessionId"], id.as_str());
    assert_eq!(find(&turn, "result")["ok"], true);
    assert!(said(&turn).contains("ready"));

    server.stop().await;
    let home = std::env::var("HOME").unwrap_or_default();
    let claude_dir = std::env::var("CLAUDE_CONFIG_DIR").unwrap_or(format!("{home}/.claude"));
    forget(Path::new(&claude_dir), &session_dir);
}
