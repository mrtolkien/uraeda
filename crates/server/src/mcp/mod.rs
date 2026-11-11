//! The agents' MCP endpoint, `/mcp`: where an agent's process, which the server runs, calls
//! Uraeda's tools back. It speaks MCP's streamable HTTP transport, stateless, for the four
//! messages a client of tools sends: see [`endpoint`].
//!
//! # Who may call it
//!
//! Only an agent's process, with its own token: `/mcp` takes no session, and no device's token.
//! [`Mcp::issue`] makes a random token for a session's new process, and [`Mcp::revoke`] ends it
//! as the process closes. A token is kept only as its hash, in memory, and compared in constant
//! time. The runtime gives it to its process in the environment, never in a file, and never in
//! the arguments, which other users of the machine read.
//!
//! # The tools
//!
//! `run_agent` and `review` are declared here, with what an agent reads of them and the check of
//! their arguments. What they do is the sessions': [`Mcp::serve`] takes their [`Runner`]. Until
//! then, a call answers the tool's error, saying so.

mod endpoint;
mod tokens;
mod tools;

use std::sync::{Arc, PoisonError, RwLock};

use axum::extract::DefaultBodyLimit;
use axum::middleware;
use axum::routing::post;

use crate::Failure;
use crate::http::Routes;
use crate::shared::Shared;
use endpoint::Running;
use tokens::Tokens;
pub use tools::{Answer, Review, RunAgent, Runner};

/// The endpoint's state, `shared.get::<Mcp>()`: its tokens, what runs its tools, and its calls.
#[derive(Default)]
pub struct Mcp {
    tokens: Tokens,
    runner: RwLock<Option<Arc<dyn Runner>>>,
    running: Running,
}

impl Mcp {
    /// A new token for `session`'s new process, its earlier process's token revoked: a session
    /// runs one process at a time. Its calls run for that session.
    pub fn issue(&self, session: &str) -> String {
        self.tokens.issue(session)
    }

    /// Revokes a token, as its process closes: a token no longer issued is left as it is.
    pub fn revoke(&self, token: &str) {
        self.tokens.revoke(token);
    }

    /// Gives the endpoint what runs its tools: the sessions, as they start.
    // TASK 15: the sessions call it with their `Runner`. Until then both tools answer that no
    // agent runs yet.
    pub fn serve(&self, runner: Arc<dyn Runner>) {
        *self.runner.write().unwrap_or_else(PoisonError::into_inner) = Some(runner);
    }

    /// What runs the tools, once the sessions gave it.
    fn runner(&self) -> Option<Arc<dyn Runner>> {
        self.runner
            .read()
            .unwrap_or_else(PoisonError::into_inner)
            .clone()
    }
}

/// The endpoint's address, which a runtime gives an agent's process with its token: on the
/// server's own machine, where the process runs.
pub fn url(shared: &Shared) -> String {
    format!("{}/mcp", shared.address())
}

/// Mounts `/mcp`, and provides the [`Mcp`].
pub(crate) fn mount(shared: &Shared, routes: &mut Routes) -> Result<(), Failure> {
    shared.provide(Mcp::default());
    let checked = middleware::from_fn_with_state(shared.clone(), endpoint::checked);
    let limit = DefaultBodyLimit::max(endpoint::MAX_BODY);
    // The token is checked first, whatever the method, and before the body is read.
    routes.route("/mcp", post(endpoint::message).layer(limit).layer(checked));
    Ok(())
}
