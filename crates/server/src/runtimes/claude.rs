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

mod accounts;
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
mod usage;
mod wakeups;

use std::path::PathBuf;
use std::process::Stdio;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use serde_json::{Value, json};
use uraeda_core::extensions::settings_json;

use self::accounts::{ClaudeAccounts, folder_env};
use self::events::Parser;
use self::folders::Folders;
use self::process::Process;
use super::accounts::USAGE_MAX_AGE;
use super::built_in::Given;
use super::{
    AccountState, Accounts, AgentProcess, Capabilities, Child, ModelList, Options, ReviewAsk,
    ReviewMessage, Runtime, RuntimeError, Runtimes, Spawn,
};
use crate::Failure;
use crate::live::{locked, wait};
use crate::runner::Denial;
use crate::shared::Shared;

/// The name the runtime is registered as: its built-in extension's.
const NAME: &str = "claude";

/// `claude --version` gives up after this long.
const VERSION_TIMEOUT: Duration = Duration::from_secs(5);

/// The most `models` waits for the accounts' ask, so that with its own 10 seconds it stays
/// within the registry's 15.
const MODELS_ACCOUNTS_WAIT: Duration = Duration::from_secs(4);

/// Claude Code, run through its installed `claude` command.
pub(super) struct Claude {
    shared: Shared,
    folders: Folders,
    /// The accounts of the `accounts` setting as it last read: built again when it changes.
    accounts: Mutex<Option<Arc<ClaudeAccounts>>>,
}

/// Claude Code's runtime, on a server.
fn claude(shared: &Shared) -> Claude {
    Claude {
        shared: shared.clone(),
        folders: Folders::new(shared.get::<Given>(), shared.data_dir()),
        accounts: Mutex::default(),
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
        command(&self.shared)
    }

    /// The lines of the `accounts` setting: its texts, none when it is no list.
    fn account_lines(&self) -> Vec<String> {
        let settings = settings_json(self.shared.config_dir(), NAME, None);
        let settings: Value = serde_json::from_str(&settings).unwrap_or_default();
        let lines = json::field(&settings, "accounts").and_then(Value::as_array);
        let lines = lines.map(Vec::as_slice).unwrap_or_default().iter();
        lines.filter_map(Value::as_str).map(str::to_owned).collect()
    }

    /// The accounts of the setting as it is now, kept while it does not change: none for an
    /// empty list, on which sessions run on the server's own login.
    fn listed(&self) -> Option<Arc<ClaudeAccounts>> {
        let lines = self.account_lines();
        let mut kept = locked(&self.accounts);
        if lines.iter().all(|line| line.trim().is_empty()) {
            *kept = None;
            return None;
        }
        if kept.as_ref().is_none_or(|kept| kept.lines() != lines) {
            let (shared, home) = (self.shared.clone(), self.home());
            let asked = home.clone();
            let ask = move |folder: &str| usage::ask(&shared, &command(&shared), &asked, folder);
            let clock = self.shared.clone();
            let now = move || clock.now();
            let accounts =
                ClaudeAccounts::new(lines, &home, Arc::new(ask), Arc::new(now), kept.as_deref());
            *kept = Some(Arc::new(accounts));
        }
        kept.clone()
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

/// The command to run: the built-in extension's `command` setting, `claude` from the `PATH`
/// unless the owner set another.
fn command(shared: &Shared) -> String {
    let settings = settings_json(shared.config_dir(), NAME, None);
    let settings: Value = serde_json::from_str(&settings).unwrap_or_default();
    let command = json::words(&settings, "command").unwrap_or(NAME);
    command.to_owned()
}

/// The levels `/code-review` takes, the names of Claude Code's efforts.
const REVIEW_LEVELS: [&str; 5] = ["low", "medium", "high", "xhigh", "max"];

impl Claude {
    /// The account the models are listed in: the first listed that is signed in, else the
    /// first, once their ask answered or 4 seconds passed. None without accounts.
    fn models_account(&self) -> Option<String> {
        let accounts = self.listed()?;
        let asking = accounts.clone();
        let (told, answered) = std::sync::mpsc::channel();
        tokio::task::spawn_blocking(move || {
            asking.refresh(USAGE_MAX_AGE);
            let _ = told.send(());
        });
        let _ = answered.recv_timeout(MODELS_ACCOUNTS_WAIT);
        let listed = accounts.list();
        let ready = listed
            .iter()
            .find(|account| account.state == AccountState::Ready);
        ready.or(listed.first()).map(|account| account.id.clone())
    }
}

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
        let home = self.home();
        let account = options.account.as_deref();
        let account_env = account.map_or_else(Vec::new, |folder| folder_env(folder, &home));
        let spawn = Spawn {
            program: self.command(),
            args: args::session(&options, &self.folders),
            cwd: options.cwd.clone(),
            env: [account_env, options.tools.env()].concat(),
        };
        let child = Child::spawn(&self.shared, spawn);
        let cwd = options.cwd.to_string_lossy().into_owned();
        let parser = Parser::new(cwd, time::zone(self.shared.environment()));
        Box::new(Process::start(&self.shared, child, parser))
    }

    /// Looks for `<folder>/projects/*/<id>.jsonl`, in the account's folder, else Claude Code's
    /// own, without reading any file.
    fn has_session(&self, native_id: &str, account: Option<&str>) -> bool {
        let folder = account.map_or_else(|| self.config_dir(), PathBuf::from);
        let Ok(projects) = std::fs::read_dir(folder.join("projects")) else {
            return false;
        };
        let transcript = format!("{native_id}.jsonl");
        let mut projects = projects.flatten();
        projects.any(|project| project.path().join(&transcript).exists())
    }

    fn allow_rule(&self, denial: &Denial) -> Option<String> {
        allow::rule(denial)
    }

    fn accounts(&self) -> Option<Arc<dyn Accounts>> {
        self.listed().map(|accounts| accounts as Arc<dyn Accounts>)
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
        let home = self.home();
        let spawn = Spawn {
            program: self.command(),
            args: args::MODELS.map(str::to_owned).to_vec(),
            env: self
                .models_account()
                .map_or_else(Vec::new, |folder| folder_env(&folder, &home)),
            cwd: home,
        };
        let requests = vec![
            json!({ "subtype": "list_models" }),
            json!({ "subtype": "get_settings" }),
        ];
        let words = usage::Words {
            did: "list its models",
            exited: "listing its models",
        };
        let answers = wait(usage::short(&self.shared, spawn, requests, &words));
        let listed = answers.map(|answers| models::models(&answers[0], &answers[1]));
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
