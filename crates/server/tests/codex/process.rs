//! A session's process: its thread, its turns, steered, queued, and taken-back messages, its
//! efforts, its review, and what keeps it from running. The cases of the Node runtime's tests,
//! on the stand-in that answers as Codex does.

use std::path::Path;
use std::sync::Arc;
use std::time::Duration;

use serde_json::{Value, json};
use uraeda_server::runtimes::codex::codex;
use uraeda_server::runtimes::{Options, ReviewAsk, Runtime};

use super::stage::{message, open_on, options, params, requests, stage, steer, until, written};

/// The methods the stand-in read, in order.
fn methods(dir: &Path) -> Vec<String> {
    let methods = requests(dir).into_iter();
    methods
        .map(|line| line["method"].as_str().unwrap().to_owned())
        .collect()
}

/// The `effort` of each `turn/start` the stand-in read: null when none was sent.
fn turn_efforts(dir: &Path) -> Vec<Value> {
    let turns = requests(dir).into_iter();
    let turns = turns.filter(|line| line["method"] == "turn/start");
    turns.map(|line| line["params"]["effort"].clone()).collect()
}

#[tokio::test]
async fn a_sessions_process_gives_its_skills_starts_its_thread_and_steers_or_takes_back() {
    let stage = stage(json!({})).await;
    let dir = stage.session_dir();
    let opened = Options {
        effort: Some("low".to_owned()),
        skills: vec!["/x/extensions/docs/skills".into()],
        ..options(&dir)
    };
    let mut process = stage.open(opened).await;
    let mut events = process.events();
    process.send(message("m1", "wait"));
    // No turn id yet: it waits in the runtime's queue, where it can be taken back.
    process.send(steer("m2", "taken back"));
    process.take_back("m2");
    assert_eq!(
        until(&mut events, "cancelled").await,
        [json!({ "id": "m2", "type": "cancelled" })]
    );
    assert_eq!(
        until(&mut events, "accepted").await,
        [
            json!({ "sessionId": "t-1", "type": "init" }),
            json!({ "id": "m1", "type": "accepted" }),
        ]
    );
    process.send(steer("m3", "also this"));
    let read = until(&mut events, "result").await;
    assert_eq!(read[0], json!({ "id": "m3", "type": "accepted" }));
    assert_eq!(read[1]["ok"], true);
    process.close();
    until(&mut events, "exit").await;

    assert_eq!(
        methods(&dir),
        [
            "initialize",
            "initialized",
            "skills/extraRoots/set",
            "model/list",
            "config/read",
            "model/list",
            "thread/start",
            "turn/start",
            "turn/steer",
        ]
    );
    // Uraeda's skill, which the server writes in its data folder, then the extensions'.
    let skills = stage.server.data_dir().join("plugin/skills");
    assert!(
        skills.join("uraeda/SKILL.md").is_file(),
        "the skill is there"
    );
    assert_eq!(
        params(&dir, "skills/extraRoots/set"),
        json!({ "extraRoots": [skills, "/x/extensions/docs/skills"] })
    );
    let turn = params(&dir, "turn/start");
    assert_eq!(
        (&turn["effort"], &turn["threadId"]),
        (&json!("low"), &json!("t-1"))
    );
    assert_eq!(
        params(&dir, "turn/steer"),
        json!({
            "expectedTurnId": "turn-1",
            "input": [{ "text": "also this", "text_elements": [], "type": "text" }],
            "threadId": "t-1",
        })
    );
    stage.stop().await;
}

/// Plays two turns, the effort reset to the agent's default between them.
async fn two_turns(opened: impl FnOnce(Options) -> Options) -> Vec<Value> {
    let stage = stage(json!({})).await;
    let dir = stage.session_dir();
    let mut process = stage.open(opened(options(&dir))).await;
    let mut events = process.events();
    process.send(message("m1", "Hi"));
    until(&mut events, "result").await;
    assert!(process.set_effort(None), "Codex changes its effort itself");
    process.send(message("m2", "Again"));
    until(&mut events, "result").await;
    process.close();
    until(&mut events, "exit").await;
    assert!(
        !process.set_effort(None),
        "a process that exited takes none"
    );
    let efforts = turn_efforts(&dir);
    stage.stop().await;
    efforts
}

#[tokio::test]
async fn an_effort_reset_goes_back_to_the_agents_default_which_codex_would_not_do_itself() {
    // Codex keeps a turn's effort for the next ones: the reset sends the default, the
    // configured one.
    let on_low = |options| Options {
        effort: Some("low".to_owned()),
        ..options
    };
    assert_eq!(two_turns(on_low).await, [json!("low"), json!("high")]);
    // A thread never given an effort sends none.
    assert_eq!(
        two_turns(|options| options).await,
        [Value::Null, Value::Null]
    );
    // A resumed thread on the default effort is given it, as it may keep another.
    let resumed = |options| Options {
        resume: true,
        ..options
    };
    assert_eq!(two_turns(resumed).await, [json!("high"), json!("high")]);
}

