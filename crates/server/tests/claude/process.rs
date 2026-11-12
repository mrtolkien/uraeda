//! A session's process: what `claude` is started with, what is written to it, and what its
//! process says of itself.

use std::fs;
use std::path::Path;

use serde_json::{Value, json};
use uraeda_server::runtimes::{Options, Outgoing, SentImage, Tools, When};

use super::stage::{
    CONTROLS, SILENT, Stage, args, each_of, message, next, options, rest, stage, staged, stdin,
    values_of, written,
};

/// Claude Code 2.1.319's answer to `list_models`, some of its rows.
pub const LIST_MODELS: &str = r#"{"models":[
  {"value":"default","displayName":"Default (recommended)","description":"Opus 5.5 · Best for everyday, complex tasks","resolvedModel":"claude-opus-5-5","supportedEffortLevels":["low","medium","high","xhigh","max"],"supportsAutoMode":true,"supportsEffort":true},
  {"value":"opus","displayName":"Opus 5.5","description":"For complex work and everyday tasks","resolvedModel":"claude-opus-5-5","supportedEffortLevels":["low","medium","high","xhigh","max"],"supportsAutoMode":true,"supportsEffort":true},
  {"value":"sonnet","displayName":"Sonnet 5.5","description":"Most efficient for simpler tasks","resolvedModel":"claude-sonnet-5-5","supportedEffortLevels":["low","medium","high","xhigh","max"],"supportsAutoMode":true,"supportsEffort":true},
  {"value":"claude-haiku-4-5-20251001","displayName":"Haiku 4.5","description":"Fastest for quick answers","resolvedModel":"claude-haiku-4-5-20251001","supportsThinkingOff":true},
  {"value":"claude-opus-4-6","displayName":"Opus 4.6","description":"Best for everyday, complex tasks","resolvedModel":"claude-opus-4-6","supportedEffortLevels":["low","medium","high","max"],"supportsAutoMode":true,"supportsEffort":true}
]}"#;

/// A server whose stand-in answers its control requests, from `LIST_MODELS`.
pub async fn controlled() -> Stage {
    let stage = stage(CONTROLS).await;
    // On one line: the stand-in prints it inside its answer's line.
    fs::write(stage.bin.join("list.json"), LIST_MODELS.replace('\n', "")).unwrap();
    stage
}

/// The arguments every session's process starts with, before what was picked for it.
const PRINT_MODE: [&str; 9] = [
    "-p",
    "--input-format",
    "stream-json",
    "--output-format",
    "stream-json",
    "--verbose",
    "--include-partial-messages",
    "--permission-mode",
    "auto",
];

/// Opens a process, closes it at once, and gives the arguments its `claude` was started with.
async fn started_with(stage: &Stage, options: Options) -> Vec<String> {
    let dir = options.cwd.clone();
    let mut process = stage.open(options).await;
    process.close();
    rest(&mut process.events()).await;
    args(&dir)
}

