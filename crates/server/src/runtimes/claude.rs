//! Claude Code's runtime, the built-in `claude`: the installed `claude` command, run in print
//! mode with stream-json both ways, its stdin kept open for the session's messages.
//!
//! - **A session's process** is `claude -p` in the session's directory, in `auto` mode, with
//!   the Uraeda skill as a plugin, the app's instructions appended to its system prompt, and,
//!   for a workflow session, Uraeda's tools in place of its own sub-agents: see `args.rs`.
//! - **Its output** is read a line at a time into events: see `events.rs`. Its own formats, as
//!   a usage limit's or a wakeup's, stay in this module.
//! - **What is asked of it while it runs** is a control request: an interrupt, a message taken
//!   back, its effort, and what it runs on: see `control.rs`.
//! - **A blocked action** is a denial of its turn's result, and runs once a process is opened
//!   with its rule, [`Runtime::allow_rule`]: no process waits on an answer.
//! - **The command** is the `command` setting of the built-in extension `claude`, read as each
//!   process starts, and the owner turns the runtime off by turning that extension off.

mod allow;
mod args;
mod control;
mod events;
mod folders;
mod json;
mod limits;
mod models;
mod process;
mod results;
mod stream;
mod system;
mod time;
mod tools;
mod wakeups;

use std::path::PathBuf;
use std::process::Stdio;
use std::sync::Arc;
use std::time::Duration;

use serde_json::{Value, json};
use uraeda_core::extensions::settings_json;

use self::control::Controls;
use self::events::Parser;
use self::folders::Folders;
use self::process::Process;
use super::built_in::Given;
use super::{
    AgentProcess, Capabilities, Child, ModelList, Options, ReviewAsk, ReviewMessage, Runtime,
    RuntimeError, Runtimes, Spawn,
};
use crate::Failure;
use crate::live::wait;
use crate::runner::{Denial, Event};
use crate::shared::Shared;

/// The name the runtime is registered as: its built-in extension's.
const NAME: &str = "claude";

/// `claude --version` gives up after this long.
const VERSION_TIMEOUT: Duration = Duration::from_secs(5);

/// The process that lists the models gives up after this long.
const MODELS_TIMEOUT: Duration = Duration::from_secs(10);

/// Claude Code, run through its installed `claude` command.
pub(super) struct Claude {
    shared: Shared,
    folders: Folders,
}

/// Claude Code's runtime, on a server.
fn claude(shared: &Shared) -> Claude {
    Claude {
        shared: shared.clone(),
        folders: Folders::new(shared.get::<Given>(), shared.data_dir()),
    }
}

/// Registers Claude Code's runtime as the built-in `claude`, for as long as the server runs.
pub(super) fn register(shared: &Shared) -> Result<(), Failure> {
    let runtimes = shared.get::<Runtimes>();
    runtimes.register(NAME, Arc::new(claude(shared)))?;
    Ok(())
}

impl Claude {
    /// The command to run: the built-in extension's `command` setting, `claude` from the `PATH`
    /// unless the owner set another.
    fn command(&self) -> String {
        let settings = settings_json(self.shared.config_dir(), NAME, None);
        let settings: Value = serde_json::from_str(&settings).unwrap_or_default();
        let command = json::words(&settings, "command").unwrap_or(NAME);
        command.to_owned()
    }

    /// A folder of the server's environment's home: the data folder when it names none.
    fn home(&self) -> PathBuf {
        let home = self.shared.environment().var("HOME");
        home.map_or_else(|| self.shared.data_dir().to_owned(), PathBuf::from)
    }

    /// Claude Code's configuration folder, where it keeps its transcripts.
    fn config_dir(&self) -> PathBuf {
        let named = self.shared.environment().var("CLAUDE_CONFIG_DIR");
        named.map_or_else(|| self.home().join(".claude"), PathBuf::from)
    }
}

/// The levels `/code-review` takes, the names of Claude Code's efforts.
const REVIEW_LEVELS: [&str; 5] = ["low", "medium", "high", "xhigh", "max"];

impl Runtime for Claude {
    fn name(&self) -> String {
        "Claude Code".to_owned()
    }

    fn kind(&self) -> String {
        NAME.to_owned()
    }

    fn icon(&self) -> String {
        "uraeda:harness-claude".to_owned()
    }

    /// Taking back is Claude Code's `cancel_async_message`. It asks for no approval: see
    /// [the module](self).
    fn capabilities(&self) -> Capabilities {
        Capabilities {
            approvals: false,
            images: true,
            queue: true,
            steer: true,
            subagents: true,
            take_back: true,
        }
    }