#[tokio::test]
async fn a_review_starts_codexs_own_on_a_custom_target_at_the_effort_its_thread_starts_on() {
    let stage = stage(json!({})).await;
    let dir = stage.session_dir();
    let opened = Options {
        effort: Some("low".to_owned()),
        ..options(&dir)
    };
    let mut process = stage.open(opened).await;
    let mut events = process.events();
    let ask = ReviewAsk {
        base: "abc".to_owned(),
        head: "def".to_owned(),
        effort: None,
        instructions: Some("Look at errors.".to_owned()),
    };
    let review = stage.runtime().review_message(&ask).expect("Codex reviews");
    assert!(review.review);
    assert!(review.text.contains("abc..def") && review.text.ends_with("\n\nLook at errors."));
    let mut sent = message("m1", &review.text);
    sent.review = review.review;
    process.send(sent);
    let read = until(&mut events, "result").await;
    assert!(read.contains(&json!({ "id": "m1", "type": "accepted" })));
    process.close();
    until(&mut events, "exit").await;

    let config = &params(&dir, "thread/start")["config"];
    assert_eq!(config["model_reasoning_effort"], "low");
    assert_eq!(
        params(&dir, "review/start"),
        json!({ "target": { "instructions": review.text, "type": "custom" }, "threadId": "t-1" })
    );
    assert!(!methods(&dir).contains(&"turn/start".to_owned()));
    stage.stop().await;
}

#[tokio::test]
async fn a_turn_that_completes_before_its_start_is_answered_still_accepts_its_message() {
    let stage = stage(json!({ "completesFirst": true })).await;
    let dir = stage.session_dir();
    let mut process = stage.open(options(&dir)).await;
    let mut events = process.events();
    process.send(message("m1", "Hi"));
    let read = until(&mut events, "accepted").await;
    let kinds: Vec<&Value> = read.iter().map(|event| &event["type"]).collect();
    assert_eq!(kinds, ["init", "result", "accepted"]);
    assert_eq!(read[1]["ok"], true);
    process.close();
    until(&mut events, "exit").await;
    stage.stop().await;
}

#[tokio::test]
async fn a_resumed_thread_reports_its_id_and_a_stopped_turn_ends_interrupted() {
    let stage = stage(json!({})).await;
    let dir = stage.session_dir();
    let opened = Options {
        native_id: "t-old".to_owned(),
        resume: true,
        ..options(&dir)
    };
    let mut process = stage.open(opened).await;
    let mut events = process.events();
    process.send(message("m1", "wait"));
    process.interrupt();
    let read = until(&mut events, "result").await;
    assert_eq!(read[0], json!({ "sessionId": "t-old", "type": "init" }));
    // Codex sends no settings update on resume: its answer says what the thread runs on.
    let runs_on = json!({ "effort": "Extra high", "model": "GPT-6-Luna", "type": "runsOn" });
    assert!(read.contains(&runs_on), "{read:?}");
    let result = read.last().unwrap();
    assert_eq!(
        (&result["interrupted"], &result["ok"]),
        (&json!(true), &json!(false))
    );
    process.close();
    until(&mut events, "exit").await;
    let resume = params(&dir, "thread/resume");
    assert_eq!(
        (&resume["excludeTurns"], &resume["threadId"]),
        (&json!(true), &json!("t-old"))
    );
    assert_eq!(resume.get("model"), None);
    stage.stop().await;
}

#[tokio::test]
async fn a_thread_codex_applied_other_permissions_to_does_not_run() {
    let network_on = json!({
        "excludeSlashTmp": false,
        "excludeTmpdirEnvVar": false,
        "networkAccess": true,
        "type": "workspaceWrite",
        "writableRoots": [],
    });
    let cases = [
        (
            json!({ "sandbox": { "type": "dangerFullAccess" } }),
            false,
            "danger-full-access",
        ),
        (json!({ "sandbox": network_on }), false, "the network on"),
        (
            json!({ "approvalPolicy": "never" }),
            true,
            "approval policy never",
        ),
        (
            json!({ "approvalsReviewer": "user" }),
            false,
            "the reviewer user",
        ),
    ];
    for (applied, resume, named) in cases {
        let stage = stage(json!({ "applied": applied })).await;
        let dir = stage.session_dir();
        let opened = Options {
            resume,
            ..options(&dir)
        };
        let mut process = stage.open(opened).await;
        let mut events = process.events();
        process.send(message("m1", "Hi"));
        let init = until(&mut events, "init").await.remove(0);
        assert_eq!(init["sessionId"], "");
        let problem = init["problem"].as_str().expect("a problem");
        assert!(problem.contains(named), "{problem}");
        assert!(problem.contains("Uraeda does not run it"), "{problem}");
        process.close();
        until(&mut events, "exit").await;
        assert!(!methods(&dir).contains(&"turn/start".to_owned()), "{named}");
        stage.stop().await;
    }
}

