//! The runtimes: the one contract every agent is reached through, the registry the server
//! keeps them in, the process a runtime runs its agent in, and the fake runtime.
//!
//! [`Runtime`] and [`AgentProcess`] mirror the adapter an extension's `server.ts` implements,
//! `Runtime` and `AgentProcess` of `uraeda/server`
//! ([`extension-api.ts`](/packages/server/src/extension-api.ts)): the same methods, taking and
//! giving the same JSON, so Claude Code's runtime, Codex's, the fake, and one in an extension's
//! VM are the same thing to the sessions.
//!
//! # Where each method runs
//!
//! - **A [`Runtime`]'s methods are plain functions, called on a blocking thread**: a handler's,
//!   or `spawn_blocking`'s. They may read the disk, start a process, or wait for another
//!   thread, as a runtime in a VM does for its answer. One that waits bounds its own wait:
//!   `version` within 5 seconds, `models` within 10, a VM's call within 10. `live::wait(future)`
//!   awaits from one, and tokio is there: [`Child::spawn`] works from one.
//! - **An [`AgentProcess`]'s methods return at once, from any thread or task**: `send`,
//!   `interrupt`, `kill`, `take_back`, `set_effort`, and `close` write to the agent, or tell
//!   the task that does, and wait for nothing. None fails: on a process that exited, each does
//!   nothing. What the agent made of it comes back as events.
//!
//! # A process's events
//!
//! `open` returns at once with the process, and never fails: a command that is missing, or a
//! session the agent does not start, is the process's `exit`, or an `init` with its `problem`.
//!
//! The process's events are one [`Events`] stream, taken once with [`AgentProcess::events`]
//! and read by one reader, with `next().await` in a task or `blocking_next()` on a blocking
//! thread. A runtime makes the stream with [`events()`], and writes to its [`Emitter`] from
//! the task that reads its agent's output, or from a VM's thread.
//!
//! - **In order, and never held back.** The stream has no limit: a runtime reads its agent's
//!   output as it comes, whatever its reader does.
//! - **Ended by one `exit`**, always the last event: the process's own, or, when a runtime
//!   went silent without one, an `exit` with no code. The reader ends its turn there.
//!
//! # What a turn is, in events
//!
//! - `init` as the agent's session starts, with the agent's own session id, which the session
//!   adopts when it was not resumed.
//! - For each message sent, `accepted` with its id once the agent read it, or `cancelled` once
//!   it was taken back unread.
//! - The reply: `textDelta` pieces then the `text` whole, `activity`, `thought`, `toolStart`
//!   and `toolEnd`, `notice`, `runsOn`, `usage`, `tokens`, `limit`, `retry`, `background`,
//!   `wakeup`.
//! - `result`, which ends the turn: `ok`, its `errors`, `interrupted` when [`interrupt`] ended
//!   it, which is a stop and no failure, and its `denials`.
//!
//! [`interrupt`]: AgentProcess::interrupt
//!
//! # Permissions
//!
//! An agent runs with the least permission that lets a step finish, and never asks while it
//! runs: an action its permissions block is skipped, and named in the `denials` of the turn's
//! `result`. It waits there, in the transcript, for the human. Their yes is
//! [`Runtime::allow_rule`], the narrowest rule for that action, then a process opened with the
//! rule in [`Options::allowed`], for that process only, and a message that asks again.
//!
//! # A runtime's process
//!
//! A runtime that runs a command starts it with [`Child::spawn`]: in the server's environment,
//! leading a process group of its own, which ends with it and with the server.
//!
//! # The registry
//!
//! [`register`] adds a runtime under its extension's name, and its [`Registered::remove`]
//! takes it away again, as an extension's does when it unloads. The sessions read
//! `shared.get::<Runtimes>()`.

mod child;
mod claude;
pub mod codex;
mod events;
pub mod fake;
mod options;
mod registry;

use std::sync::Arc;

pub use child::{Child, KILL_AFTER, Lines, Spawn};
pub use events::{Emitter, Events, events};
pub use options::{
    Options, Outgoing, ReviewAsk, ReviewMessage, RuntimeError, SentImage, TOKEN_VARIABLE,
    TOOL_TIMEOUT, TOOLS_SERVER, Tools, When,
};
pub use registry::{Checked, MODELS_REFRESH, MODELS_REFRESH_TIMEOUT, Registered, Runtimes, Status};
pub use uraeda_protocol::{AgentModel, Capabilities, ModelDefaults, ModelEffort, ModelList};

