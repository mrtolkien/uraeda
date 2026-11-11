//! What the runtime starts `codex` with and asks of it besides a session's turns: a thread's
//! permissions and configuration, Uraeda's tools, the catalog without Codex's own sub-agents,
//! a project's trust, a message's images, the models, the version, and a thread's file.

use std::fs;
use std::path::Path;

use serde_json::{Value, json};
use uraeda_server::runtimes::{Options, Runtimes, SentImage, Tools};

use crate::stage::{Stage, message, options, params, stage, staged, until, written};

/// The arguments a session's stand-in was started with.
fn argv(dir: &Path) -> Value {
    let argv = fs::read_to_string(dir.join("argv")).expect("the stand-in started");
    serde_json::from_str(argv.lines().next().unwrap()).unwrap()
}

/// Plays one turn of a session, and closes it: its events.
async fn one_turn(stage: &Stage, opened: Options, text: &str) -> Vec<Value> {
    let mut process = stage.open(opened).await;
    let mut events = process.events();
    process.send(message("m1", text));
    let mut read = until(&mut events, "result").await;
    process.close();
    read.extend(until(&mut events, "exit").await);
    read
}

/// The permissions every thread is asked with.
fn assert_permissions(dir: &Path, method: &str) {
    let thread = params(dir, method);
    let asked = (
        &thread["approvalPolicy"],
        &thread["approvalsReviewer"],
        &thread["sandbox"],
    );
    assert_eq!(
        asked,
        (
            &json!("on-request"),
            &json!("auto_review"),
            &json!("workspace-write")
        )
    );
    let text = thread.to_string();
    assert!(
        !text.contains("danger") && !text.contains("\"never\""),
        "{text}"
    );
}

#[tokio::test]
async fn a_thread_is_asked_with_its_permissions_and_its_projects_trust() {
    let stage = stage(json!({})).await;

    // A chat: the model picked, the permissions, and one override, the project's trust, which
    // Codex would otherwise write to the owner's settings.
    let chat = stage.session_dir();
    let opened = Options {
        model: Some("gpt-6-astra".to_owned()),
        ..options(&chat)
    };
    one_turn(&stage, opened, "Hi").await;
    assert_permissions(&chat, "thread/start");
    let thread = params(&chat, "thread/start");
    assert_eq!(
        (&thread["cwd"], &thread["model"]),
        (&json!(chat), &json!("gpt-6-astra"))
    );
    assert_eq!(
        thread["config"],
        json!({ "projects": { chat.to_str().unwrap(): { "trust_level": "trusted" } } })
    );
    // Uraeda runs what the extensions folder holds: writing there is reviewed first.
    let instructions = thread["developerInstructions"].as_str().unwrap();
    let sandbox = instructions
        .split("# Sandbox")
        .nth(1)
        .expect("the sandbox's section");
    let extensions = stage.server.config_dir().join("extensions");
    let folder = format!(
        "Writing in `{}`, your extensions folder, needs escalated",
        extensions.display()
    );
    assert!(sandbox.contains(&folder), "{sandbox}");
    let docs = stage.server.data_dir().join("docs/extensions.md");
    assert!(instructions.contains(&format!("documented in `{}`", docs.display())));
    assert!(
        docs.is_file() && extensions.is_dir(),
        "both are there for the session"
    );
    // It keeps Codex's own catalog, and its sub-agents.
    assert_eq!(argv(&chat), json!(["app-server"]));
    assert_eq!(fs::read_to_string(chat.join("token")).unwrap(), "");
    assert_eq!(
        params(&chat, "turn/start")["sandboxPolicy"],
        json!({
            "excludeSlashTmp": false,
            "excludeTmpdirEnvVar": false,
            "networkAccess": false,
            "type": "workspaceWrite",
            "writableRoots": [],
        })
    );

    stage.stop().await;
}

