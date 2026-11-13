//! The process a runtime runs its agent in: started in the server's environment, leading a
//! process group of its own, one JSON line per message both ways, and ended with everything it
//! started. The commands here are `sh` scripts, which stand in for an agent's.

use std::path::Path;

use serde_json::json;
use uraeda_server::runner::Event;
use uraeda_server::runtimes::{Child, Signal, Spawn};

use crate::support::{self, gone, group_members};

/// How `sh` runs a script in a folder, with one more variable.
fn sh(script: &str, cwd: &Path) -> Spawn {
    Spawn {
        program: "sh".to_owned(),
        args: vec!["-c".to_owned(), script.to_owned()],
        cwd: cwd.to_owned(),
        env: vec![("URAEDA_MCP_TOKEN".to_owned(), "its-token".to_owned())],
    }
}

/// A process's exit, as the event its runtime sends last.
fn exit(code: Option<i32>, stderr: &str) -> Event {
    Event::Exit {
        code,
        missing: None,
        stderr: stderr.to_owned(),
    }
}

#[tokio::test]
async fn an_agents_process_takes_json_lines_and_gives_its_own_until_its_exit() {
    let setup = support::setup().config(".env", "FROM_CONFIG=the-owners-secret\n");
    let server = setup.start().await;
    let script = r#"
        printf 'ready %s %s\r\n\n' "$FROM_CONFIG" "$URAEDA_MCP_TOKEN"
        while read -r line; do echo "got $line"; done
        echo "first words" >&2
        echo "last words" >&2
        exit 3
    "#;
    let mut child = Child::spawn(server.shared(), sh(script, server.data_dir()));
    let mut lines = child.lines();

    assert_eq!(
        lines.next().await.as_deref(),
        Some("ready the-owners-secret its-token"),
        "the server's environment, the config folder's secrets included, and its own variable"
    );
    child.write(&json!({ "type": "user", "text": "héllo" }));
    assert_eq!(
        lines.next().await.as_deref(),
        Some(r#"got {"type":"user","text":"héllo"}"#)
    );
    child.end_input();
    assert_eq!(lines.next().await, None, "blank lines are left out");
    assert_eq!(
        child.exited().await,
        exit(Some(3), "first words\nlast words")
    );
    // A process that exited takes no line, and no signal.
    child.write(&json!({ "late": true }));
    child.signal(Signal::Kill);
    server.stop().await;
}

#[tokio::test]
async fn a_command_that_cannot_start_exits_at_once_saying_why() {
    let server = support::server().await;
    let missing = Spawn {
        program: "no-such-agent-command".to_owned(),
        ..sh("", server.data_dir())
    };
    let mut child = Child::spawn(server.shared(), missing);
    assert_eq!(child.lines().next().await, None);
    let Event::Exit { code, missing, .. } = child.exited().await else {
        panic!("an exit");
    };
    assert_eq!(
        (code, missing),
        (None, Some(true)),
        "the command is missing"
    );

    let nowhere = server.data_dir().join("removed-worktree");
    let child = Child::spawn(server.shared(), sh("echo never", &nowhere));
    let why = format!("The session's directory is gone: {}", nowhere.display());
    assert_eq!(child.exited().await, exit(None, &why));
    server.stop().await;
}

#[tokio::test]
async fn a_signal_reaches_everything_an_agents_process_started() {
    let server = support::server().await;
    // A tool the agent started, which ignores the end of its input.
    let script = "sleep 600 & echo started; wait";
    let mut child = Child::spawn(server.shared(), sh(script, server.data_dir()));
    let mut lines = child.lines();
    assert_eq!(lines.next().await.as_deref(), Some("started"));
    let group = child.leader().expect("a running process");
    assert_eq!(group_members(group).len(), 2, "the shell and its sleep");

    child.end_input();
    child.signal(Signal::Terminate);

    assert_eq!(child.exited().await, exit(None, ""), "ended by a signal");
    assert_eq!(gone(group).await, Vec::<u32>::new());
    server.stop().await;
}

#[tokio::test]
async fn an_agents_process_that_exits_takes_what_it_started_with_it() {
    let server = support::server().await;
    // The agent exits, and a command it left running still holds its output open.
    let script = "sleep 600 & echo started; exit 0";
    let mut child = Child::spawn(server.shared(), sh(script, server.data_dir()));
    assert_eq!(child.lines().next().await.as_deref(), Some("started"));
    let group = child.leader().expect("a started process");

    assert_eq!(child.exited().await, exit(Some(0), ""));
    assert_eq!(gone(group).await, Vec::<u32>::new());
    server.stop().await;
}

#[tokio::test]
async fn the_server_stops_every_agent_process_when_it_stops() {
    let server = support::server().await;
    let shared = server.shared().clone();
    let script = "sleep 600 & echo started; wait";
    let mut child = Child::spawn(&shared, sh(script, server.data_dir()));
    assert_eq!(child.lines().next().await.as_deref(), Some("started"));
    let group = child.leader().expect("a running process");

    server.stop().await;

    assert_eq!(gone(group).await, Vec::<u32>::new(), "nothing outlives it");
    assert_eq!(child.exited().await, exit(None, ""));
    // A stopping server starts nothing more.
    let late = Child::spawn(&shared, sh("echo late", Path::new("/")));
    assert_eq!(late.exited().await, exit(None, "The server is stopping."));
}
