//! What `claude` is started with: a session's process, and the short one that lists the models.

use std::path::Path;

use serde_json::json;

use super::folders::Folders;
use super::instructions::instructions;
use crate::mcp;
use crate::runtimes::{Options, TOKEN_VARIABLE, TOOL_TIMEOUT, TOOLS_SERVER, Tools};

/// The arguments of the process that lists the models: print mode and stream-json, as a
/// session's, in `auto` mode, which the list says each model keeps or drops, and no transcript
/// written, as no message is sent.
pub(super) const MODELS: [&str; 9] = [
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

/// Claude Code's tools that start its own sub-agents: `Task` is `Agent`'s older name.
const SUB_AGENT_TOOLS: [&str; 4] = ["Agent", "Task", "Workflow", "TeamCreate"];

/// The arguments of a session's process: print mode, stream-json both ways, `auto` mode, the
/// skill, the app's instructions, appended to the system prompt on every start, and the chat
/// images' folder, which the agent reads even when the user blocks reads outside the working
/// directory. Only that folder is added, never the whole data folder: `auto` mode lets the agent
/// write to added folders. The extensions folder is added too, so the agent writes extensions
/// there, and each extension of `options.skills` gives one more plugin folder, after Uraeda's
/// own. With `options.tools`, Uraeda's tools are given and allowed, and the agent's own
/// sub-agents taken away.
pub(super) fn session(options: &Options, folders: &Folders) -> Vec<String> {
    let mut args = Args::default();
    args.all(["-p", "--input-format", "stream-json"]);
    args.all(["--output-format", "stream-json", "--verbose"]);
    args.all(["--include-partial-messages", "--permission-mode", "auto"]);
    for (option, picked) in [("--model", &options.model), ("--effort", &options.effort)] {
        if let Some(picked) = picked {
            args.all([option, picked]);
        }
    }
    args.path("--plugin-dir", &folders.plugin);
    for skills in &options.skills {
        args.path("--plugin-dir", &folders.extension_plugin(skills));
    }
    args.path("--add-dir", &folders.images);
    args.path("--add-dir", &folders.extensions);
    tools(&options.tools, &mut args);
    let said = instructions(&folders.extensions, &folders.docs);
    args.all(["--append-system-prompt", &said]);
    let session = if options.resume {
        "--resume"
    } else {
        "--session-id"
    };
    args.all([session, &options.native_id]);
    let allowed: Vec<String> = allowed(options);
    if !allowed.is_empty() {
        args.all(["--allowedTools"]);
        args.all(allowed.iter().map(String::as_str));
    }
    args.0
}

/// The rules of this process, then each of Uraeda's tools, when it gets them.
fn allowed(options: &Options) -> Vec<String> {
    let mut allowed = options.allowed.clone();
    if let Tools::Uraeda { .. } = options.tools {
        let tool = |name: &&str| format!("mcp__{TOOLS_SERVER}__{name}");
        allowed.extend(mcp::tool_names().iter().map(tool));
    }
    allowed
}

/// The arguments that give a process Uraeda's tools and take its own sub-agents away: Uraeda's
/// MCP server over HTTP, its token read from the environment, as the arguments are readable by
/// every user, and its calls given up only after `TOOL_TIMEOUT`, as progress does not extend a
/// call. The user's own servers stay. With `Tools::None`, only the sub-agents are taken away; a
/// chat keeps them. Both options take several values, so they come before an option that takes
/// one.
fn tools(tools: &Tools, args: &mut Args) {
    match tools {
        Tools::Own => return,
        Tools::None => {}
        Tools::Uraeda { url, .. } => {
            let timeout = u64::try_from(TOOL_TIMEOUT.as_millis()).unwrap_or(u64::MAX);
            let server = json!({
                "headers": { "Authorization": format!("Bearer ${{{TOKEN_VARIABLE}}}") },
                "timeout": timeout,
                "type": "http",
                "url": url,
            });
            let config = json!({ "mcpServers": { TOOLS_SERVER: server } });
            args.all(["--mcp-config", &config.to_string()]);
        }
    }
    args.all(["--disallowedTools"]);
    args.all(SUB_AGENT_TOOLS);
}

/// Arguments, as they are added.
#[derive(Default)]
struct Args(Vec<String>);

impl Args {
    fn all<'a>(&mut self, args: impl IntoIterator<Item = &'a str>) {
        self.0.extend(args.into_iter().map(str::to_owned));
    }

    /// An option and the path it takes.
    fn path(&mut self, option: &str, path: &Path) {
        self.all([option, &path.to_string_lossy()]);
    }
}
