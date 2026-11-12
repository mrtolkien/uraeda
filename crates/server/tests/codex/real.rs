//! The one check against the real `codex`, run by hand: it uses the machine's `codex` and its
//! owner's account, for two short messages that ask for no command.
//!
//!   cargo nextest run -p uraeda-server -E 'test(/^codex::real::/)' --run-ignored only --no-capture
//!
//! Codex gets the sandbox the runtime asks for, `workspace-write`, in a session's folder that
//! is temporary and outside any repository.

use std::fs;
use std::path::PathBuf;
use std::process::Command;

use serde_json::Value;
use tempfile::TempDir;
use uraeda_server::runtimes::{Options, Runtimes};

use super::stage::{message, options, until};
use crate::support;

/// The machine's `codex`, as the test's own `PATH` finds it.
fn real_codex() -> PathBuf {
    let found = Command::new("sh").args(["-c", "command -v codex"]).output();
    let found = String::from_utf8(found.expect("sh runs").stdout).unwrap();
    assert!(!found.trim().is_empty(), "codex is installed");
    PathBuf::from(found.trim())
}

#[tokio::test]
#[ignore = "runs the real codex, with its owner's account: by hand only"]
async fn real_codex_runs_a_session_and_resumes_it() {
    let folders = TempDir::new().unwrap();
    let session = folders.path().join("session");
    fs::create_dir(&session).unwrap();
    let config = format!(
        "[extensions.codex]\ncommand = \"{}\"\n",
        real_codex().display()
    );
    let setup = support::setup()
        .config("config.toml", &config)
        .env("HOME", &std::env::var("HOME").unwrap());
    let server = setup.start().await;
    let runtimes = server.shared().get::<Runtimes>();
    let runtime = runtimes.get("codex").expect("the built-in runtime");

    let asked = runtime.clone();
    let (version, models) = tokio::task::spawn_blocking(move || (asked.version(), asked.models()))
        .await
        .unwrap();
    let models = models.expect("Codex lists its models").expect("a list");
    println!("version: {version:?}");
    println!(
        "models: {} listed, defaults {:?}",
        models.models.len(),
        models.defaults
    );
    assert!(version.is_some() && !models.models.is_empty());

    let kinds = |events: &[Value]| -> Vec<String> {
        let kinds = events.iter().map(|event| event["type"].as_str().unwrap());
        kinds.map(str::to_owned).collect()
    };
    let cheap = |options: Options| Options {
        model: Some("gpt-6-luna".to_owned()),
        effort: Some("low".to_owned()),
        ..options
    };
    let opening = runtime.clone();
    let opened = cheap(options(&session));
    let mut process = tokio::task::spawn_blocking(move || opening.open(opened))
        .await
        .unwrap();
    let mut events = process.events();
    process.send(message(
        "m1",
        "Without running any command, reply with the one word: ready",
    ));
    let read = until(&mut events, "result").await;
    println!("first turn: {:?}", kinds(&read));
    let init = read.iter().find(|event| event["type"] == "init").unwrap();
    assert_eq!(init.get("problem"), None, "{init}");
    let id = init["sessionId"].as_str().unwrap().to_owned();
    let runs_on = read.iter().find(|event| event["type"] == "runsOn");
    println!("runs on: {}", runs_on.expect("what it runs on"));
    let said = read.iter().rfind(|event| event["type"] == "text").unwrap();
    println!("said: {}", said["text"]);
    assert_eq!(read.last().unwrap()["ok"], true, "{read:?}");
    process.close();
    let exit = until(&mut events, "exit").await;
    assert_eq!(exit.last().unwrap()["code"], 0, "{exit:?}");
    assert!(
        runtime.has_session(&id, None),
        "its thread's file is in Codex's home"
    );

    // Resumed by its id, it keeps what was said.
    let opening = runtime.clone();
    let resumed = Options {
        native_id: id.clone(),
        resume: true,
        ..cheap(options(&session))
    };
    let mut process = tokio::task::spawn_blocking(move || opening.open(resumed))
        .await
        .unwrap();
    let mut events = process.events();
    process.send(message(
        "m2",
        "Without running any command: which one word did you just reply?",
    ));
    let read = until(&mut events, "result").await;
    println!("resumed turn: {:?}", kinds(&read));
    let init = read.iter().find(|event| event["type"] == "init").unwrap();
    assert_eq!(init["sessionId"], id.as_str(), "the same thread");
    let said = read.iter().rfind(|event| event["type"] == "text").unwrap();
    println!("said: {}", said["text"]);
    assert_eq!(read.last().unwrap()["ok"], true, "{read:?}");
    process.close();
    until(&mut events, "exit").await;
    server.stop().await;
}
