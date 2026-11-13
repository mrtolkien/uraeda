//! What an extension reaches: files, commands, and the web through Uraeda's modules, the
//! events of its repositories, and the runtime contract.

use std::path::PathBuf;
use std::time::Duration;

use serde_json::{Value, json};
use uraeda_server::extensions::{self, Happened};
use uraeda_server::runner::{Denial, Event};
use uraeda_server::runtimes::{Options, Outgoing, Runtimes, Tools, When};

use super::support::fixture_repo;
use super::{REPO, act, in_state, loaded, started};

// An extension's server code has no Node: `uraeda:fs`, `uraeda:process`, and `fetch` are what
// it reaches the owner's files, commands, and the web through.
#[tokio::test]
async fn an_extension_reaches_files_commands_and_the_web_through_uraedas_modules() {
    let repo = fixture_repo(REPO);
    let server = started(&repo, &["busy"]).await;
    loaded(&server, "busy", "child").await;
    let folder = tempfile::tempdir().unwrap();
    // A page the server itself answers, as the test gets it.
    let url = format!("{}/session", server.address());
    let status = server.get("/session").send().await.status;

    let input = json!({ "folder": folder.path(), "url": url });
    let probed = act(&server, "busy", "probe", input)
        .await
        .expect("the probe");

    let expected = json!({
        "code": 3,
        "listed": [{ "name": "one.txt", "kind": "file" }],
        // A command's output comes line by line, its blank lines left out.
        "lines": ["one"],
        "missing": true,
        "name": "one.txt",
        "relative": "notes/one.txt",
        "size": 13,
        "status": status,
        "stderr": "two",
        "text": "written twice",
    });
    assert_eq!(probed, expected);
    let written = std::fs::read_to_string(folder.path().join("notes/one.txt")).unwrap();
    assert_eq!(written, "written twice");
    server.stop().await;
}

/// The next events of a process, as JSON, to its `exit` or to `most`.
async fn events(process: &mut uraeda_server::runtimes::Events, most: usize) -> Vec<Value> {
    let mut events = Vec::new();
    while events.len() < most {
        let next = tokio::time::timeout(Duration::from_secs(10), process.next()).await;
        match next.expect("the process's next event") {
            Some(event) => events.push(serde_json::to_value(event).unwrap()),
            None => break,
        }
    }
    events
}

// The runtime contract (rulings R97 to R102), implemented in an extension's VM: its runtime
// is registered under the extension's name, runs a turn as any other, and leaves the registry
// with its extension, its open process ended by one `exit`.
#[tokio::test]
async fn an_extensions_runtime_runs_a_turn_and_leaves_with_its_extension() {
    let repo = fixture_repo(REPO);
    let server = started(&repo, &["agent"]).await;
    in_state(&server, "agent", "on").await;
    let runtimes = server.shared().get::<Runtimes>();
    let runtime = runtimes.get("agent").expect("the extension's runtime");

    let asked = runtime.clone();
    let described = tokio::task::spawn_blocking(move || {
        let denial = Denial {
            input: serde_json::Map::new(),
            tool: "Bash".to_owned(),
        };
        (
            asked.name(),
            asked.kind(),
            asked.capabilities().take_back,
            asked.version(),
            asked.has_session("known", None),
            asked.has_session("other", None),
            asked.allow_rule(&denial),
            asked
                .models()
                .expect("its models")
                .map(|list| list.models[0].id.clone()),
        )
    });
    let expected = (
        "Echo agent".to_owned(),
        "echo".to_owned(),
        true,
        Some("1.2.3".to_owned()),
        true,
        false,
        Some("allow Bash".to_owned()),
        Some("small".to_owned()),
    );
    assert_eq!(described.await.unwrap(), expected);
    its_accounts(runtime.clone()).await;
    assert!(runtimes.is_on("agent", Some(REPO)));

    let options = Options {
        cwd: PathBuf::from("/work"),
        native_id: "n1".to_owned(),
        resume: false,
        model: None,
        effort: None,
        account: None,
        allowed: Vec::new(),
        skills: Vec::new(),
        tools: Tools::Own,
    };
    let opening = runtime.clone();
    let mut process = tokio::task::spawn_blocking(move || opening.open(options))
        .await
        .unwrap();
    let mut stream = process.events();
    process.send(Outgoing {
        id: "m1".to_owned(),
        text: "hello".to_owned(),
        images: Vec::new(),
        when: When::Queue,
        review: false,
    });
    let turn = events(&mut stream, 4).await;
    let kinds: Vec<&str> = turn
        .iter()
        .map(|event| event["type"].as_str().unwrap())
        .collect();
    assert_eq!(kinds, ["init", "accepted", "text", "result"]);
    assert_eq!(turn[0]["sessionId"], "echo-n1");
    assert_eq!(turn[2]["text"], "You said: hello");
    assert!(
        !process.set_effort(Some("high")),
        "a process without `setEffort` is reopened"
    );

    // The extension goes: its runtime leaves the registry, and its process ends with one exit.
    std::fs::remove_dir_all(server.config_dir().join("extensions/agent")).unwrap();
    let last = events(&mut stream, 10).await;
    assert_eq!(
        last,
        [serde_json::to_value(Event::Exit {
            code: None,
            missing: None,
            stderr: String::new()
        })
        .unwrap()]
    );
    for _ in 0..100 {
        if runtimes.get("agent").is_none() {
            break;
        }
        tokio::time::sleep(Duration::from_millis(50)).await;
    }
    assert!(
        runtimes.get("agent").is_none(),
        "the runtime left with its extension"
    );
    assert_eq!(runtimes.names(), ["claude", "codex"], "the built-ins stay");
    server.stop().await;
}