#[tokio::test]
async fn a_session_starts_claude_in_print_mode_with_the_skill_and_its_folders() {
    let stage = stage(SILENT).await;
    let (data, config) = (stage.server.data_dir(), stage.server.config_dir());
    let (plugin, images) = (data.join("plugin"), data.join("images"));
    let extensions = config.join("extensions");
    let path = |path: &Path| path.to_str().unwrap().to_owned();

    let dir = stage.session_dir();
    let new = started_with(&stage, options(&dir)).await;
    let instructions = new[new.len() - 3].clone();
    let mut expected: Vec<String> = PRINT_MODE.map(str::to_owned).to_vec();
    expected.extend(["--plugin-dir".to_owned(), path(&plugin)]);
    expected.extend(["--add-dir".to_owned(), path(&images)]);
    expected.extend(["--add-dir".to_owned(), path(&extensions)]);
    expected.extend(["--append-system-prompt".to_owned(), instructions.clone()]);
    expected.extend(["--session-id".to_owned(), "id".to_owned()]);
    assert_eq!(new, expected, "a new chat's arguments");

    // The folders exist before `claude` starts: `--add-dir` refuses a missing one.
    assert!(images.is_dir() && extensions.is_dir());
    // The skill is given as the plugin `uraeda`, written from the one the server holds.
    let manifest = fs::read_to_string(plugin.join(".claude-plugin/plugin.json")).unwrap();
    let manifest: Value = serde_json::from_str(&manifest).unwrap();
    assert_eq!(manifest, json!({ "name": "uraeda" }));
    let skill = fs::read_to_string(plugin.join("skills/uraeda/SKILL.md")).unwrap();
    assert!(
        skill.starts_with("---\nname: uraeda\n"),
        "the skill: {skill:.40}"
    );
    assert!(plugin.join("skills/uraeda/references/plan.md").is_file());

    // The instructions say what the app does with a message, and where extensions are written.
    for kind in ["change", "feature"] {
        assert!(instructions.contains(&format!("`uraeda-offer {kind}`")));
    }
    assert!(instructions.contains("```uraeda-offer change\n# "));
    assert!(instructions.contains("# Extensions"));
    assert!(instructions.contains(&format!("`{}`", extensions.display())));
    assert!(instructions.contains("`ura extension add <folder> --here`"));
    let docs = data.join("docs/extensions.md");
    assert!(instructions.contains(&format!("`{}`", docs.display())));
    assert!(
        fs::read_to_string(docs)
            .unwrap()
            .starts_with("# Extensions")
    );

    // What was picked for the session, and a resumed one, which gets the instructions again.
    let picked = Options {
        model: Some("sonnet".to_owned()),
        effort: Some("high".to_owned()),
        resume: true,
        allowed: vec!["Bash(rm -rf dist)".to_owned(), "Edit(src/a.ts)".to_owned()],
        ..options(&stage.session_dir())
    };
    let picked = started_with(&stage, picked).await;
    assert_eq!(picked[9..13], ["--model", "sonnet", "--effort", "high"]);
    assert_eq!(each_of(&picked, "--append-system-prompt"), [instructions]);
    assert_eq!(
        picked[picked.len() - 5..],
        [
            "--resume",
            "id",
            "--allowedTools",
            "Bash(rm -rf dist)",
            "Edit(src/a.ts)"
        ],
        "each rule is an argument of its own, last"
    );
    // A chat keeps the agent's own sub-agents, gets no tool of Uraeda's, and never runs without
    // its permissions.
    for args in [&new, &picked] {
        let refused = [
            "bypassPermissions",
            "--dangerously-skip-permissions",
            "--disallowedTools",
            "--mcp-config",
            "--strict-mcp-config",
        ];
        assert!(!args.iter().any(|arg| refused.contains(&arg.as_str())));
        assert_eq!(each_of(args, "--permission-mode"), ["auto"]);
    }
    stage.server.stop().await;
}

#[tokio::test]
async fn a_workflow_session_gets_uraedas_tools_and_none_of_its_own_sub_agents() {
    let stage = stage(SILENT).await;
    let sub_agents = ["Agent", "Task", "Workflow", "TeamCreate"];
    let dir = stage.session_dir();
    let workflow = Options {
        resume: true,
        allowed: vec!["Edit(src/a.ts)".to_owned()],
        tools: Tools::Uraeda {
            url: "http://127.0.0.1:4000/mcp".to_owned(),
            token: "secret-token".to_owned(),
        },
        ..options(&dir)
    };
    let workflow = started_with(&stage, workflow).await;

    assert_eq!(values_of(&workflow, "--disallowedTools"), sub_agents);
    let configs = values_of(&workflow, "--mcp-config");
    assert_eq!(configs.len(), 1);
    let config: Value = serde_json::from_str(&configs[0]).unwrap();
    assert_eq!(
        config,
        json!({ "mcpServers": { "uraeda": {
            "type": "http",
            "url": "http://127.0.0.1:4000/mcp",
            "headers": { "Authorization": "Bearer ${URAEDA_MCP_TOKEN}" },
            "timeout": 2 * 60 * 60 * 1000,
        } } })
    );
    // The token is in the process's environment only: any user of the machine reads arguments.
    assert!(!workflow.join(" ").contains("secret-token"));
    assert_eq!(
        fs::read_to_string(dir.join("token")).unwrap(),
        "secret-token"
    );
    assert_eq!(
        values_of(&workflow, "--allowedTools"),
        [
            "Edit(src/a.ts)",
            "mcp__uraeda__run_agent",
            "mcp__uraeda__review"
        ],
        "the session's rules, then each of Uraeda's tools"
    );
    // The user's own servers stay, and the prompt still follows the options that take several.
    assert!(!workflow.contains(&"--strict-mcp-config".to_owned()));
    assert_eq!(each_of(&workflow, "--append-system-prompt").len(), 1);

    // A sub-session gets neither.
    let dir = stage.session_dir();
    let sub = Options {
        tools: Tools::None,
        ..options(&dir)
    };
    let sub = started_with(&stage, sub).await;
    assert_eq!(values_of(&sub, "--disallowedTools"), sub_agents);
    assert!(
        !sub.join(" ").contains("mcp"),
        "no server, and no tool of it"
    );
    assert_eq!(fs::read_to_string(dir.join("token")).unwrap(), "");
    stage.server.stop().await;
}

