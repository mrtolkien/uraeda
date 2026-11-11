//! What the other domains left to the sessions: a feature's status and record, what needs the
//! human, the writes that wait for an agent, a start's first run and the messages kept for it,
//! a drop, Continue all, the recommended message, a process's token, the chat images'
//! cleanup, and what the extensions give and hear.

use std::fs;
use std::time::Duration;

use serde_json::{Value, json};
use uraeda_server::runner::{Event, NewSession, NewTurn, Origin, Store, TurnKind, TurnState};
use uraeda_server::runtimes::{Runtimes, Tools};

use super::{AGENT, FAKE_ONLY, HUMAN, REPO, Stage, done, event, register, script, stage};
use crate::support::{self, Held, Hook, fixture_repo, fixture_text, idle, read};

/// A record of one thing of the tests' repository, read once.
async fn of_item(stage: &Stage, record: &str, id: &str) -> Value {
    read(&stage.server, record, json!({ "repo": REPO, "id": id })).await
}

/// Sends a text to a change or a feature, as a chat: the session and the turn it went to.
async fn chat_on(stage: &Stage, folder: &str, text: &str) -> (String, String) {
    let sent = stage
        .done("session.send", json!({ "folder": folder, "text": text }))
        .await;
    let text = |field: &str| {
        sent[field]
            .as_str()
            .expect("a session and a turn")
            .to_owned()
    };
    (text("session"), text("turn"))
}

/// Sends a feature its step's message, as its page does: the session and the turn it went to.
async fn run_on(stage: &Stage, folder: &str) -> (String, String) {
    let run = json!({
        "folder": folder,
        "text": "/uraeda Continue the feature.",
        "workflow": { "trigger": "manual" },
    });
    let sent = stage.done("session.send", run).await;
    let text = |field: &str| {
        sent[field]
            .as_str()
            .expect("a session and a turn")
            .to_owned()
    };
    (text("session"), text("turn"))
}

// The feature status decision: a feature follows its sessions first. While one works it reads
// "Working", whatever its step, and every write of its files waits: a save, an upload. A
// chat's agent holds the main checkout the same way, and a repository an agent works in stays
// in the list. Once the turn ended, the feature reads its step again, with its agent's time
// and tokens.
#[tokio::test]
async fn a_feature_follows_its_sessions_and_its_writes_wait_for_its_agent() {
    let stage = stage().await;
    let before = of_item(&stage, "Feature", HUMAN).await;
    assert_eq!(
        (
            &before["status"]["status"],
            &before["status"]["reason"],
            &before["session"]
        ),
        (&json!("needs-you"), &json!("step"), &Value::Null)
    );
    assert_eq!(
        (&before["agent"], &before["tokens"]),
        (&Value::Null, &Value::Null)
    );

    let (session, turn) = chat_on(&stage, HUMAN, "Why these questions?").await;
    stage.turn_in(&turn, "running").await;
    let working = of_item(&stage, "Feature", HUMAN).await;
    assert_eq!(working["status"]["status"], "working");
    assert_eq!(working["status"]["session"], session);
    assert_eq!(
        (
            &working["session"],
            &working["sessions"],
            &working["runtime"]
        ),
        (&json!(session), &json!([session]), &json!("fake"))
    );
    let workspace = read(&stage.server, "Workspace", json!({ "repo": REPO })).await;
    let rows = workspace["features"].as_array().expect("features");
    let row = rows
        .iter()
        .find(|row| row["id"] == HUMAN)
        .expect("the feature");
    assert_eq!(row["status"]["status"], "working");

    // Its files wait for its agent: a save of its round, and an upload beside its proposal.
    let busy = "An agent is working on this feature. Stop it first, or wait for it.";
    let notes = json!({ "folder": HUMAN, "notes": "Fine by me.", "previous": "" });
    assert_eq!(stage.refused("notes.save", notes).await, busy);
    let cookie = stage.server.sign_in().await;
    let path = format!("/r/{REPO}/attach?name=a.png&path=specs/{HUMAN}/proposal.md");
    let upload = stage
        .server
        .post(&path)
        .cookie(&cookie)
        .body(Vec::new())
        .send()
        .await;
    assert_eq!(upload.status, 400);
    assert_eq!(upload.json()["error"], format!("refused: {busy}"));
    // The list keeps a repository an agent works in.
    let remove = support::call(
        &stage.server,
        "repositories.remove",
        json!({ "name": REPO }),
    );
    let (_, refused) = remove.await.expect_err("a refusal");
    assert_eq!(
        refused,
        format!("An agent is working in {REPO}: stop it first.")
    );

    // The turn ends: the feature reads its step again, with its agent's time and tokens.
    let total = json!({ "cacheRead": 90, "cacheWrite": 10, "input": 5, "output": 7 });
    stage
        .fake
        .emit(event(json!({ "type": "tokens", "total": total })));
    stage.fake.emit(done());
    stage.turn_in(&turn, "done").await;
    let after = of_item(&stage, "Feature", HUMAN).await;
    assert_eq!(
        (
            &after["status"]["status"],
            &after["status"]["reason"],
            &after["status"]["turn"]
        ),
        (&json!("needs-you"), &json!("step"), &json!(turn))
    );
    assert_eq!(after["agent"]["runningSince"], Value::Null);
    assert_eq!(
        (&after["tokens"]["input"], &after["tokens"]["output"]),
        (&json!(15), &json!(7))
    );
    let notes = json!({ "folder": HUMAN, "notes": "Fine by me.", "previous": "" });
    stage.done("notes.save", notes).await;

    // A chat works in the main checkout: the Git page's writes of it wait.
    let chat = stage.chat().await;
    let turn = stage.send(&chat, "Tidy the README").await;
    stage.turn_in(&turn, "running").await;
    stage.repo.write("notes.md", "A note.\n");
    let staged = stage
        .refused("git.stage", json!({ "paths": ["notes.md"] }))
        .await;
    assert_eq!(
        staged,
        "An agent works in this checkout: wait for its turn to end."
    );
    stage.server.stop().await;
}