// The events of a repository reach the extensions on in it: a commit on its main checkout,
// which the one file watcher sees, and what the sessions say through `extensions::emit`.
#[tokio::test]
async fn a_repositorys_events_reach_the_extensions_that_listen() {
    let repo = fixture_repo(REPO);
    let server = started(&repo, &["listener"]).await;
    let mut heard = loaded(&server, "listener", "events").await;
    assert_eq!(heard.value["value"], json!([]));

    let ended = Happened::TurnEnded {
        repository: REPO.to_owned(),
        session: "s1".to_owned(),
        feature: None,
        state: "done".to_owned(),
    };
    extensions::emit(server.shared(), &ended);
    let first = |record: &Value| {
        record["value"]
            .as_array()
            .is_some_and(|events| events.len() == 1)
    };
    let events = heard.until("the turn's end", first).await;
    let payload = json!({
        "repository": REPO,
        "session": "s1",
        "feature": null,
        "state": "done",
        "time": "2026-11-10T09:00:00Z",
    });
    assert_eq!(
        events["value"][0],
        json!({ "event": "turn-ended", "payload": payload })
    );
    // An event of a repository the extension is not on in reaches nothing: it is on in every
    // listed one here, so one of a name not listed is sent, as the sessions' would be.
    let elsewhere = Happened::SessionStarted {
        repository: "elsewhere".to_owned(),
        session: "s2".to_owned(),
        runtime: "claude".to_owned(),
    };
    extensions::emit(server.shared(), &elsewhere);

    repo.write("notes.md", "a note\n");
    repo.commit("docs: a note");
    let landed = |record: &Value| {
        let events = record["value"].as_array();
        events.is_some_and(|events| events.iter().any(|event| event["event"] == "commit-landed"))
    };
    let events = heard.until("the commit", landed).await;
    let commit = events["value"]
        .as_array()
        .unwrap()
        .iter()
        .find(|event| event["event"] == "commit-landed");
    let payload = &commit.unwrap()["payload"];
    assert_eq!(
        (&payload["repository"], &payload["branch"]),
        (&json!(REPO), &json!("main"))
    );
    assert_eq!(payload["commit"].as_str().map(str::len), Some(40));
    server.stop().await;
}

// A runtime replaced in the middle of a turn would lose the process the turn runs on: while a
// session holds its extension, a save waits, and the extension says for whom.
#[tokio::test]
async fn a_runtimes_reload_waits_for_the_session_at_work_on_it() {
    let repo = fixture_repo(REPO);
    let server = started(&repo, &["agent"]).await;
    in_state(&server, "agent", "on").await;
    let runtimes = server.shared().get::<Runtimes>();
    let first = runtimes.get("agent").expect("the extension's runtime");

    let held = extensions::hold(server.shared(), "agent", "Fix the login");
    let file = server.config_dir().join("extensions/agent/server.ts");
    let saved = std::fs::read_to_string(&file).unwrap() + "// Saved.\n";
    std::fs::write(&file, saved).unwrap();
    let waiting = in_state(&server, "agent", "waiting").await;
    assert_eq!(waiting["waitingFor"], "Fix the login");
    let running = runtimes
        .get("agent")
        .expect("the version the session runs on");
    assert!(
        std::sync::Arc::ptr_eq(&first, &running),
        "the running version is kept"
    );

    drop(held);
    in_state(&server, "agent", "on").await;
    let second = runtimes.get("agent").expect("the saved version's runtime");
    assert!(
        !std::sync::Arc::ptr_eq(&first, &second),
        "the saved version runs"
    );
    server.stop().await;
}

/// The accounts of the extension's runtime, an optional part of the contract, each a call into
/// its VM: listed, named, with their problems, and the transcripts of each.
async fn its_accounts(runtime: std::sync::Arc<dyn uraeda_server::runtimes::Runtime>) {
    let asked = runtime;
    let accounts = tokio::task::spawn_blocking(move || {
        let accounts = asked.accounts().expect("its accounts");
        accounts.refresh(std::time::Duration::from_secs(60));
        let listed = accounts.list();
        (
            listed
                .iter()
                .map(|account| (account.name.clone(), account.windows[0].used))
                .collect::<Vec<_>>(),
            listed[0].asked_at.is_some() && listed[0].known,
            accounts.name_of("/accounts/one"),
            accounts.problems(),
            asked.has_session("known", Some("/accounts/apart")),
        )
    });
    assert_eq!(
        accounts.await.unwrap(),
        (
            vec![("one".to_owned(), 0.25)],
            true,
            "one".to_owned(),
            vec!["account two is signed out".to_owned()],
            false,
        )
    );
}
