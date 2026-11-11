//! Codex's runtime: the built-in `codex`, run through the installed `codex` command's
//! `app-server`, its own JSON-RPC protocol over stdio, one process per open session.
//!
//! It is the Node server's `CodexAdapter`, of `packages/server/src/runner/codex.ts`, with what
//! it imports. Codex's formats stay in this folder: the field names follow the protocol's
//! generated types (Codex 0.163.0).
//!
//! - **A process is one thread.** As it opens, it introduces the client, gives Codex the skill
//!   folders, reads the model names, and starts the thread, or resumes it by its id: its `init`
//!   follows, with what it runs on, or an `init` with the `problem` that keeps it from running.
//! - **A message starts a turn**, joins the running one when it steers, or waits for the next:
//!   see `turns.rs`. A review message runs Codex's own review, `review/start`.
//! - **Codex asks its own reviewer, never the human.** A thread runs in the `workspace-write`
//!   sandbox with the network off, approvals on request, reviewed by Codex's automatic
//!   reviewer, whose verdict is a `notice`. Uraeda runs a thread only when Codex's answer says
//!   it applied those. A request Codex makes of its client is refused at once, so no turn waits
//!   on an answer: no action is a denial of a result, and [`Runtime::allow_rule`] gives no
//!   rule.
//! - **A workflow session gets Uraeda's tools** as an MCP server of the thread, its token in
//!   the process's environment, and, as a sub-session does, a model catalog without Codex's
//!   own sub-agents.

mod catalog;
mod events;
mod instructions;
mod items;
mod json;
mod limits;
mod lister;
mod models;
mod permissions;
mod process;
mod rollouts;
mod rpc;
mod short;
mod start;
mod thread;
mod turns;
mod wire;

use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;

use uraeda_core::extensions::settings_json;
use uraeda_protocol::{Capabilities, ModelList};

use super::built_in::Given;
use super::{AgentProcess, Options, ReviewAsk, ReviewMessage, Runtime, RuntimeError, Spawn};
use crate::Failure;
use crate::live::wait;
use crate::runner::Denial;
use crate::shared::Shared;

/// The name the runtime is registered under: its built-in extension's, which the owner turns
/// off to turn the runtime off.
pub const NAME: &str = "codex";

/// `codex --version` gives up after this long.
const VERSION_TIMEOUT: Duration = Duration::from_secs(5);

/// A process's start, from `initialize` to its thread started or resumed, gives up after this
/// long.
pub const START_TIMEOUT: Duration = Duration::from_secs(60);

/// What every process of a server's Codex shares.
struct Setup {
    folders: Arc<Given>,
    catalogs: catalog::Catalogs,
    /// How long a process's start may take.
    start_within: Duration,
}

impl Setup {
    /// The developer instructions of every thread.
    fn instructions(&self) -> String {
        instructions::instructions(&self.folders.extensions, &self.folders.docs)
    }
}

/// Codex, one `codex app-server` per open session.
pub struct Codex {
    shared: Shared,
    setup: Arc<Setup>,
}

/// Codex's runtime, for a server: the one the server registers as it starts.
pub fn codex(shared: &Shared) -> Codex {
    Codex {
        shared: shared.clone(),
        setup: Arc::new(setup(shared, START_TIMEOUT)),
    }
}

/// What a server's processes share, each giving up its start after `start_within`.
fn setup(shared: &Shared, start_within: Duration) -> Setup {
    Setup {
        folders: shared.get::<Given>(),
        // The catalogs without sub-agents: never in Codex's home.
        catalogs: catalog::Catalogs::new(shared.data_dir().join("codex-catalog")),
        start_within,
    }
}

/// Registers Codex's runtime with the server, as the built-in `codex`, for as long as it runs.
pub(super) fn register(shared: &Shared) -> Result<(), Failure> {
    super::register(shared, NAME, Arc::new(codex(shared)))?;
    Ok(())
}

/// The command a session runs: the `command` setting of the built-in extension, read as each
/// process starts, else `codex`, found on the server's `PATH`.
fn command(shared: &Shared) -> String {
    let settings = settings_json(shared.config_dir(), NAME, None);
    let settings: serde_json::Value = serde_json::from_str(&settings).unwrap_or_default();
    let command = settings.get("command").and_then(serde_json::Value::as_str);
    command
        .filter(|command| !command.is_empty())
        .unwrap_or("codex")
        .to_owned()
}

/// The home folder of the server's environment.
fn home(shared: &Shared) -> PathBuf {
    shared
        .environment()
        .var("HOME")
        .map_or_else(|| PathBuf::from("/"), PathBuf::from)
}

/// Codex's home folder, where it keeps its threads: `$CODEX_HOME`, else `~/.codex`.
fn codex_home(shared: &Shared) -> PathBuf {
    let named = shared.environment().var("CODEX_HOME").map(PathBuf::from);
    named.unwrap_or_else(|| home(shared).join(".codex"))
}

impl Codex {
    /// The same runtime, whose processes give up their start after `within`: a test's.
    #[must_use]
    pub fn start_within(self, within: Duration) -> Codex {
        let setup = Arc::new(setup(&self.shared, within));
        Codex { setup, ..self }
    }
}

impl Runtime for Codex {
    fn name(&self) -> String {
        "Codex".to_owned()
    }

    fn kind(&self) -> String {
        "codex".to_owned()
    }

    fn icon(&self) -> String {
        "uraeda:harness-openai".to_owned()
    }

    fn capabilities(&self) -> Capabilities {
        Capabilities {
            approvals: false,
            images: true,
            queue: true,
            steer: true,
            subagents: false,
            take_back: true,
        }
    }

    fn open(&self, options: Options) -> Box<dyn AgentProcess> {
        self.setup.folders.prepare();
        Box::new(process::open(&self.shared, self.setup.clone(), options))
    }

    /// Whether the thread's file is in Codex's home, unread.
    fn has_session(&self, native_id: &str, _account: Option<&str>) -> bool {
        rollouts::has_rollout(&codex_home(&self.shared), native_id)
    }

    /// Codex asks its own reviewer, never the human: no rule to add.
    fn allow_rule(&self, _denial: &Denial) -> Option<String> {
        None
    }

    fn version(&self) -> Option<String> {
        let spawn = Spawn {
            program: command(&self.shared),
            args: vec!["--version".to_owned()],
            cwd: self.shared.data_dir().to_owned(),
            env: Vec::new(),
        };
        let printed = wait(short::run(&self.shared, spawn, VERSION_TIMEOUT)).ok()?;
        let first = printed.lines().next()?.trim();
        (!first.is_empty()).then(|| first.to_owned())
    }

    fn models(&self) -> Result<Option<ModelList>, RuntimeError> {
        let (command, home) = (command(&self.shared), home(&self.shared));
        let listed = wait(lister::list(&self.shared, command, home));
        listed.map(Some).map_err(RuntimeError::Failed)
    }

    fn review_message(&self, ask: &ReviewAsk) -> Option<ReviewMessage> {
        Some(thread::review(ask))
    }
}
