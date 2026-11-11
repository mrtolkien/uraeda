//! `ura sandbox`: the server over the sample projects and the fake agent, without sign-in, its
//! state kept until a reset builds it again, as the sandbox decision says.

mod support;

use std::collections::BTreeSet;
use std::fs;

use serde_json::{Value, json};
use support::TestClient;
use tempfile::TempDir;
use uraeda_protocol::{ClientMessage, ServerMessage};
use uraeda_server::runtimes::Runtimes;
use uraeda_server::sandbox::{self, Mode, Prepare, Sandbox};
use uraeda_server::{Options, Server};

/// The sandbox's server on a free port, with the test's `PATH` alone.
fn options(built: &Sandbox, mode: Mode) -> Options {
    let path = std::env::var("PATH").unwrap_or_default();
    sandbox::options(built, 0, mode, vec![("PATH".to_owned(), path)])
}

/// Reads a record once over a connection that gives no sign-in.
async fn read_unsigned(server: &Server, record: &str, args: Value) -> ServerMessage {
    let mut client = TestClient::unsigned(server.port()).await;
    client.hello().await;
    let message = ClientMessage::Sub {
        id: 1,
        record: record.to_owned(),
        args,
    };
    client.send(&message).await;
    client.next().await
}

#[tokio::test]
async fn the_sandbox_answers_workspace_with_no_sign_in() {
    let folder = TempDir::new().unwrap();
    let built = sandbox::prepare(&folder.path().join("sandbox"), Prepare::default()).unwrap();
    let server = Server::start(options(&built, Mode::default()))
        .await
        .unwrap();
    let answer = read_unsigned(&server, "Workspace", json!({ "repo": "sample" })).await;
    let ServerMessage::Data { value, .. } = answer else {
        panic!("expected the workspace, got {answer:?}");
    };
    let folders: BTreeSet<&str> = value["features"]
        .as_array()
        .unwrap()
        .iter()
        .filter_map(|feature| feature["folder"].as_str())
        .collect();
    for folder in [
        "2026-10-17-redesign-clarifications",
        "2026-10-19-dark-mode",
        "2026-10-18-offline",
    ] {
        assert!(folders.contains(folder), "{folder} is not in {folders:?}");
    }
    // The list is locked: the machine's folders are not shown, and no repository joins it.
    let suggested = read_unsigned(&server, "FolderSuggestions", json!({ "text": "/" })).await;
    assert!(
        matches!(suggested, ServerMessage::Error { .. }),
        "{suggested:?}"
    );
    server.stop().await;

    // With sign-in kept, a connection without it is refused, and the start shows a key.
    let server = Server::start(options(&built, Mode { sign_in: true }))
        .await
        .unwrap();
    assert!(uraeda_server::sign_in::first_key(server.shared()).is_some());
    let mut client = TestClient::unsigned(server.port()).await;
    let refused = client.say_hello().await;
    assert!(
        matches!(refused, ServerMessage::Refused { .. }),
        "{refused:?}"
    );
    server.stop().await;
}

#[tokio::test]
async fn the_sandbox_starts_no_real_agent() {
    let folder = TempDir::new().unwrap();
    let built = sandbox::prepare(&folder.path().join("sandbox"), Prepare::default()).unwrap();
    let server = Server::start(options(&built, Mode::default()))
        .await
        .unwrap();
    let runtimes = server.shared().get::<Runtimes>();
    let names: Vec<String> = runtimes.names();
    assert_eq!(names, ["fake", "claude", "codex"]);
    for name in &names {
        let runtime = runtimes.get(name).unwrap();
        // Each is the fake under a built-in's mark: it runs no command of the machine.
        let kind = tokio::task::spawn_blocking(move || runtime.kind())
            .await
            .unwrap();
        assert_eq!(kind, "fake", "{name} is no fake");
    }
    server.stop().await;
}

/// What a sandbox holds, to compare two: each project's refs and status, the list, the
/// sessions' count, and the config folder's files.
fn fingerprint(built: &Sandbox) -> String {
    let mut print = String::new();
    let mut projects: Vec<_> = fs::read_dir(&built.projects)
        .unwrap()
        .map(|entry| entry.unwrap().path())
        .collect();
    projects.sort();
    for project in projects {
        let git = |args: &[&str]| {
            let output = std::process::Command::new("git")
                .args(args)
                .current_dir(&project)
                .output()
                .unwrap();
            String::from_utf8(output.stdout).unwrap()
        };
        let name = project.file_name().unwrap().to_string_lossy();
        print.push_str(&format!(
            "{name}\n{}",
            git(&["for-each-ref", "--format=%(refname) %(objectname)"])
        ));
        print.push_str(&git(&["status", "--porcelain"]));
    }
    let listed = uraeda_core::repositories::read(&built.data_dir).unwrap();
    let names: Vec<&str> = listed
        .iter()
        .map(|repository| repository.name.as_str())
        .collect();
    print.push_str(&format!("{names:?}\n"));
    let store = uraeda_server::runner::Store::open(&built.data_dir).unwrap();
    for repository in &listed {
        let root = repository.path.to_string_lossy();
        let sessions = store.sessions_of(&root, 1000, None).unwrap();
        print.push_str(&format!(
            "{} sessions: {}\n",
            repository.name,
            sessions.len()
        ));
    }
    store.close();
    print.push_str(&fs::read_to_string(built.config_dir.join("config.toml")).unwrap());
    print
}

/// Changes a sandbox as a human does while using it: a file of a project, a commit, and a job.
fn use_it(built: &Sandbox) {
    let sample = built.projects.join("sample");
    fs::write(sample.join("specs/INBOX.md"), "# Inbox\n\n- a note\n").unwrap();
    let empty = built.projects.join("empty");
    fs::write(empty.join("notes.md"), "notes\n").unwrap();
    let commit = std::process::Command::new("git")
        .args([
            "-c",
            "user.name=T",
            "-c",
            "user.email=t@t",
            "commit",
            "--quiet",
            "--allow-empty",
            "-m",
            "used",
        ])
        .current_dir(&empty)
        .env("GIT_CONFIG_GLOBAL", "/dev/null")
        .env("GIT_CONFIG_NOSYSTEM", "1")
        .status()
        .unwrap();
    assert!(commit.success());
    fs::write(built.config_dir.join("config.toml"), "").unwrap();
}

#[test]
fn a_reset_sandbox_is_the_same_as_a_new_one() {
    let folder = TempDir::new().unwrap();
    let (kept, fresh) = (folder.path().join("kept"), folder.path().join("fresh"));
    let built = sandbox::prepare(&kept, Prepare::default()).unwrap();
    let new = fingerprint(&built);
    use_it(&built);
    let used = fingerprint(&built);
    assert_ne!(used, new, "using the sandbox changes it");
    // Kept across a start, until a reset.
    let again = sandbox::prepare(&kept, Prepare::default()).unwrap();
    assert_eq!(fingerprint(&again), used);
    let reset = sandbox::prepare(
        &kept,
        Prepare {
            reset: true,
            ..Prepare::default()
        },
    )
    .unwrap();
    let other = sandbox::prepare(&fresh, Prepare::default()).unwrap();
    assert_eq!(fingerprint(&reset), fingerprint(&other));
    assert_eq!(fingerprint(&reset), new);
}