// The notifications decision: a chat whose agent was refused an action asks for the human, as
// a feature does, until the action is allowed.
#[tokio::test]
async fn a_chat_refused_an_action_needs_the_human() {
    let stage = stage().await;
    let chat = stage.chat().await;
    let attempt = json!([
        { "try": { "id": "t1", "tool": "Bash", "input": { "command": "curl example.com" } } },
    ]);
    stage.fake.script(script(attempt));
    let turn = stage.send(&chat, "Fetch the page").await;
    stage.turn_in(&turn, "done").await;

    let mut needs = Held::open(&stage.server, "NeedsYouList", Value::Null).await;
    let id = format!("{REPO}/sessions/{chat}");
    let asks = |list: &Value| {
        let rows = list["rows"].as_array().expect("rows");
        rows.iter().any(|row| row["id"] == id.as_str())
    };
    let list = needs.until("the chat to ask", asks).await.clone();
    let rows = list["rows"].as_array().unwrap();
    let row = rows.iter().find(|row| row["id"] == id.as_str()).unwrap();
    assert_eq!(
        (&row["reason"], &row["message"], &row["title"]),
        (
            &json!("blocked"),
            &json!("The agent was refused an action"),
            &json!("Fetch the page")
        )
    );
    assert_eq!(row["href"], format!("/r/{REPO}/sessions/{chat}"));
    assert_eq!(row["key"], format!("{id}:blocked:{turn}"));
    stage.server.stop().await;
}

// A change starts with its agent at work: its first run goes to a session made for it, in the
// change's worktree, with Uraeda's tools, and the start answers that session. Run options no
// new session could run on are refused before anything is written.
#[tokio::test]
async fn a_started_change_gets_its_first_run() {
    let stage = stage().await;
    let off = json!({ "steps": [{ "step": "build", "agent": "codex" }] });
    let text = "Fix the typo\n\nIn the README.";
    let refused = stage
        .refused("change.start", json!({ "text": text, "options": off }))
        .await;
    assert_eq!(refused, "Codex is off: turn it on to continue this session");

    let started = stage.done("change.start", json!({ "text": text })).await;
    let folder = started["folder"]
        .as_str()
        .expect("the change's folder")
        .to_owned();
    let session = started["session"]
        .as_str()
        .expect("its first run's session")
        .to_owned();
    let record = stage.read("Session", &session).await;
    assert_eq!(record["folder"], folder);
    let turn = record["turns"][0]
        .as_str()
        .expect("its first turn")
        .to_owned();
    let running = stage.turn_in(&turn, "running").await;
    assert_eq!(
        (&running["kind"], &running["trigger"], &running["step"]),
        (&json!("workflow"), &json!("start"), &json!("change"))
    );
    let sent = stage.fake.sent();
    let wanted = format!("/uraeda Continue the change specs/changes/{folder}/ on branch");
    assert!(sent[0].text.starts_with(&wanted), "{}", sent[0].text);
    let opened = stage.fake.opens().pop().expect("its process");
    assert!(
        opened.cwd.ends_with(format!(".worktrees/{folder}")),
        "{:?}",
        opened.cwd
    );
    assert!(matches!(opened.tools, Tools::Uraeda { .. }));
    // The start showed its agent's step, done once the run was sent.
    assert_eq!(idle(&stage.server, REPO).await, Vec::<String>::new());
    stage.server.stop().await;
}

