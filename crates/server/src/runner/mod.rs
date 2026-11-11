//! The sessions the server runs: their store, and what a turn's transcript is made of.
//!
//! - [`Store`] is `sessions.sqlite`, in the data folder: the sessions, their turns, and each
//!   turn's log. Nothing else opens that file. The server opens it as it starts, every domain
//!   reads it as `shared.get::<Store>()`, and it closes as the server stops.
//! - [`Event`] is one event of a turn, whatever the agent. A runtime gives the agent's, the
//!   runner adds its own, and a turn's transcript is the log of them: appended with
//!   [`Store::append`], read from any place with [`Store::log`], and never changed.
//! - [`import`] copies the Node server's sessions into the store, once.

mod account;
mod catch_ups;
mod chain;
mod continuer;
mod edits;
mod event;
mod import;
mod live;
mod log;
pub(crate) mod manager;
mod message;
mod moves;
mod page;
pub(crate) mod picks;
mod processes;
pub(crate) mod reads;
mod reviews;
mod running;
mod schema;
pub(crate) mod send;
mod session;
mod session_edits;
mod starts;
pub(crate) mod status;
mod store;
mod sub_sessions;
mod transcript;
mod turn;
mod turns;
mod waits;

pub use event::{
    Activity, BackgroundKind, BackgroundTask, ChatImage, Denial, Event, Limit, LimitKind, Origin,
    Subagent, TokenCounts, ToolKind, UsageWindow,
};
pub use import::{IMPORTED, ImportError, Imported, Replace, import};
pub use log::{Appended, Growth, Logged};
pub use manager::{IDLE_CLOSE, SERVER_STOPPED, Sessions, TAKEN_BACK, TERMINATE_AFTER, WATCHDOG};
pub(crate) use manager::{Runner, Target, refusals};
pub(crate) use message::effort_name;
pub use page::{Blocked, OUTPUT_LIMIT, PAGE, sent};
pub(crate) use running::latest_of;
pub use session::{NewSession, Session};
pub use store::{FILE, Store, StoreError};
pub use turn::{ContinueReason, NewTurn, Turn, TurnKind, TurnState};
pub use turns::TurnEnd;

use crate::Failure;
use crate::http::Routes;
use crate::shared::Shared;

/// Opens the session store of the data folder, and closes it as the server stops.
///
/// # Errors
///
/// When the store cannot be opened, as one a newer version wrote: the server does not start on
/// sessions it cannot read, and the file is left as it is.
pub(crate) fn mount(shared: &Shared, _routes: &mut Routes) -> Result<(), Failure> {
    shared.provide(Store::open(shared.data_dir())?);
    let stopping = shared.clone();
    shared.on_stop("sessions", async move {
        stopping.get::<Store>().close();
    });
    Ok(())
}

/// How often each runtime is asked for its version: one that came back continues the runs the
/// server's restart cut.
const CHECK_EVERY: std::time::Duration = std::time::Duration::from_secs(60);

/// A runtime registered, removed, or turned on or off is checked this long after: one checked
/// by whoever registered it is not asked twice.
const CHECK_AFTER_CHANGE: std::time::Duration = std::time::Duration::from_secs(1);

/// Starts the sessions' manager, once everything it runs on is mounted: the turns a stopped
/// server left running are stopped, the agents' tools run, the runtimes are checked now and
/// every minute, the continues are armed, and the pull requests behind the default branch are
/// caught up. As the server stops, every turn stops and every process closes, before the
/// runtimes' own stop ends what is left.
///
/// # Errors
///
/// When the store cannot be written.
pub(crate) fn serve(shared: &Shared, _routes: &mut Routes) -> Result<(), Failure> {
    let store = shared.get::<Store>();
    // One server owns the data folder: a turn still running or queued there runs nowhere.
    store.interrupted(SERVER_STOPPED, shared.now())?;
    shared.provide(account::Kept::default());
    shared.provide(Sessions::new());
    let runner = Runner::of(shared);
    let tools = reviews::Tools::of(runner.clone());
    shared
        .get::<crate::mcp::Mcp>()
        .serve(std::sync::Arc::new(tools));
    // A runtime registered, removed, or turned on or off is shown, and checked.
    let following = std::sync::Arc::new(manager::Following::of(&runner));
    let runtimes = shared.get::<crate::runtimes::Runtimes>();
    let listed = following.clone();
    crate::records::repositories::on_change(shared, move || listed.list_changed());
    runtimes.on_change(move || following.runtimes_changed());
    runner.clone().started();
    let stopping = runner.clone();
    shared.on_stop("turns", async move {
        let closing = tokio::task::spawn_blocking(move || {
            stopping.close_all();
            let tools = stopping.shared.get::<crate::mcp::Mcp>();
            tools.serve(std::sync::Arc::new(reviews::Stopped));
            stopping.let_go();
        });
        let _ = closing.await;
    });
    Ok(())
}