#[tokio::test]
async fn an_extensions_skills_reach_claude_as_a_plugin_folder_of_its_own() {
    let stage = stage(SILENT).await;
    let extensions = stage.server.config_dir().join("extensions");
    let plugins = stage.server.data_dir().join("extension-plugins");
    let skills = |name: &str| {
        let skills = extensions.join(name).join("skills");
        fs::create_dir_all(skills.join("a-skill")).unwrap();
        skills
    };
    let (kept, gone) = (skills("kept"), skills("gone"));
    // A real folder left where the link goes is replaced by the link.
    fs::create_dir_all(plugins.join("ext-kept/skills/stale")).unwrap();

    let with = |skills: Vec<_>| Options {
        skills,
        ..options(&stage.session_dir())
    };
    let both = started_with(&stage, with(vec![kept.clone(), gone.clone()])).await;

    // Uraeda's own plugin first, then each extension's, named apart from it.
    let folders = each_of(&both, "--plugin-dir");
    let ext = |name: &str| plugins.join(format!("ext-{name}"));
    let path = |path: &Path| path.to_str().unwrap().to_owned();
    assert_eq!(folders[1..], [path(&ext("kept")), path(&ext("gone"))]);
    assert!(folders[0].ends_with("/plugin"));
    for (name, skills) in [("kept", &kept), ("gone", &gone)] {
        let manifest = fs::read_to_string(ext(name).join(".claude-plugin/plugin.json")).unwrap();
        let manifest: Value = serde_json::from_str(&manifest).unwrap();
        assert_eq!(manifest, json!({ "name": format!("ext-{name}") }));
        assert_eq!(&fs::read_link(ext(name).join("skills")).unwrap(), skills);
    }

    // An extension that was removed loses its plugin folder as the next process opens, and one
    // that is only off for this session keeps it: another session may run with it.
    fs::remove_dir_all(extensions.join("gone")).unwrap();
    let none = started_with(&stage, with(Vec::new())).await;
    assert_eq!(each_of(&none, "--plugin-dir").len(), 1);
    assert!(ext("kept").join("skills/a-skill").is_dir());
    assert!(!ext("gone").exists());
    stage.server.stop().await;
}

