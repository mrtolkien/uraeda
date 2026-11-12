//! What the runtime answers without a session: what it is, its version, its models, whether a
//! session can be resumed, the rule that allows a blocked action, and its own review.

use std::fs;
use std::path::Path;
use std::time::Duration;

use serde_json::{Value, json};
use tempfile::TempDir;
use uraeda_protocol::{ModelDefaults, ModelList};
use uraeda_server::runner::Denial;
use uraeda_server::runtimes::{ReviewAsk, RuntimeError, Runtimes};

use super::process::controlled;
use super::stage::{REPLAY, SILENT, stage, staged, stdin};
use crate::support;

#[tokio::test]
async fn claude_code_is_a_built_in_runtime_the_owner_can_turn_off() {
    let stage = stage(SILENT).await;
    let runtimes = stage.server.shared().get::<Runtimes>();
    let claude = stage.runtime();

    let registered = runtimes.names().contains(&"claude".to_owned());
    assert!(registered, "registered as its extension");
    assert_eq!(
        (claude.name(), claude.kind(), claude.icon()),
        (
            "Claude Code".to_owned(),
            "claude".to_owned(),
            "uraeda:harness-claude".to_owned()
        )
    );
    assert_eq!(
        serde_json::to_value(claude.capabilities()).unwrap(),
        json!({
            "approvals": false, "images": true, "queue": true, "steer": true,
            "subagents": true, "takeBack": true,
        })
    );
    assert!(runtimes.is_on("claude", Some("any-repository")));
    stage.server.stop().await;

    let off = "[extensions.claude]\non = []\n";
    let stage = staged(SILENT, |setup| setup.config("config.toml", off)).await;
    let runtimes = stage.server.shared().get::<Runtimes>();
    assert!(!runtimes.is_on("claude", Some("any-repository")));
    assert_eq!(runtimes.on_in(Some("any-repository")), ["codex"]);
    stage.server.stop().await;
}

#[tokio::test]
async fn the_servers_other_tests_find_no_claude() {
    // Every other test's server has the machine's `PATH`: a stand-in that is not installed
    // comes first on it, so no test runs the real `claude`.
    let server = support::server().await;
    let runtimes = server.shared().get::<Runtimes>();
    let claude = runtimes.get("claude").expect("the built-in runtime");
    let asked = tokio::task::spawn_blocking(move || (claude.version(), claude.models()));
    let (version, models) = asked.await.unwrap();
    assert_eq!(version, None);
    assert_eq!(
        models,
        Err(RuntimeError::Failed(
            "Claude Code exited before listing its models".to_owned()
        ))
    );
    server.stop().await;
}

#[tokio::test]
async fn the_version_is_the_commands_first_line() {
    let stage = stage(SILENT).await;
    assert_eq!(
        stage.ask(|claude| claude.version()).await.as_deref(),
        Some("2.1.322 (Claude Code)")
    );
    stage.server.stop().await;
}

#[tokio::test]
async fn a_session_can_be_resumed_when_claude_code_kept_its_transcript() {
    let transcript = |claude_dir: &Path| {
        let project = claude_dir.join("projects/-w");
        fs::create_dir_all(&project).unwrap();
        fs::write(project.join("3f2c.jsonl"), "").unwrap();
    };
    // Claude Code's own folder is `.claude` in the home folder: without it, no session is.
    let stage = stage(SILENT).await;
    assert!(!stage.runtime().has_session("3f2c", None));
    transcript(&stage.claude_dir);
    assert!(stage.runtime().has_session("3f2c", None));
    assert!(!stage.runtime().has_session("9a9a", None));
    stage.server.stop().await;

    // Unless the server's environment names another.
    let named = TempDir::new().unwrap();
    let path = named.path().to_str().unwrap().to_owned();
    let stage = staged(SILENT, |setup| setup.env("CLAUDE_CONFIG_DIR", &path)).await;
    transcript(&stage.claude_dir);
    assert!(!stage.runtime().has_session("3f2c", None));
    transcript(named.path());
    assert!(stage.runtime().has_session("3f2c", None));
    stage.server.stop().await;
}