#[tokio::test]
async fn a_workflow_session_gets_uraedas_tools_and_no_sub_agents_of_codexs() {
    let stage = stage(json!({})).await;

    // A workflow session: Uraeda's tools, approved and parallel, and none of Codex's
    // sub-agents, through the catalog its process runs on.
    let workflow = stage.session_dir();
    let tools = Tools::Uraeda {
        url: "http://127.0.0.1:4000/mcp".to_owned(),
        token: "secret-token".to_owned(),
    };
    let opened = Options {
        tools,
        ..options(&workflow)
    };
    one_turn(&stage, opened, "Hi").await;
    assert_permissions(&workflow, "thread/start");
    let server = json!({
        "bearer_token_env_var": "URAEDA_MCP_TOKEN",
        "default_tools_approval_mode": "approve",
        "supports_parallel_tool_calls": true,
        "tool_timeout_sec": 7200,
        "url": "http://127.0.0.1:4000/mcp",
    });
    assert_eq!(
        params(&workflow, "thread/start")["config"]["mcp_servers"],
        json!({ "uraeda": server })
    );
    // The token reaches Codex through its environment, never its configuration or arguments.
    assert_eq!(
        fs::read_to_string(workflow.join("token")).unwrap(),
        "secret-token"
    );
    let said = format!("{:?}{}", written(&workflow), argv(&workflow));
    assert!(!said.contains("secret-token"));
    let started = argv(&workflow);
    let catalog = started[2]
        .as_str()
        .unwrap()
        .strip_prefix("model_catalog_json=");
    let catalog: String = serde_json::from_str(catalog.expect("a catalog")).unwrap();
    assert_eq!(
        (&started[0], &started[1]),
        (&json!("app-server"), &json!("-c"))
    );
    assert!(Path::new(&catalog).starts_with(stage.server.data_dir().join("codex-catalog")));
    let models: Value = serde_json::from_str(&fs::read_to_string(&catalog).unwrap()).unwrap();
    let disabled = json!({ "multi_agent_version": "disabled", "slug": "gpt-6-luna" });
    assert_eq!(models, json!({ "models": [disabled] }));

    // A sub-session: no tool of Uraeda's, and no sub-agent of Codex's either.
    let sub = stage.session_dir();
    let opened = Options {
        tools: Tools::None,
        ..options(&sub)
    };
    one_turn(&stage, opened, "Hi").await;
    assert_permissions(&sub, "thread/start");
    assert_eq!(
        params(&sub, "thread/start")["config"].get("mcp_servers"),
        None
    );
    assert_eq!(argv(&sub)[1], "-c");
    assert_ne!(
        argv(&sub)[2],
        started[2],
        "a catalog for each working directory"
    );
    // Codex's catalog is read where each session runs.
    let read = fs::read_to_string(stage.bin.join("debug")).unwrap();
    let read: Vec<&str> = read.lines().collect();
    assert_eq!(read, [workflow.to_str().unwrap(), sub.to_str().unwrap()]);
    stage.stop().await;
}

#[tokio::test]
async fn a_session_whose_catalog_cannot_be_written_says_codexs_sub_agents_may_run_in_it() {
    let stage = stage(json!({ "catalogFails": true })).await;
    let dir = stage.session_dir();
    let opened = Options {
        tools: Tools::None,
        ..options(&dir)
    };
    let read = one_turn(&stage, opened, "Hi").await;
    let notice = read.iter().find(|event| event["type"] == "notice");
    let text = notice.expect("a notice")["text"].as_str().unwrap();
    assert!(
        text.starts_with("Codex's own sub-agents may run in this session"),
        "{text}"
    );
    assert!(text.contains("signed out"), "it says why: {text}");
    let result = read.iter().find(|event| event["type"] == "result").unwrap();
    assert_eq!(result["ok"], true);
    assert_eq!(argv(&dir), json!(["app-server"]));
    let catalogs = stage.server.data_dir().join("codex-catalog");
    let left = fs::read_dir(catalogs).map_or(0, Iterator::count);
    assert_eq!(left, 0, "no file is left");
    stage.stop().await;
}