#[tokio::test]
async fn a_message_is_written_as_claude_code_reads_it() {
    let stage = stage(SILENT).await;
    let (dir, mut process) = stage.session().await;
    let image = |name: &str| SentImage {
        path: stage.server.data_dir().join("images").join(name),
    };
    let (a, b) = (image("a.webp"), image("b.webp"));
    let (a_path, b_path) = (a.path.display(), b.path.display());

    process.send(Outgoing {
        when: When::Steer,
        ..message("m1", "hi")
    });
    process.send(message("m2", "then this"));
    process.take_back("m2");
    process.send(Outgoing {
        images: vec![a.clone(), b.clone()],
        ..message("m3", "What is wrong here?")
    });
    process.send(Outgoing {
        images: vec![a.clone()],
        when: When::Steer,
        ..message("m4", "")
    });
    process.interrupt();
    process.interrupt();
    process.close();
    let events = rest(&mut process.events()).await;

    assert_eq!(events, [json!({ "type": "exit", "code": 0, "stderr": "" })]);
    let user = |id: &str, content: &str, priority: &str| {
        json!({
            "type": "user", "uuid": id, "priority": priority,
            "message": { "role": "user", "content": content },
        })
    };
    let written = written(&dir);
    assert_eq!(
        [&written[0], &written[1], &written[3], &written[4]],
        [
            // A steered message is read next, a queued one after the turn.
            &user("m1", "hi", "next"),
            &user("m2", "then this", "later"),
            // The text, a blank line, then a line per image, which the agent opens itself.
            &user(
                "m3",
                &format!("What is wrong here?\n\n[Image: {a_path}]\n[Image: {b_path}]"),
                "later"
            ),
            &user("m4", &format!("[Image: {a_path}]"), "next"),
        ]
    );
    let request = |line: &Value| (line["type"].clone(), line["request"].clone());
    assert_eq!(
        request(&written[2]),
        (
            json!("control_request"),
            json!({ "subtype": "cancel_async_message", "message_uuid": "m2" })
        ),
        "taking back is Claude Code's own request"
    );
    let interrupt = (json!("control_request"), json!({ "subtype": "interrupt" }));
    assert_eq!(request(&written[5]), interrupt);
    assert_eq!(request(&written[6]), interrupt);
    let ids: Vec<&str> = [2, 5, 6]
        .map(|at| written[at]["request_id"].as_str().expect("an id"))
        .to_vec();
    assert!(
        ids[0] != ids[1] && ids[1] != ids[2],
        "each request has its id"
    );
    assert_eq!(written.len(), 7);
    stage.server.stop().await;
}

/// A stand-in that prints a tool call, its result, and a line that is no JSON, fails with 25
/// lines on its stderr, and reads nothing.
const FAILING: &str = r#"
cat stream.jsonl
echo not json
for i in $(seq 1 25); do echo "line $i" >&2; done
exit 3
"#;

#[tokio::test]
async fn an_open_process_streams_its_events_and_exits_with_the_end_of_its_stderr() {
    let stage = stage(FAILING).await;
    let dir = stage.session_dir();
    let fixtures = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../fixtures");
    fs::copy(fixtures.join("claude/tool.jsonl"), dir.join("stream.jsonl")).unwrap();

    let mut process = stage.open(options(&dir)).await;
    let events = rest(&mut process.events()).await;

    let kinds: Vec<&str> = events
        .iter()
        .map(|event| event["type"].as_str().unwrap())
        .collect();
    assert_eq!(kinds, ["toolStart", "toolEnd", "skipped", "exit"]);
    let last: Vec<String> = (6..=25).map(|line| format!("line {line}")).collect();
    assert_eq!(
        events[3],
        json!({ "type": "exit", "code": 3, "stderr": last.join("\n") }),
        "its code, and the last 20 lines of its stderr"
    );
    // A process that is gone takes nothing more.
    process.send(message("m1", "hi"));
    process.interrupt();
    process.take_back("m1");
    assert!(!process.set_effort(Some("high")));
    process.close();
    stage.server.stop().await;
}

#[tokio::test]
async fn a_command_that_is_missing_exits_as_missing_and_a_folder_that_is_gone_says_so() {
    let command = "[extensions.claude]\ncommand = \"/nonexistent/claude\"\n";
    let missing = staged(SILENT, |setup| setup.config("config.toml", command)).await;
    let (_, mut process) = missing.session().await;
    assert_eq!(
        rest(&mut process.events()).await,
        [json!({
            "type": "exit", "code": null, "missing": true,
            "stderr": "No such file or directory (os error 2)",
        })],
        "the command the owner set is the one that runs"
    );
    process.send(message("m1", "hi"));
    process.close();
    assert_eq!(missing.ask(|claude| claude.version()).await, None);
    missing.server.stop().await;

    let stage = stage(SILENT).await;
    let gone = stage.session_dir().join("removed-worktree");
    let mut process = stage.open(options(&gone)).await;
    let why = format!("The session's directory is gone: {}", gone.display());
    assert_eq!(
        rest(&mut process.events()).await,
        [json!({ "type": "exit", "code": null, "stderr": why })]
    );
    stage.server.stop().await;
}