#[tokio::test]
async fn the_rule_of_a_blocked_action_allows_that_action_alone() {
    let stage = stage(SILENT).await;
    let claude = stage.runtime();
    let rule = |tool: &str, input: Value| {
        let denial: Denial =
            serde_json::from_value(json!({ "tool": tool, "input": input })).unwrap();
        claude.allow_rule(&denial)
    };
    let cases = [
        (
            "Bash",
            json!({ "command": "gh pr create --draft" }),
            "Bash(gh pr create --draft)",
        ),
        // An absolute path takes two slashes: one is relative to the settings' folder. Claude
        // Code checks a write against `Edit` rules only.
        (
            "Write",
            json!({ "file_path": "/home/me/.ssh/config" }),
            "Edit(//home/me/.ssh/config)",
        ),
        (
            "MultiEdit",
            json!({ "file_path": "/w/a.ts" }),
            "Edit(//w/a.ts)",
        ),
        ("Edit", json!({ "file_path": "/w/a.ts" }), "Edit(//w/a.ts)"),
        ("Read", json!({ "file_path": "/w/b.ts" }), "Read(//w/b.ts)"),
        ("Edit", json!({ "file_path": "src/a.ts" }), "Edit(src/a.ts)"),
        ("Edit", json!({ "file_path": "//w/a.ts" }), "Edit(//w/a.ts)"),
        (
            "WebFetch",
            json!({ "url": "https://Example.com:8443/a?b" }),
            "WebFetch(domain:example.com)",
        ),
        // A tool with no target, or one no rule narrows, gets its bare name.
        ("mcp__x__y", json!({}), "mcp__x__y"),
        ("WebFetch", json!({ "url": "not a url" }), "WebFetch"),
        ("Bash", json!({ "command": "" }), "Bash"),
        ("Glob", json!({ "file_path": "/w/a.ts" }), "Glob"),
        // A path rule is a gitignore pattern: its special characters are escaped, as Claude
        // Code escapes the paths it saves, so the rule matches only the path.
        (
            "Edit",
            json!({ "file_path": "/w/*.ts" }),
            r"Edit(//w/\*.ts)",
        ),
        (
            "Write",
            json!({ "file_path": "/w/**/a?[0].md" }),
            r"Edit(//w/\*\*/a\?\[0\].md)",
        ),
        ("Read", json!({ "file_path": r"a\b" }), r"Read(a\\b)"),
        ("Edit", json!({ "file_path": "!a.ts" }), r"Edit(\!a.ts)"),
        ("Edit", json!({ "file_path": "#a.ts" }), r"Edit(\#a.ts)"),
        ("Edit", json!({ "file_path": "a#!.ts" }), "Edit(a#!.ts)"),
    ];
    for (tool, input, expected) in cases {
        assert_eq!(
            rule(tool, input.clone()).as_deref(),
            Some(expected),
            "{tool} {input}"
        );
    }
    // A command with a `*` has no rule: Claude Code would read it as a wildcard. Nor has a
    // rule with a line break: a stored rule is one line.
    for command in [
        "rm -rf build/*",
        "git log --format=*",
        "ls:*",
        "echo a\necho b",
    ] {
        assert_eq!(
            rule("Bash", json!({ "command": command })),
            None,
            "{command}"
        );
    }
    for tool in ["Edit", "Write"] {
        assert_eq!(rule(tool, json!({ "file_path": "src/a\nb.ts" })), None);
    }
    stage.server.stop().await;
}

#[tokio::test]
async fn a_review_is_claude_codes_own_at_the_reviewers_effort() {
    let stage = stage(SILENT).await;
    let claude = stage.runtime();
    let review = |effort: Option<&str>, instructions: Option<&str>| {
        let ask = ReviewAsk {
            base: "abc123".to_owned(),
            head: "def456".to_owned(),
            effort: effort.map(str::to_owned),
            instructions: instructions.map(str::to_owned),
        };
        let message = claude.review_message(&ask).expect("its own review");
        assert!(
            !message.review,
            "a plain message, which Claude Code reads as a command"
        );
        message.text
    };
    assert_eq!(
        review(Some("xhigh"), None),
        "/code-review xhigh abc123..def456"
    );
    // An effort the review does not name, or none, is `medium`, never left out: that would
    // reuse the level the human typed last.
    assert_eq!(
        review(Some("ultra"), None),
        "/code-review medium abc123..def456"
    );
    assert_eq!(review(None, Some("")), "/code-review medium abc123..def456");
    assert_eq!(
        review(Some("low"), Some("Look at the migrations.")),
        "/code-review low abc123..def456\n\nLook at the migrations."
    );
    stage.server.stop().await;
}

/// The arguments of the short process that lists the models.
const MODELS_ARGS: [&str; 9] = [
    "-p",
    "--input-format",
    "stream-json",
    "--output-format",
    "stream-json",
    "--verbose",
    "--permission-mode",
    "auto",
    "--no-session-persistence",
];

/// The effort levels of a row that takes them all.
fn efforts(ids: &[&str]) -> Value {
    let name = |id: &str| match id {
        "xhigh" => "Extra high".to_owned(),
        id => format!("{}{}", id[..1].to_uppercase(), &id[1..]),
    };
    ids.iter()
        .map(|id| json!({ "id": id, "name": name(id) }))
        .collect()
}

