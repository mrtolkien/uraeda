//! The parameters of a Codex thread and its turns: its permissions, its configuration, a
//! message's input, and its own review, apart from the process that sends them.

use serde_json::{Value, json};

use super::json::Object;
use crate::runtimes::{
    Options, Outgoing, ReviewAsk, ReviewMessage, TOKEN_VARIABLE, TOOL_TIMEOUT, TOOLS_SERVER, Tools,
};

/// The arguments of a session's `codex app-server`: for a workflow session or a sub-session
/// with `catalog`, Codex's model catalog with every model's sub-agents off, that catalog. The
/// one switch Codex 0.163.0 honours: `features.multi_agent` and `multi_agent_v2` off, for the
/// thread or the process, leave `spawn_agent` to a model its catalog puts on multi-agent v2. A
/// chat keeps Codex's own catalog, and its sub-agents.
pub(super) fn server_args(tools: &Tools, catalog: Option<&str>) -> Vec<String> {
    let mut args = vec!["app-server".to_owned()];
    if let (false, Some(catalog)) = (tools.are_own(), catalog) {
        let path = Value::String(catalog.to_owned());
        args.extend(["-c".to_owned(), format!("model_catalog_json={path}")]);
    }
    args
}

/// The configuration that gives a workflow thread Uraeda's tools: its MCP server, its token
/// read from the process's environment, its tools approved, so Codex never asks for them, run
/// in parallel, and given up only after the tools' own timeout.
fn tools_config(tools: &Tools, config: &mut Object) {
    let Tools::Uraeda { url, .. } = tools else {
        return;
    };
    let server = json!({
        "bearer_token_env_var": TOKEN_VARIABLE,
        "default_tools_approval_mode": "approve",
        "supports_parallel_tool_calls": true,
        "tool_timeout_sec": TOOL_TIMEOUT.as_secs(),
        "url": url,
    });
    config.insert("mcp_servers".to_owned(), json!({ TOOLS_SERVER: server }));
}

/// The parameters of a session's `thread/start`, or `thread/resume` when resuming: the model
/// when picked, the session's directory, and Codex's permissions, its `workspace-write`
/// sandbox, its approvals on request, reviewed by its automatic reviewer. The configuration
/// overrides only the trust of the session's directory, when known, the level Codex would
/// apply itself: without it, Codex writes it to the user's settings; for a workflow session,
/// Uraeda's tools; and for a new thread on an effort, that effort, which a review's turn runs
/// on. Never another, which could widen the permissions.
pub(super) fn thread_params(options: &Options, instructions: &str, trust: Option<&str>) -> Value {
    let cwd = options.cwd.to_string_lossy();
    let mut config = Object::new();
    tools_config(&options.tools, &mut config);
    // A new thread holds its effort from the start: a review's turn takes no effort of its own.
    if let (Some(effort), false) = (&options.effort, options.resume) {
        config.insert("model_reasoning_effort".to_owned(), json!(effort));
    }
    if let Some(trust) = trust {
        let project = json!({ "trust_level": trust });
        config.insert("projects".to_owned(), json!({ cwd.as_ref(): project }));
    }
    let mut params = json!({
        "approvalPolicy": "on-request",
        "approvalsReviewer": "auto_review",
        "cwd": cwd,
        "developerInstructions": instructions,
        "sandbox": "workspace-write",
    });
    let fields = params.as_object_mut().expect("an object written here");
    if !config.is_empty() {
        fields.insert("config".to_owned(), Value::Object(config));
    }
    if let Some(model) = &options.model {
        fields.insert("model".to_owned(), json!(model));
    }
    // A resumed thread's turns stay unread: the transcript has them.
    if options.resume {
        fields.insert("excludeTurns".to_owned(), json!(true));
        fields.insert("threadId".to_owned(), json!(options.native_id));
    }
    params
}

/// A message's input items: its text, then its images by their paths.
pub(super) fn input(message: &Outgoing) -> Value {
    let text = (!message.text.is_empty())
        .then(|| json!({ "text": message.text, "text_elements": [], "type": "text" }));
    let images = message.images.iter();
    let images = images.map(|image| json!({ "path": image.path, "type": "localImage" }));
    text.into_iter().chain(images).collect()
}

/// The parameters of a `turn/start`: the message, the effort when set, and the sandbox's
/// policy, which writes only the session's directory, the network off: no other writable root.
pub(super) fn turn_params(message: &Outgoing, thread: &str, effort: Option<&str>) -> Value {
    let mut params = json!({
        "input": input(message),
        "sandboxPolicy": {
            "excludeSlashTmp": false,
            "excludeTmpdirEnvVar": false,
            "networkAccess": false,
            "type": "workspaceWrite",
            "writableRoots": [],
        },
        "threadId": thread,
    });
    if let Some(effort) = effort {
        params["effort"] = json!(effort);
    }
    params
}

/// Codex's own review of the commits `<base>..<head>`: a review turn, `review/start`, on a
/// custom target, as its base-branch target compares with a branch's upstream, and takes no
/// instructions. The text is the review's prompt, with the instructions after it.
pub(super) fn review(ask: &ReviewAsk) -> ReviewMessage {
    let range = format!("{}..{}", ask.base, ask.head);
    let prompt = format!(
        "Review the code changes of the commits {range}: run `git diff {range}` to see them, \
         and `git log {range}` for their messages. Provide prioritized, actionable findings."
    );
    let text = match ask.instructions.as_deref().filter(|more| !more.is_empty()) {
        Some(instructions) => format!("{prompt}\n\n{instructions}"),
        None => prompt,
    };
    ReviewMessage { text, review: true }
}

/// The parameters of the `review/start` of a review message: its text as a custom target.
pub(super) fn review_params(message: &Outgoing, thread: &str) -> Value {
    json!({ "target": { "instructions": message.text, "type": "custom" }, "threadId": thread })
}