// A message sent to a feature whose start still lands is not lost, and not refused: it is
// kept, and goes to the feature's session once the start landed, in the feature's worktree.
#[tokio::test]
async fn a_message_to_a_feature_whose_start_lands_is_kept_and_sent_once_it_landed() {
    let stage = stage().await;
    let hook = Hook::held(&stage.repo);
    let proposal = json!({ "proposal": "specs/proposals/git-listener.md" });
    let plan = stage.done("feature.start", proposal).await;
    let folder = plan["folder"].as_str().expect("the folder").to_owned();
    let message = plan["message"]
        .as_str()
        .expect("its first message")
        .to_owned();

    let run = json!({ "folder": folder, "text": message, "workflow": { "trigger": "start" } });
    let kept = stage.done("session.send", run).await;
    let session = kept["session"]
        .as_str()
        .expect("the session made for it")
        .to_owned();
    assert_eq!(kept["turn"], Value::Null, "kept, not sent yet");
    assert_eq!(stage.fake.sent().len(), 0);

    hook.release();
    let mut held = stage.held("Session", &session).await;
    let started = |session: &Value| {
        session["turns"]
            .as_array()
            .is_some_and(|turns| turns.len() == 1)
    };
    let turn = held.until("the kept message to go", started).await["turns"][0].clone();
    let turn = stage.turn_in(turn.as_str().unwrap(), "running").await;
    assert_eq!(
        (&turn["kind"], &turn["trigger"], &turn["step"]),
        (&json!("workflow"), &json!("start"), &json!("discovery"))
    );
    assert_eq!(stage.fake.sent()[0].text, message);
    let opened = stage.fake.opens().pop().expect("its process");
    assert!(
        opened.cwd.ends_with(format!(".worktrees/{folder}")),
        "{:?}",
        opened.cwd
    );
    stage.server.stop().await;
}

// A drop is refused while the feature's agent works, and once it landed its sessions are
// archived: they leave the feature's lists, and take no message, so no run ever makes its
// worktree again.
#[tokio::test]
async fn a_dropped_features_sessions_are_archived_and_take_no_message() {
    let stage = stage().await;
    let (session, turn) = run_on(&stage, AGENT).await;
    stage.turn_in(&turn, "running").await;
    let working = stage
        .refused("feature.drop", json!({ "folder": AGENT }))
        .await;
    assert_eq!(working, "The agent is working");

    stage
        .done("session.stop", json!({ "session": session }))
        .await;
    stage.turn_in(&turn, "stopped").await;
    stage.done("feature.drop", json!({ "folder": AGENT })).await;
    assert_eq!(idle(&stage.server, REPO).await, Vec::<String>::new());
    let mut held = stage.held("Session", &session).await;
    held.until("the session to be archived", |session| {
        session["archived"] == true
    })
    .await;
    let send = json!({ "session": session, "text": "Go on" });
    let dropped = stage.refused("session.send", send).await;
    assert_eq!(
        dropped,
        "This change or feature was dropped: its branch stays."
    );
    stage.server.stop().await;
}

