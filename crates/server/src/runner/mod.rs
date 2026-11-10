//! The sessions the server runs: their store, and what a turn's transcript is made of.
//!
//! - [`Store`] is `sessions.sqlite`, in the data folder: the sessions, their turns, and each
//!   turn's log. Nothing else opens that file. The server opens it as it starts, every domain
//!   reads it as `shared.get::<Store>()`, and it closes as the server stops.
//! - [`Event`] is one event of a turn, whatever the agent. A runtime gives the agent's, the
//!   runner adds its own, and a turn's transcript is the log of them: appended with
//!   [`Store::append`], read from any place with [`Store::log`], and never changed.
//! - [`import`] copies the Node server's sessions into the store, once.

mod event;
mod import;
mod log;
mod schema;
mod session;
mod store;
mod turn;

pub use event::{
    Activity, BackgroundKind, BackgroundTask, ChatImage, Denial, Event, Limit, LimitKind, Origin,
    Subagent, TokenCounts, ToolKind, UsageWindow,
};
pub use import::{IMPORTED, ImportError, Imported, Replace, import};
pub use log::{Appended, Growth, Logged};
pub use session::{NewSession, Session};
pub use store::{FILE, Store, StoreError};
pub use turn::{ContinueReason, NewTurn, Turn, TurnKind, TurnState};

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