#[tokio::test]
async fn sessions_opening_together_share_one_catalog_of_their_folders() {
    let stage = stage(json!({ "catalogMs": 300 })).await;
    let dir = stage.session_dir();
    let workflow = || Options {
        tools: Tools::None,
        ..options(&dir)
    };
    let (first, second) = (stage.open(workflow()).await, stage.open(workflow()).await);
    for mut process in [first, second] {
        let mut events = process.events();
        until(&mut events, "init").await;
        process.close();
        until(&mut events, "exit").await;
    }
    let read = fs::read_to_string(stage.bin.join("debug")).unwrap();
    assert_eq!(
        read.lines().count(),
        1,
        "Codex's catalog was read once: {read}"
    );
    let started = fs::read_to_string(dir.join("argv")).unwrap();
    let started: Vec<&str> = started.lines().collect();
    assert_eq!(started.len(), 2);
    assert_eq!(started[0], started[1], "both run on it");
    stage.stop().await;
}

#[tokio::test]
async fn a_thread_starts_with_its_projects_trust_in_memory_never_written_by_codex() {
    // A linked worktree, whose main checkout the owner's settings do not trust.
    let folders = tempfile::TempDir::new().unwrap();
    let (main, worktree) = (folders.path().join("main"), folders.path().join("wt"));
    let git_dir = main.join(".git/worktrees/wt");
    fs::create_dir_all(&git_dir).unwrap();
    fs::create_dir_all(&worktree).unwrap();
    fs::write(
        worktree.join(".git"),
        format!("gitdir: {}\n", git_dir.display()),
    )
    .unwrap();
    fs::write(git_dir.join("commondir"), "../..\n").unwrap();
    let projects = json!({
        "/": { "trust_level": "trusted" },
        main.to_str().unwrap(): { "trust_level": "untrusted" },
    });
    let config = json!({ "model": "gpt-6-luna", "projects": projects });
    let stage = stage(json!({ "config": config })).await;

    one_turn(&stage, options(&worktree), "Hi").await;
    let trusted = json!({ worktree.to_str().unwrap(): { "trust_level": "untrusted" } });
    assert_eq!(
        params(&worktree, "thread/start")["config"]["projects"],
        trusted
    );

    // The worktree's own entry comes first, and a folder with no entry above it is trusted, the
    // level Codex would write.
    let plain = stage.session_dir();
    one_turn(&stage, options(&plain), "Hi").await;
    let level = &params(&plain, "thread/start")["config"]["projects"][plain.to_str().unwrap()];
    assert_eq!(
        level["trust_level"], "trusted",
        "the closest folder holding it: /"
    );
    stage.stop().await;
}

#[tokio::test]
async fn a_messages_images_are_local_images() {
    let stage = stage(json!({})).await;
    let dir = stage.session_dir();
    let mut process = stage.open(options(&dir)).await;
    let mut events = process.events();
    let image = SentImage {
        path: "/i/a.png".into(),
    };
    let mut look = message("m1", "Look");
    look.images = vec![image.clone()];
    process.send(look);
    until(&mut events, "result").await;
    let mut alone = message("m2", "");
    alone.images = vec![image];
    process.send(alone);
    until(&mut events, "result").await;
    process.close();
    until(&mut events, "exit").await;

    let turns = crate::stage::requests(&dir).into_iter();
    let inputs: Vec<Value> = turns
        .filter(|line| line["method"] == "turn/start")
        .map(|line| line["params"]["input"].clone())
        .collect();
    let local = json!({ "path": "/i/a.png", "type": "localImage" });
    let text = json!({ "text": "Look", "text_elements": [], "type": "text" });
    assert_eq!(inputs, [json!([text, local]), json!([local])]);
    stage.stop().await;
}

/// What the registry learned of the built-in, once it asked.
async fn checked(stage: &Stage) -> (Option<String>, Option<Value>) {
    let runtimes = stage.server.shared().get::<Runtimes>();
    let asked = tokio::task::spawn_blocking(move || {
        runtimes.check();
        let runtime = runtimes.get("codex").expect("the built-in runtime");
        let models = runtime.models().ok().flatten();
        (runtimes.status("codex").version, models)
    });
    let (version, models) = asked.await.unwrap();
    (
        version,
        models.map(|models| serde_json::to_value(models).unwrap()),
    )
}