// Continue all sends each feature whose run stopped and asks its step's message, in its
// session, which goes on: a feature at a gate is the human's, and is left alone.
#[tokio::test]
async fn continue_all_continues_the_runs_that_stopped_and_ask() {
    let stage = stage().await;
    let (session, turn) = run_on(&stage, AGENT).await;
    stage.turn_in(&turn, "running").await;
    stage
        .done("session.stop", json!({ "session": session }))
        .await;
    stage.turn_in(&turn, "stopped").await;
    let feature = of_item(&stage, "Feature", AGENT).await;
    assert_eq!(
        (&feature["status"]["status"], &feature["status"]["reason"]),
        (&json!("attention"), &json!("stopped"))
    );
    let recommended = of_item(&stage, "RecommendedMessage", AGENT).await;
    let message = recommended["text"]
        .as_str()
        .expect("its step's message")
        .to_owned();

    let continued = stage.done("feature.continueAll", json!({})).await;
    assert_eq!(continued["refused"], json!([]));
    let mut held = stage.held("Session", &session).await;
    let went_on = |session: &Value| {
        session["turns"]
            .as_array()
            .is_some_and(|turns| turns.len() == 2)
    };
    let next = held.until("the run to go on", went_on).await["turns"][1].clone();
    let next = stage.turn_in(next.as_str().unwrap(), "running").await;
    assert_eq!(
        (&next["kind"], &next["trigger"]),
        (&json!("workflow"), &json!("manual"))
    );
    assert_eq!(stage.fake.sent().last().unwrap().text, message);
    // The feature at a gate got no run.
    assert_eq!(
        of_item(&stage, "Feature", HUMAN).await["session"],
        Value::Null
    );
    stage.server.stop().await;
}

// A message is offered only when its agent can take it: with the runtime gone, the
// recommended message says why, and a message sent all the same is refused in the same words.
#[tokio::test]
async fn an_agent_that_is_not_available_takes_no_message_and_says_why() {
    let stage = stage().await;
    let offered = of_item(&stage, "RecommendedMessage", AGENT).await;
    assert_eq!(offered["reason"], Value::Null);
    assert_eq!(offered["trigger"], "manual");
    let chat = stage.chat().await;

    // The agent goes: the server's own check finds it, a moment after the runtimes changed.
    let mut agent = Held::open(&stage.server, "Agent", json!({ "repo": REPO })).await;
    let mut offered = stage.held("RecommendedMessage", AGENT).await;
    stage.fake.set(|fake| fake.installed = false);
    stage.server.shared().get::<Runtimes>().changed();
    let found = |agent: &Value, name: &str| {
        let rows = agent["runtimes"].as_array().expect("the runtimes");
        rows.iter()
            .find(|row| row["id"] == name)
            .cloned()
            .expect("a runtime")
    };
    let agent = agent
        .until("the check to find the agent gone", |agent| {
            found(agent, "fake")["available"] == false
        })
        .await
        .clone();
    let gone = "Fake agent is not available on this machine.";
    let offered = offered
        .until("the message to be withdrawn", |offered| {
            offered["reason"] == gone
        })
        .await;
    assert_eq!(offered["text"], "");
    let send = json!({ "session": chat, "text": "Hello" });
    assert_eq!(stage.refused("session.send", send).await, gone);
    let fake = found(&agent, "fake");
    assert_eq!(
        (&fake["available"], &fake["isOn"]),
        (&json!(false), &json!(true))
    );
    let rows = agent["runtimes"].as_array().expect("the runtimes");
    let claude = rows
        .iter()
        .find(|row| row["id"] == "claude")
        .expect("the built-in");
    assert_eq!(claude["isOn"], false, "{FAKE_ONLY}");
    stage.server.stop().await;
}

// A process's token of the MCP endpoint ends with the process: a token that outlived it
// would let whatever kept it call the tools for a session that no longer runs.
#[tokio::test]
async fn a_process_token_ends_with_its_process() {
    let stage = stage().await;
    let (_, turn) = run_on(&stage, AGENT).await;
    stage.turn_in(&turn, "running").await;
    let Tools::Uraeda { token, .. } = stage.fake.opens().pop().unwrap().tools else {
        panic!("a workflow session gets Uraeda's tools");
    };
    let list = json!({ "jsonrpc": "2.0", "id": 1, "method": "tools/list" });
    let listed = stage
        .server
        .post("/mcp")
        .bearer(&token)
        .json(&list)
        .send()
        .await;
    assert_eq!(listed.status, 200, "{}", listed.text());

    stage.fake.exit(1, "The agent crashed.");
    let failed = stage.turn_in(&turn, "failed").await;
    assert_eq!(failed["reason"], "The agent crashed.");
    let listed = stage
        .server
        .post("/mcp")
        .bearer(&token)
        .json(&list)
        .send()
        .await;
    assert_eq!(listed.status, 401);
    stage.server.stop().await;
}

