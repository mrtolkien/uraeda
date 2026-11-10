//! One repository's write queue: the turn its writes take, the commits they deferred, and the
//! thread that lands them, one after another.

use std::path::{Path, PathBuf};
use std::sync::{Arc, Condvar, Mutex, MutexGuard, PoisonError};

use uraeda_core::api::{self, ApiError};
use uraeda_protocol::{Buffer, QueuedWrite, WriteFailure, WriteQueue, WriteState};

use super::{Key, Write};
use crate::live::Bus;

/// A repository's write queue.
///
/// - **Writes run one at a time**, in the order they reached the queue, each with the commits
///   it deferred taken right after it: two writes' commits never mix.
/// - **A write waits first for the queued commits of its keys**, the files it commits: the core
///   counts a file whose commit has not landed as changed, and would not defer a second commit
///   of it.
/// - **The commits land one after another**, in order, on the queue's own thread. A refused one
///   stays in the record until dismissed, and does not stop the next.
pub(super) struct Queue {
    /// The repository's main checkout.
    path: PathBuf,
    bus: Bus,
    state: Mutex<State>,
    /// Told at each change of the state: a turn's end, a write queued, landed, or refused.
    moved: Condvar,
}

#[derive(Default)]
struct State {
    /// The writes landing, waiting, or refused, in the order they were made.
    entries: Vec<Entry>,
    /// How many writes were queued, for their ids.
    queued: u64,
    /// The turn: the ticket of the write that runs, and the next one to give.
    serving: u64,
    tickets: u64,
    /// Whether the server stops: nothing lands any more, and nothing waits.
    closed: bool,
}

/// A queued write: what the record shows of it, the keys of the writes that wait for it, and
/// the core's deferred commit it lands.
struct Entry {
    write: QueuedWrite,
    keys: Vec<Key>,
    deferred: String,
}

impl State {
    /// Whether a commit of one of `keys` is still to land: a refused one is not.
    fn pending(&self, keys: &[Key]) -> bool {
        let waits = |entry: &Entry| {
            entry.write.state != WriteState::Refused
                && entry.keys.iter().any(|key| keys.contains(key))
        };
        !self.closed && self.entries.iter().any(waits)
    }

    fn entry(&mut self, id: &str) -> Option<&mut Entry> {
        self.entries.iter_mut().find(|entry| entry.write.id == id)
    }
}

impl Queue {
    pub(super) fn new(path: &Path, bus: Bus) -> Queue {
        Queue {
            path: path.to_owned(),
            bus,
            state: Mutex::default(),
            moved: Condvar::new(),
        }
    }

    /// The repository's main checkout.
    pub(super) fn path(&self) -> &Path {
        &self.path
    }

    /// The record's value: the writes landing, waiting, or refused, in the order they were made.
    pub(super) fn writes(&self) -> WriteQueue {
        let state = self.state();
        WriteQueue {
            writes: state
                .entries
                .iter()
                .map(|entry| entry.write.clone())
                .collect(),
        }
    }

    /// Waits for the queued commits of the write's keys and for the writes before it, then
    /// holds the turn until the returned guard drops: a commit of the same keys queued meanwhile
    /// is waited for too.
    pub(super) fn turn(self: &Arc<Self>, write: Write) -> Turn {
        let mut state = self.state();
        loop {
            state = self.wait(state, |state| state.pending(&write.keys));
            let ticket = state.tickets;
            state.tickets += 1;
            state = self.wait(state, |state| state.serving != ticket);
            if !state.pending(&write.keys) {
                break;
            }
            // A write before this one queued a commit of its keys: its turn goes to the next.
            state.serving += 1;
            self.moved.notify_all();
        }
        drop(state);
        Turn {
            queue: self.clone(),
            write: Some(write),
        }
    }

    /// Removes a refused write from the record: one still landing stays.
    pub(super) fn dismiss(&self, id: &str) {
        let mut state = self.state();
        let refused =
            |entry: &Entry| entry.write.id == id && entry.write.state == WriteState::Refused;
        let before = state.entries.len();
        state.entries.retain(|entry| !refused(entry));
        let removed = state.entries.len() != before;
        drop(state);
        if removed {
            self.bus.changed_all::<WriteQueue>();
        }
    }

