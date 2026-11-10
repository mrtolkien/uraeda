//! The live engine: what serves `sub`, `unsub`, `call`, and `resume` on a welcomed connection,
//! as the protocol's contract says. It knows no domain: a domain registers what reads its
//! records and runs its actions, and says on the bus what changed.
//!
//! # Serving a record and an action
//!
//! Both are declared in the protocol's crate first, each with its line in `catalog()`. Then the
//! domain registers their handlers as it mounts:
//!
//! ```ignore
//! pub(super) fn register(shared: &Shared, registry: &Registry) -> Result<(), Failure> {
//!     shared.provide(Counters::default());
//!     registry.record::<Counter>(|shared, args| {
//!         let counters = shared.get::<Counters>();
//!         Ok(counters.read(&args.id)?)
//!     });
//!     registry.action::<CounterAdd>(|call, input| {
//!         let counters = call.shared().get::<Counters>();
//!         let count = counters.add(&input.id, input.by)?;
//!         call.bus().changed::<Counter>(&CounterArgs { id: input.id });
//!         Ok(count)
//!     });
//!     Ok(())
//! }
//! ```
//!
//! - **A handler is a plain function, run on a blocking thread.** It may read files, run git,
//!   and take a lock. It never awaits: [`wait`] runs a future to its end from there.
//! - **A record's read** takes the server's [`Shared`] and the record's arguments, and gives its
//!   value. It gets no caller: every subscriber of the same arguments shares one read and one
//!   value. The engine runs one read of a record at a time.
//! - **An action's run** takes a [`Call`], with `shared()`, `bus()`, and `caller()`, and the
//!   action's input, and gives its output. Calls run at the same time, a client's own too.
//!   `caller()` is sign-in's [`Identity`](crate::sign_in::Identity) of the connection: a
//!   browser's session or a paired device, with its `id()`.
//! - **Both fail with a [`Fault`]**, the `error` the client gets. The core's errors convert with
//!   `?` and keep their code, `refused`, `conflict`, or `hook`. A read that fails ends the
//!   record's subscriptions.
//!
//! # Saying what changed
//!
//! The [`Bus`] is `shared.get::<Bus>()`, or `call.bus()` in an action. It names a record by its
//! type and its arguments, the same a client subscribes with: they are the record's key.
//!
//! - `bus.changed::<Counter>(&args)`: the record changed. The engine reads it again, and sends
//!   each subscriber the change from the value it holds. Say it after the change is stored, and
//!   in an action, before returning.
//! - `bus.changed_all::<Counter>()`: every record of that name changed.
//! - `bus.append::<Reply>(&args, &["items", "m2", "text"], at, text)`: a text grew by `text`
//!   from `at` bytes, with no read.
//!
//! The bus can be called from any thread, as the core's watcher's, and never waits.
//!
//! # What the engine keeps
//!
//! - A record's changes are numbered, and sent at most once per 16 ms: what was said meanwhile
//!   goes as one change, of the latest value.
//! - Each connection is one task. What a client is sent is worked out when it reads, from the
//!   change it is at: one more than 1,000 changes behind gets the whole value again.
//! - A record nobody holds is not read. It is kept for a minute, with its appends, so a client
//!   that comes back with a `resume` gets only what it missed.

mod bus;
mod fault;
mod key;
mod registry;
mod socket;
mod subscription;
mod topic;

use std::sync::{Mutex, MutexGuard, PoisonError};

pub use bus::Bus;
pub use fault::Fault;
use key::Key;
pub use registry::{Call, Registry};
pub use socket::Caller;
pub(crate) use socket::serve;
pub use subscription::Connection;

use crate::http::Routes;
use crate::shared::Shared;
use crate::{Failure, records};

/// Starts the engine, provides the [`Registry`] and the [`Bus`] to the domains mounted after it,
/// and registers the records' domains.
pub(crate) fn mount(shared: &Shared, _: &mut Routes) -> Result<(), Failure> {
    let registry = Registry::default();
    let bus = Bus(bus::Engine::start(shared, registry.clone()));
    shared.provide(registry.clone());
    shared.provide(bus.clone());
    shared.on_stop("live", async move { bus.0.close() });
    records::register(shared, &registry)
}

/// Runs a future to its end from a handler, which is on a blocking thread and cannot await: a
/// queue's turn, a message to a task.
///
/// # Panics
///
/// Outside a handler: on a thread that is not the server's, or in a task.
pub fn wait<F: Future>(future: F) -> F::Output {
    tokio::runtime::Handle::current().block_on(future)
}

/// A lock, whoever panicked while holding it: the engine's state is whole between its steps.
fn locked<T>(lock: &Mutex<T>) -> MutexGuard<'_, T> {
    lock.lock().unwrap_or_else(PoisonError::into_inner)
}