#[tokio::test]
async fn the_models_are_listed_by_a_short_process_which_is_closed() {
    let stage = controlled().await;
    let runtimes = stage.server.shared().get::<Runtimes>();
    let all = ["low", "medium", "high", "xhigh", "max"];
    // Each row that keeps `auto` mode, without the `default` one, which stands for another.
    let expected = json!({
        "defaults": { "effort": "medium", "model": "opus" },
        "models": [
            {
                "id": "opus", "name": "Opus 5.5", "efforts": efforts(&all),
                "description": "For complex work and everyday tasks",
            },
            {
                "id": "sonnet", "name": "Sonnet 5.5", "efforts": efforts(&all),
                "description": "Most efficient for simpler tasks",
            },
            {
                "id": "claude-opus-4-6", "name": "Opus 4.6",
                "efforts": efforts(&["low", "medium", "high", "max"]),
                "description": "Best for everyday, complex tasks",
            },
        ],
    });

    // The server asked as it registered the runtime: its list is the registry's.
    while runtimes.models("claude").is_none() {
        tokio::time::sleep(Duration::from_millis(10)).await;
    }
    let kept = runtimes.models("claude").unwrap();
    assert_eq!(serde_json::to_value(kept).unwrap(), expected);

    let listed = stage.ask(|claude| claude.models()).await;
    let listed = listed
        .expect("a list")
        .expect("Claude Code lists its models");
    assert_eq!(serde_json::to_value(listed).unwrap(), expected);
    // In the home folder, with no message sent, so no usage is spent, and no transcript kept.
    assert_eq!(super::stage::args(&stage.home), MODELS_ARGS);
    let asked: Vec<Value> = stdin(&stage.home)
        .into_iter()
        .map(|line| line["request"].clone())
        .collect();
    assert_eq!(
        asked,
        [
            json!({ "subtype": "list_models" }),
            json!({ "subtype": "get_settings" })
        ]
    );
    stage.server.stop().await;
}

#[tokio::test]
async fn the_default_model_is_a_listed_rows_id() {
    let stage = controlled().await;
    let cases = [
        // Configured as its own id, as the id it resolves to, as no listed row, and as a row
        // that drops `auto` mode; then not configured, and running on a listed row.
        (
            json!({ "effective": { "model": "sonnet" } }),
            json!({ "model": "sonnet" }),
        ),
        (
            json!({ "effective": { "model": "claude-sonnet-5-5" } }),
            json!({ "model": "sonnet" }),
        ),
        (
            json!({ "effective": { "model": "claude-mythos-1" } }),
            json!({}),
        ),
        (
            json!({ "effective": { "model": "claude-haiku-4-5-20251001" } }),
            json!({}),
        ),
        (
            json!({ "applied": { "model": "claude-sonnet-5-5", "effort": "max" }, "effective": {} }),
            json!({ "model": "sonnet", "effort": "max" }),
        ),
        (json!({ "applied": {}, "effective": {} }), json!({})),
        (json!(null), json!({})),
    ];
    for (settings, defaults) in cases {
        fs::write(stage.bin.join("settings.json"), settings.to_string()).unwrap();
        let listed = stage.ask(|claude| claude.models()).await.unwrap().unwrap();
        let defaults: ModelDefaults = serde_json::from_value(defaults).unwrap();
        assert_eq!(listed.defaults, defaults, "configured as {settings}");
        assert_eq!(listed.models.len(), 3);
    }
    // An answer that is no list gives none.
    fs::write(stage.bin.join("list.json"), r#"{"models":"none"}"#).unwrap();
    let listed = stage.ask(|claude| claude.models()).await;
    assert_eq!(listed, Ok(Some(ModelList::default())));
    stage.server.stop().await;
}

#[tokio::test]
async fn a_list_claude_code_does_not_give_is_a_failure_saying_why() {
    let failed = |why: &str| Err(RuntimeError::Failed(why.to_owned()));

    // It refuses.
    let refusing = controlled().await;
    fs::write(refusing.bin.join("refuse"), "").unwrap();
    assert_eq!(
        refusing.ask(|claude| claude.models()).await,
        failed("Not now")
    );
    refusing.server.stop().await;

    // It exits before it answers, with what it said.
    let exiting = stage("echo 'Not logged in' >&2\nexit 1\n").await;
    assert_eq!(
        exiting.ask(|claude| claude.models()).await,
        failed("Claude Code exited before listing its models: Not logged in")
    );
    exiting.server.stop().await;

    // It is not installed.
    let command = "[extensions.claude]\ncommand = \"/nonexistent/claude\"\n";
    let missing = staged(SILENT, |setup| setup.config("config.toml", command)).await;
    assert_eq!(
        missing.ask(|claude| claude.models()).await,
        failed("Claude Code is not available: No such file or directory (os error 2)")
    );
    missing.server.stop().await;
}

#[tokio::test]
async fn a_list_that_does_not_come_is_given_up_after_ten_seconds() {
    // It reads its requests, and answers none.
    let stage = stage(REPLAY).await;
    tokio::time::pause();
    let claude = stage.runtime();
    let asking = tokio::task::spawn_blocking(move || claude.models());
    while !asking.is_finished() {
        tokio::time::advance(Duration::from_secs(1)).await;
        std::thread::sleep(Duration::from_millis(5));
    }
    assert_eq!(
        asking.await.unwrap(),
        Err(RuntimeError::Failed(
            "Claude Code did not list its models within 10 seconds".to_owned()
        ))
    );
    tokio::time::resume();
    stage.server.stop().await;
}
