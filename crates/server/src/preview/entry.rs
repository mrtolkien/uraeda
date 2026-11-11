//! One checkout's preview in the runner, from its first view until it is stopped: what it was
//! started for, and what changes while it lives.

use std::collections::HashMap;
use std::sync::{Arc, Mutex, MutexGuard, PoisonError};
use std::time::SystemTime;

use tokio::sync::watch;

use super::command::Run;
use super::runner::{Checkout, State};
use super::warm::Compiles;

/// One checkout's preview, from its first view until it is stopped.
pub(super) struct Entry {
    pub(super) checkout: Checkout,
    /// The `read` stamp it started at: only a version read after it can move it.
    pub(super) stamp: u64,
    /// When it started: the 2 minutes count from it, across the port's retry.
    pub(super) started: SystemTime,
    pub(super) live: Mutex<Live>,
    /// Told once the entry is stopped: its task ends.
    pub(super) stopped: watch::Sender<bool>,
}

/// What changes while an entry lives.
pub(super) struct Live {
    pub(super) state: State,
    pub(super) last_view: SystemTime,
    pub(super) run: Option<Arc<Run>>,
    /// Its stories' compiles, once it is ready.
    pub(super) compiles: Option<Arc<Compiles>>,
}

impl Entry {
    pub(super) fn live(&self) -> MutexGuard<'_, Live> {
        self.live.lock().unwrap_or_else(PoisonError::into_inner)
    }

    /// Whether the entry's preview is at another code version than `now`'s, or runs another
    /// preview command or folder, which its decision under `specs/` sets without moving the
    /// version. One whose first version read failed is at an unknown version, which any known
    /// one is another than. A read begun before the preview started cannot say it moved: it may
    /// be the older of two views racing a move.
    pub(super) fn moved(&self, now: &Checkout) -> bool {
        let Checkout {
            command,
            folder,
            version,
            ..
        } = &self.checkout;
        let other = (now.version.is_some() && now.version != *version)
            || now.command != *command
            || now.folder != *folder;
        other && now.read > self.stamp
    }
}

/// Whether the entry is the one its base has now.
pub(super) fn held(entries: &HashMap<String, Arc<Entry>>, entry: &Arc<Entry>) -> bool {
    let current = entries.get(&entry.checkout.base);
    current.is_some_and(|current| Arc::ptr_eq(current, entry))
}