    /// Lands the queued commits, one after another, in order, until the queue closes: the
    /// queue's own thread runs it.
    pub(super) fn land(&self) {
        while let Some((id, deferred)) = self.next() {
            self.bus.changed_all::<WriteQueue>();
            let landed = api::land(&self.path, &deferred, |line| self.printed(&id, line));
            self.settle(&id, landed.err());
        }
    }

    /// Stops the queue: the commit that runs ends, none starts after it, and nothing waits.
    pub(super) fn close(&self) {
        self.state().closed = true;
        self.moved.notify_all();
    }

    /// Ends a write's turn: the commits it deferred are queued under its name, in order, and
    /// the next write runs.
    fn end(&self, write: &Write) {
        let taken = api::take_deferred(&self.path);
        let queued = !taken.is_empty();
        let mut state = self.state();
        for deferred in taken {
            state.queued += 1;
            let id = format!("write-{}", state.queued);
            state.entries.push(Entry {
                write: write.queued(id, deferred.subject),
                keys: write.keys.clone(),
                deferred: deferred.id,
            });
        }
        state.serving += 1;
        drop(state);
        self.moved.notify_all();
        // A buffer shows any file a write changed, whichever domain wrote it.
        self.bus.changed_all::<Buffer>();
        if queued {
            self.bus.changed_all::<WriteQueue>();
        }
    }

    /// The next commit to land, now running: it waits for one, and gives none once closed.
    fn next(&self) -> Option<(String, String)> {
        let waiting = |entry: &Entry| entry.write.state == WriteState::Waiting;
        let idle = |state: &State| !state.closed && !state.entries.iter().any(waiting);
        let mut state = self.wait(self.state(), idle);
        if state.closed {
            return None;
        }
        let entry = state.entries.iter_mut().find(|entry| waiting(entry))?;
        entry.write.state = WriteState::Running;
        Some((entry.write.id.clone(), entry.deferred.clone()))
    }

    /// Adds a line git or a hook printed to a running write's output.
    fn printed(&self, id: &str, line: &str) {
        if let Some(entry) = self.state().entry(id) {
            let output = entry.write.output.get_or_insert_default();
            if !output.is_empty() {
                output.push('\n');
            }
            output.push_str(line);
        }
        self.bus.changed_all::<WriteQueue>();
    }

    /// Takes a landed write out of the record, or keeps a refused one in it, with why.
    fn settle(&self, id: &str, refusal: Option<ApiError>) {
        let mut state = self.state();
        match refusal {
            None => state.entries.retain(|entry| entry.write.id != id),
            Some(refusal) => {
                if let Some(entry) = state.entry(id) {
                    entry.write.state = WriteState::Refused;
                    entry.write.failure = Some(failure(&refusal));
                    entry.write.output = Some(reason(refusal));
                }
                // A hook's refusal put the write's files back.
                self.bus.changed_all::<Buffer>();
            }
        }
        drop(state);
        self.moved.notify_all();
        self.bus.changed_all::<WriteQueue>();
    }

    fn state(&self) -> MutexGuard<'_, State> {
        self.state.lock().unwrap_or_else(PoisonError::into_inner)
    }

    /// Waits while `busy` holds, woken at each change of the state.
    fn wait<'a>(
        &self,
        state: MutexGuard<'a, State>,
        busy: impl Fn(&State) -> bool,
    ) -> MutexGuard<'a, State> {
        let waited = self.moved.wait_while(state, |state| busy(state));
        waited.unwrap_or_else(PoisonError::into_inner)
    }
}

/// A write's turn: while it is held, no other write of the repository runs. Dropping it queues
/// the commits the write deferred, even when the write failed after deferring one.
pub(super) struct Turn {
    queue: Arc<Queue>,
    write: Option<Write>,
}

impl Drop for Turn {
    fn drop(&mut self) {
        if let Some(write) = self.write.take() {
            self.queue.end(&write);
        }
    }
}

/// Why a landing failed: only a hook's refusal, which the core undid, is `hook`.
fn failure(refusal: &ApiError) -> WriteFailure {
    match refusal.code {
        "hook" => WriteFailure::Hook,
        _ => WriteFailure::Failed,
    }
}

/// A refusal's whole message: what failed, then what git and the hooks printed.
fn reason(refusal: ApiError) -> String {
    match refusal.output.filter(|output| !output.is_empty()) {
        Some(output) => format!("{}\n\n{output}", refusal.message),
        None => refusal.message,
    }
}