    fn open(&self, options: Options) -> Box<dyn AgentProcess> {
        self.folders.prepare(&options.skills);
        let spawn = Spawn {
            program: self.command(),
            args: args::session(&options, &self.folders),
            cwd: options.cwd.clone(),
            env: options.tools.env(),
        };
        let child = Child::spawn(&self.shared, spawn);
        let cwd = options.cwd.to_string_lossy().into_owned();
        let parser = Parser::new(cwd, time::zone(self.shared.environment()));
        Box::new(Process::start(&self.shared, child, parser))
    }

    /// Looks for `<Claude Code's folder>/projects/*/<id>.jsonl`, without reading any file.
    fn has_session(&self, native_id: &str) -> bool {
        let Ok(projects) = std::fs::read_dir(self.config_dir().join("projects")) else {
            return false;
        };
        let transcript = format!("{native_id}.jsonl");
        let mut projects = projects.flatten();
        projects.any(|project| project.path().join(&transcript).exists())
    }

    fn allow_rule(&self, denial: &Denial) -> Option<String> {
        allow::rule(denial)
    }

    /// The first line `claude --version` prints, within 5 seconds.
    fn version(&self) -> Option<String> {
        let command = self.shared.environment().command(self.command());
        let mut command = tokio::process::Command::from(command);
        command
            .arg("--version")
            .stdin(Stdio::null())
            .stderr(Stdio::null())
            .kill_on_drop(true);
        let printed = wait(tokio::time::timeout(VERSION_TIMEOUT, command.output()));
        let printed = printed
            .ok()?
            .ok()
            .filter(|printed| printed.status.success())?;
        let printed = String::from_utf8_lossy(&printed.stdout);
        let first = printed.lines().next()?.trim();
        (!first.is_empty()).then(|| first.to_owned())
    }

    /// The models listed for the account, through a short process, closed once it answered
    /// `list_models` and `get_settings`, which spend no usage: a failure when it does not
    /// answer within 10 seconds. Its group is asked to end as it is done with, and killed if it
    /// outlives that.
    fn models(&self) -> Result<Option<ModelList>, RuntimeError> {
        let spawn = Spawn {
            program: self.command(),
            args: args::MODELS.map(str::to_owned).to_vec(),
            cwd: self.home(),
            env: Vec::new(),
        };
        let mut short = Child::spawn(&self.shared, spawn);
        let mut lines = short.lines();
        let short = Arc::new(short);
        let controls = Arc::new(Controls::new(short.clone()));
        let (reading, answers) = (short.clone(), controls.clone());
        tokio::spawn(async move {
            while let Some(line) = lines.next().await {
                answers.answer(&line);
            }
            answers.end(&unlisted(&reading.exited().await));
        });
        let asking = async {
            let list = controls.ask(json!({ "subtype": "list_models" }));
            let list = list.answer().await?;
            let settings = controls.ask(json!({ "subtype": "get_settings" }));
            Ok(models::models(&list, &settings.answer().await?))
        };
        let listed = wait(tokio::time::timeout(MODELS_TIMEOUT, asking));
        short.end_short();
        let slow = || {
            let seconds = MODELS_TIMEOUT.as_secs();
            Err(format!(
                "Claude Code did not list its models within {seconds} seconds"
            ))
        };
        let listed: Result<ModelList, String> = listed.unwrap_or_else(|_| slow());
        listed.map(Some).map_err(RuntimeError::Failed)
    }

    /// Claude Code's own review of the commits `<base>..<head>`: `/code-review` at the level of
    /// the reviewer's effort, `medium` for an effort it does not name, never left out, which
    /// would reuse the level the human last typed. `/code-review` reads all the text after its
    /// level as its target: the instructions follow the range there, and the review reads them.
    fn review_message(&self, ask: &ReviewAsk) -> Option<ReviewMessage> {
        let effort = ask.effort.as_deref();
        let level = effort.filter(|effort| REVIEW_LEVELS.contains(effort));
        let level = level.unwrap_or("medium");
        let command = format!("/code-review {level} {}..{}", ask.base, ask.head);
        let instructions = ask.instructions.as_deref().filter(|said| !said.is_empty());
        let text = match instructions {
            Some(instructions) => format!("{command}\n\n{instructions}"),
            None => command,
        };
        Some(ReviewMessage {
            text,
            review: false,
        })
    }
}

/// Why a process that ended listed no model.
fn unlisted(exit: &Event) -> String {
    match exit {
        Event::Exit {
            missing: Some(true),
            stderr,
            ..
        } => format!("Claude Code is not available: {stderr}"),
        Event::Exit { stderr, .. } if !stderr.is_empty() => {
            format!("Claude Code exited before listing its models: {stderr}")
        }
        _ => "Claude Code exited before listing its models".to_owned(),
    }
}
