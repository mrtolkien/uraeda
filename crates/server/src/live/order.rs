//! The order of one connection's calls. Each call runs on a thread of its own, so two calls sent
//! back to back could reach the write queue in either order. A connection's calls therefore
//! start one after another: each once the call before it took its place in what orders it, the
//! write queue, or ended. From there they run at the same time.
//!
//! What orders calls says so with [`placed`], on the handler's thread, as the write queue does
//! when a write takes its ticket. An action that never does lets the next call start as it ends.

use std::cell::RefCell;

use tokio::sync::oneshot::{Receiver, Sender, channel};

thread_local! {
    /// What lets the next call of the connection start, while this thread runs a call that has
    /// not taken its place yet.
    static PLACE: RefCell<Option<Sender<()>>> = const { RefCell::new(None) };
}

/// The order of a connection's calls: what the latest one lets go of once it is placed.
#[derive(Default)]
pub(super) struct Order {
    latest: Option<Receiver<()>>,
}

impl Order {
    /// The place of the connection's next call: what it waits for before it starts, and what
    /// it gives up once placed.
    pub(super) fn next(&mut self) -> (Before, Place) {
        let (place, placed) = channel();
        (Before(self.latest.replace(placed)), Place(place))
    }
}

/// The call before, until it is placed or ended.
pub(super) struct Before(Option<Receiver<()>>);

impl Before {
    /// Waits until the call before took its place, or ended: at once for a connection's first.
    pub(super) async fn placed(self) {
        if let Some(before) = self.0 {
            // An error is the call before ended without a word: this one may start.
            let _ = before.await;
        }
    }
}

/// A call's place to take.
pub(super) struct Place(Sender<()>);

impl Place {
    /// Runs a call's handler on this thread: until it says [`placed`], or ends, the next call
    /// of its connection waits.
    pub(super) fn run<T>(self, handler: impl FnOnce() -> T) -> T {
        PLACE.set(Some(self.0));
        let _ended = Ended;
        handler()
    }
}

/// Lets the next call go when a handler ends, however it ends.
struct Ended;

impl Drop for Ended {
    fn drop(&mut self) {
        placed();
    }
}

/// Says the call this thread runs took its place among the calls that must keep an order, as a
/// write in its repository's queue: the next call of its connection may start. It does nothing
/// on a thread that runs no call, or whose call is placed already.
pub(crate) fn placed() {
    drop(PLACE.take());
}