#[tokio::test]
async fn the_built_in_lists_codexs_models_and_says_its_version() {
    let stage = stage(json!({})).await;
    let runtime = stage.runtime();
    assert_eq!(
        (runtime.name(), runtime.kind(), runtime.icon()),
        (
            "Codex".to_owned(),
            "codex".to_owned(),
            "uraeda:harness-openai".to_owned()
        )
    );
    let offers = serde_json::to_value(runtime.capabilities()).unwrap();
    let offered = json!({
        "approvals": false,
        "images": true,
        "queue": true,
        "steer": true,
        "subagents": false,
        "takeBack": true,
    });
    assert_eq!(offers, offered);

    // Every page, through a short process in the home folder: the hidden model is left out,
    // and the defaults are the configured model and effort.
    let (version, models) = checked(&stage).await;
    assert_eq!(version.as_deref(), Some("codex-cli 0.163.0"));
    let listed = json!({
        "defaults": { "effort": "high", "model": "gpt-6-luna" },
        "models": [
            {
                "description": "The default.",
                "efforts": [{ "id": "low", "name": "Low" }, { "id": "ultra", "name": "Ultra" }],
                "id": "gpt-6.1-sol",
                "name": "GPT-6.1-Sol",
            },
            {
                "description": "Fast.",
                "efforts": [{ "id": "xhigh", "name": "Extra high" }],
                "id": "gpt-6-luna",
                "name": "GPT-6-Luna",
            },
        ],
    });
    assert_eq!(models, Some(listed));
    let asked: Vec<Value> = written(&stage.home);
    let asked: Vec<&str> = asked
        .iter()
        .filter_map(|line| line["method"].as_str())
        .collect();
    let once = [
        "initialize",
        "initialized",
        "model/list",
        "config/read",
        "model/list",
    ];
    assert!(asked.starts_with(&once), "{asked:?}");
    stage.stop().await;

    // Nothing configured: the model marked default, and its default effort.
    let stage = crate::stage::stage(json!({ "config": { "model": null } })).await;
    let (_, models) = checked(&stage).await;
    let defaults = json!({ "effort": "medium", "model": "gpt-6.1-sol" });
    assert_eq!(models.expect("a list")["defaults"], defaults);
    stage.stop().await;

    // A command that is not there: no version, and no list.
    let config = "[extensions.codex]\ncommand = \"no-such-codex-command\"\n";
    let stage = staged(json!({}), |setup| setup.config("config.toml", config)).await;
    assert_eq!(checked(&stage).await, (None, None));
    stage.stop().await;
}

#[tokio::test]
async fn a_thread_exists_when_its_rollout_is_found_and_the_owner_turns_the_built_in_off() {
    let codex_home = tempfile::TempDir::new().unwrap();
    let sessions = codex_home.path().join("sessions");
    let day = sessions.join("2026/11/08");
    fs::create_dir_all(&day).unwrap();
    fs::write(
        day.join("rollout-2026-11-08T10-00-00-01a1bba7-37d5.jsonl"),
        "",
    )
    .unwrap();
    // Newer days are read first, and other folders not at all.
    fs::create_dir_all(sessions.join("2026/11/09")).unwrap();
    fs::create_dir_all(sessions.join("archive/11/08")).unwrap();
    fs::write(sessions.join("archive/11/08/rollout-x-other.jsonl"), "").unwrap();
    let config = "[extensions.codex]\non = [\"todo\"]\n";
    let stage = staged(json!({}), |setup| {
        let setup = setup.config("config.toml", config);
        setup.env("CODEX_HOME", codex_home.path().to_str().unwrap())
    })
    .await;
    let runtime = stage.runtime();
    assert!(runtime.has_session("01a1bba7-37d5", None));
    assert!(runtime.has_session("37d5", None));
    assert!(!runtime.has_session("01a1bba7", None));
    assert!(!runtime.has_session("other", None));

    // It is its extension's: on where the owner left it on.
    let runtimes = stage.server.shared().get::<Runtimes>();
    assert!(runtimes.names().contains(&"codex".to_owned()));
    assert!(runtimes.is_on("codex", Some("todo")));
    assert!(!runtimes.is_on("codex", Some("other")));
    assert!(!runtimes.on_in(Some("other")).contains(&"codex".to_owned()));
    stage.stop().await;
}