/// The requests a session wrote, but the list of models every process asks for first.
fn requests(dir: &Path) -> Vec<Value> {
    let asked = stdin(dir).into_iter();
    asked
        .map(|line| line["request"].clone())
        .filter(|request| request["subtype"] != "list_models")
        .collect()
}

#[tokio::test]
async fn an_open_process_says_what_it_runs_on_and_again_after_each_change_of_effort() {
    let stage = controlled().await;
    let (dir, mut process) = stage.session().await;
    let mut events = process.events();
    let runs_on = |effort: &str| json!({ "type": "runsOn", "model": "Opus 5.5", "effort": effort });

    assert_eq!(next(&mut events).await, runs_on("Medium"));
    assert!(
        process.set_effort(Some("xhigh")),
        "it changes its effort itself"
    );
    assert_eq!(next(&mut events).await, runs_on("Extra high"));
    assert!(process.set_effort(None));
    assert_eq!(
        next(&mut events).await,
        runs_on("Medium"),
        "the agent's default"
    );
    process.interrupt();
    process.close();
    assert_eq!(
        rest(&mut events).await,
        [json!({ "type": "exit", "code": 0, "stderr": "" })]
    );

    assert_eq!(
        requests(&dir),
        [
            json!({ "subtype": "get_settings" }),
            json!({ "subtype": "apply_flag_settings", "settings": { "effortLevel": "xhigh" } }),
            json!({ "subtype": "get_settings" }),
            json!({ "subtype": "apply_flag_settings", "settings": { "effortLevel": null } }),
            json!({ "subtype": "get_settings" }),
            json!({ "subtype": "interrupt" }),
        ]
    );
    stage.server.stop().await;
}

#[tokio::test]
async fn what_a_process_runs_on_is_named_from_its_own_list() {
    let stage = controlled().await;
    let cases = [
        // The row of the model it resolves to, and the row of its own id.
        (
            json!({ "effort": "xhigh", "model": "claude-opus-5-5" }),
            Some(json!({ "type": "runsOn", "model": "Opus 5.5", "effort": "Extra high" })),
        ),
        (
            json!({ "effort": "low", "model": "sonnet" }),
            Some(json!({ "type": "runsOn", "model": "Sonnet 5.5", "effort": "Low" })),
        ),
        // A model that is not listed, by its id, and an effort with no name, by its own.
        (
            json!({ "effort": "turbo", "model": "claude-opus-5-5[1m]" }),
            Some(json!({ "type": "runsOn", "model": "claude-opus-5-5[1m]", "effort": "turbo" })),
        ),
        (
            json!({ "model": "claude-haiku-4-5-20251001" }),
            Some(json!({ "type": "runsOn", "model": "Haiku 4.5" })),
        ),
        // An answer that names no model says nothing.
        (json!({ "effort": "low" }), None),
    ];
    for (applied, expected) in cases {
        let settings = json!({ "applied": applied, "effective": {} });
        fs::write(stage.bin.join("settings.json"), settings.to_string()).unwrap();
        let (dir, mut process) = stage.session().await;
        let mut events = process.events();
        if let Some(expected) = &expected {
            assert_eq!(&next(&mut events).await, expected);
        } else {
            // Both answers were read before the process is closed.
            while stdin(&dir).len() < 2 {
                tokio::time::sleep(std::time::Duration::from_millis(10)).await;
            }
        }
        process.close();
        assert_eq!(rest(&mut events).await.len(), 1, "then its exit: {applied}");
    }

    // A process whose requests are refused says nothing of its model, and goes on.
    fs::write(stage.bin.join("refuse"), "").unwrap();
    let (_, mut process) = stage.session().await;
    process.set_effort(Some("high"));
    process.close();
    assert_eq!(
        rest(&mut process.events()).await,
        [json!({ "type": "exit", "code": 0, "stderr": "" })]
    );
    stage.server.stop().await;
}