#[tokio::test]
async fn a_thread_that_does_not_start_in_time_fails_the_start_and_its_process_is_killed() {
    let stage = stage(json!({ "hang": "thread/start" })).await;
    let dir = stage.session_dir();
    let hasty = codex(stage.server.shared()).start_within(Duration::from_millis(200));
    let hasty: Arc<dyn Runtime> = Arc::new(hasty);
    let mut process = open_on(hasty, options(&dir)).await;
    let mut events = process.events();
    process.send(message("m1", "Hi"));
    let init = until(&mut events, "init").await;
    let problem = "Codex did not start the session: Codex did not answer within 0.2 seconds";
    assert_eq!(
        init,
        [json!({ "problem": problem, "sessionId": "", "type": "init" })]
    );
    // Killed, never closed.
    let exit = until(&mut events, "exit").await;
    assert_eq!(
        exit,
        [json!({ "code": null, "stderr": "", "type": "exit" })]
    );
    stage.stop().await;
}

#[tokio::test]
async fn a_steer_refused_after_a_failed_turn_waits_to_be_taken_back_and_starts_no_turn() {
    let stage = stage(json!({})).await;
    let dir = stage.session_dir();
    let mut process = stage.open(options(&dir)).await;
    let mut events = process.events();
    process.send(message("m1", "wait, then fail on steer"));
    until(&mut events, "accepted").await;
    process.send(steer("m2", "join it"));
    let read = until(&mut events, "result").await;
    assert_eq!(read.len(), 1);
    assert_eq!(read[0]["ok"], false);
    // The steer's refusal comes before the sessions take back what the failed turn left.
    for _ in 0..100 {
        if written(&dir).len() >= 9 {
            break;
        }
        tokio::time::sleep(Duration::from_millis(20)).await;
    }
    tokio::time::sleep(Duration::from_millis(100)).await;
    process.take_back("m2");
    assert_eq!(
        until(&mut events, "cancelled").await,
        [json!({ "id": "m2", "type": "cancelled" })]
    );
    process.close();
    until(&mut events, "exit").await;
    let turns = methods(&dir)
        .into_iter()
        .filter(|method| method == "turn/start");
    assert_eq!(turns.count(), 1);
    stage.stop().await;
}

#[tokio::test]
async fn a_process_closed_while_its_thread_fails_to_start_ends() {
    let stage = stage(json!({ "refuse": "thread/start" })).await;
    let dir = stage.session_dir();
    let mut process = stage.open(options(&dir)).await;
    let mut events = process.events();
    process.send(message("m1", "Hi"));
    process.close();
    // Closed already, it reports no problem: it ends.
    assert_eq!(
        until(&mut events, "exit").await,
        [json!({ "code": 0, "stderr": "", "type": "exit" })]
    );

    // Left open, it says why it does not run.
    let dir = stage.session_dir();
    let mut process = stage.open(options(&dir)).await;
    let mut events = process.events();
    let problem = "Codex did not start the session: Refused";
    assert_eq!(
        until(&mut events, "init").await,
        [json!({ "problem": problem, "sessionId": "", "type": "init" })]
    );
    process.close();
    until(&mut events, "exit").await;
    stage.stop().await;
}

#[tokio::test]
async fn a_codex_that_is_not_installed_is_an_exit_that_says_so() {
    let config = "[extensions.codex]\ncommand = \"no-such-codex-command\"\n";
    let stage = super::stage::staged(json!({}), |setup| setup.config("config.toml", config)).await;
    let dir = stage.session_dir();
    let mut process = stage.open(options(&dir)).await;
    let mut events = process.events();
    process.send(message("m1", "Hi"));
    let exit = until(&mut events, "exit").await;
    assert_eq!(exit.len(), 1, "{exit:?}");
    assert_eq!(
        (&exit[0]["code"], &exit[0]["missing"]),
        (&Value::Null, &json!(true))
    );
    let runtime = stage.runtime();
    let version = tokio::task::spawn_blocking(move || runtime.version());
    assert_eq!(version.await.unwrap(), None);
    stage.stop().await;
}