use crate::Failure;
use crate::http::Routes;
pub use crate::process::Signal;
use crate::runner::Denial;
use crate::shared::Shared;

/// An agent runtime: the one interface an agent is reached through, registered under a name
/// its sessions store.
///
/// Every method is a plain function, called on a blocking thread: see
/// [the module](self#where-each-method-runs).
pub trait Runtime: Send + Sync + 'static {
    /// The agent's name, for people: "Claude Code".
    fn name(&self) -> String;

    /// The agent's own kind, which a benchmark's record names it by: "claude".
    fn kind(&self) -> String;

    /// The icon of its mark, a name of the app's icon set: "uraeda:harness-claude".
    fn icon(&self) -> String;

    /// What the agent can do, which a client offers and nothing more.
    fn capabilities(&self) -> Capabilities;

    /// Opens a session's process, which takes messages until it is closed. It returns once the
    /// process is started, without waiting for the agent, and never fails: a process that
    /// cannot run says so as its `exit`, or as an `init` with a `problem`.
    fn open(&self, options: Options) -> Box<dyn AgentProcess>;

    /// Whether the agent still has the session's transcript, so it can be resumed.
    fn has_session(&self, native_id: &str) -> bool;

    /// The narrowest rule that allows a blocked action, given to `open` in
    /// [`Options::allowed`]: none when no rule allows that action alone. A rule is one line.
    fn allow_rule(&self, denial: &Denial) -> Option<String>;

    /// The agent's version, or none when it is not available on this machine.
    fn version(&self) -> Option<String>;

    /// The models the agent lists for the account, offered where a session starts: `Ok(None)`
    /// for a runtime that lists none.
    ///
    /// # Errors
    ///
    /// [`RuntimeError::Failed`] when the agent could not be asked: the last list is kept.
    fn models(&self) -> Result<Option<ModelList>, RuntimeError> {
        Ok(None)
    }

    /// The message that runs a review through the agent's own review, when it has one: else a
    /// reviewer on it is asked to review in plain words.
    fn review_message(&self, _ask: &ReviewAsk) -> Option<ReviewMessage> {
        None
    }
}

/// A session's open process, which takes messages until it is closed.
///
/// Every method but `events` returns at once, from any thread or task, and does nothing on a
/// process that exited: see [the module](self#where-each-method-runs).
pub trait AgentProcess: Send + Sync + 'static {
    /// Its events, ending with its `exit`: taken once, by its one reader. A second call gives
    /// a stream that has ended.
    fn events(&mut self) -> Events;

    /// Sends a message: steered into the running turn, or queued after it. The agent's
    /// `accepted` says it read it.
    fn send(&self, message: Outgoing);

    /// Ends the running turn through the agent's own interrupt, and keeps the process: the
    /// turn's `result` then says `interrupted`. A process that does not answer is signalled.
    fn interrupt(&self);

    /// Signals the process, and the processes it started.
    fn kill(&self, signal: Signal);

    /// Takes back a message the agent has not read: its `cancelled` says it was. One the agent
    /// already read stays read.
    fn take_back(&self, id: &str);

    /// Changes the effort it runs on, from its next turn on, none for the agent's default:
    /// whether it could. A runtime that cannot is reopened with the new effort.
    fn set_effort(&self, _effort: Option<&str>) -> bool {
        false
    }

    /// Ends the process once its turn is over, as its stdin's end does: its `exit` follows. A
    /// process still running long after is signalled by whoever closed it.
    fn close(&self);
}

/// Registers a runtime with the server, under its extension's name: what removes it again.
///
/// # Errors
///
/// [`RuntimeError::Taken`] when a runtime has that name already.
pub fn register(
    shared: &Shared,
    name: &str,
    runtime: Arc<dyn Runtime>,
) -> Result<Registered, RuntimeError> {
    shared.get::<Runtimes>().register(name, runtime)
}

/// Provides the [`Runtimes`], empty until each runtime registers, and stops with the server
/// every agent process still running.
pub(crate) fn mount(shared: &Shared, _routes: &mut Routes) -> Result<(), Failure> {
    shared.provide(Runtimes::new(shared.config_dir().to_owned()));
    shared.provide(child::Children::default());
    let stopping = shared.clone();
    shared.on_stop("agents", async move {
        stopping.get::<child::Children>().stop().await;
    });
    claude::register(shared)?;
    codex::register(shared)?;
    Ok(())
}