// The chat images no message holds are deleted as the server starts, once a day old: one a
// composer may still send, and one a sent message shows, are kept.
#[tokio::test]
async fn the_chat_images_no_message_holds_are_cleaned_once_a_day_old() {
    let stage = stage().await;
    let images = stage.server.data_dir().join("images");
    fs::create_dir_all(&images).unwrap();
    let now = stage.server.clock().now();
    let written = |name: &str, age: Duration| {
        let path = images.join(name);
        fs::write(&path, b"webp").unwrap();
        let file = fs::File::options().write(true).open(&path).unwrap();
        file.set_modified(now - age).unwrap();
        path
    };
    let day = Duration::from_secs(24 * 60 * 60);
    let old = written("11111111-1111-4111-8111-111111111111.webp", 2 * day);
    let recent = written("22222222-2222-4222-8222-222222222222.webp", day / 2);
    let held = written("33333333-3333-4333-8333-333333333333.webp", 2 * day);
    // A sent message holds the third.
    let store = stage.server.shared().get::<Store>();
    let chat = NewSession {
        repo: stage.repo.path().to_string_lossy().into_owned(),
        folder: None,
        parent: None,
        role: None,
        step: None,
        worktree: None,
        agent: "fake".to_owned(),
        native_id: "native".to_owned(),
        title: None,
        model: None,
        effort: None,
    };
    let session = store.create_session(chat, now).unwrap();
    let turn = NewTurn {
        session_id: session.id,
        kind: TurnKind::Chat,
        trigger: None,
        step: None,
        allowed: None,
        caught_up_to: None,
        state: TurnState::Queued,
    };
    let turn = store.add_turn(turn, now).unwrap();
    let image =
        json!({ "id": "33333333-3333-4333-8333-333333333333.webp", "width": 1, "height": 1 });
    let message = Event::Message {
        id: "m1".to_owned(),
        origin: Origin::Human,
        text: "Look".to_owned(),
        opening: None,
        images: vec![serde_json::from_value(image).unwrap()],
    };
    store.append(turn, now, &message).unwrap();
    drop(store);

    let Stage { repo, server, .. } = stage;
    let server = server.restart().await;
    let gone = async {
        while old.exists() {
            tokio::time::sleep(Duration::from_millis(10)).await;
        }
    };
    let cleaned = tokio::time::timeout(Duration::from_secs(10), gone).await;
    assert!(cleaned.is_ok(), "the old image nobody holds is deleted");
    assert!(recent.exists() && held.exists());
    drop(repo);
    server.stop().await;
}

// The extensions' contracts: an extension's skills reach the agent's process, and the sessions
// say what happens to the extensions that listen: a session made, a turn ended.
#[tokio::test]
async fn an_extensions_skills_reach_the_agent_and_its_listeners_hear_the_sessions() {
    let repo = fixture_repo(REPO);
    let file = |name: &str| fixture_text(&format!("extensions/listener/{name}"));
    let setup = support::setup()
        .config("config.toml", FAKE_ONLY)
        .config(
            "extensions/listener/extension.toml",
            &file("extension.toml"),
        )
        .config("extensions/listener/server.ts", &file("server.ts"))
        .config("extensions/listener/skills/notes/SKILL.md", "# Notes\n");
    let server = setup.folder(repo.path()).start().await;
    let fake = register(&server).await;
    let stage = Stage { repo, server, fake };
    let events = json!({ "repo": REPO, "extension": "listener", "name": "events" });
    let mut heard = Held::open(&stage.server, "ExtensionRecord", events).await;
    heard
        .until("the extension to load", |record| record["error"].is_null())
        .await;

    let chat = stage.chat().await;
    stage
        .fake
        .script(script(json!([{ "type": "text", "text": "Hello." }])));
    let turn = stage.send(&chat, "Hello").await;
    stage.turn_in(&turn, "done").await;
    let skills = stage.server.config_dir().join("extensions/listener/skills");
    assert_eq!(stage.fake.opens()[0].skills, [skills]);
    let both = |record: &Value| {
        record["value"]
            .as_array()
            .is_some_and(|events| events.len() >= 2)
    };
    let events = heard.until("the session's events", both).await["value"].clone();
    let named: Vec<(&Value, &Value)> = events
        .as_array()
        .unwrap()
        .iter()
        .map(|event| (&event["event"], &event["payload"]["session"]))
        .collect();
    assert_eq!(
        named,
        [
            (&json!("session-started"), &json!(chat)),
            (&json!("turn-ended"), &json!(chat)),
        ]
    );
    assert_eq!(events[0]["payload"]["runtime"], "fake");
    assert_eq!(events[1]["payload"]["state"], "done");
    stage.server.stop().await;
}
