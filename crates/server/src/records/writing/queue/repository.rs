//! One repository's write queue: the turn its writes take, the commits they deferred, and the
//! thread that lands them, one after another.

use std::panic::{AssertUnwindSafe, catch_unwind};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Condvar, Mutex, MutexGuard, PoisonError};

use uraeda_core::api::{self, ApiError};
use uraeda_protocol::{ErrorCode, QueuedWrite, StartStep, WriteFailure, WriteQueue, WriteState};

use super::{Key, Write};
use crate::live::{self, Bus, Fault};
use crate::records;

/// What lands a write of its own, on the queue's thread: it is given the write as it lands.
pub(super) type Land = Box<dyn FnOnce(&Landing<'_>) -> Landed + Send>;

/// A write of its own, once it ran.
pub(super) struct Landed {
    /// Why it was refused, if it was.
    pub refusal: Option<Fault>,
    /// Answers whoever waits for it: called once the record and the bus were told, so a read
    /// made after the answer finds what the write changed.
    pub answer: Box<dyn FnOnce() + Send>,
}

/// How a queued write lands.
enum Work {
    /// A commit the core deferred, by its id.
    Deferred(String),
    /// A write of its own, as a git write or a start: none once it runs.
    Own(Option<Land>),
}

/// A repository's write queue.
///
/// - **Writes run one at a time**, in the order they reached the queue, each with the commits
///   it deferred taken right after it: two writes' commits never mix. A write takes a ticket as
///   it arrives, and a connection's calls arrive in the order it sent them
///   ([`live::placed`](crate::live::placed)), so they run in that order.
/// - **A write waits for the queued commits of its keys**, the files it commits: the core counts
///   a file whose commit has not landed as changed, and would not defer a second commit of it.
///   Meanwhile the turn goes to the writes behind it that wait for none.
/// - **The queued writes land one after another**, in order, on the queue's own thread: a commit
///   the core deferred, or a write of its own, as a git write. A refused one stays in the record
///   until dismissed, and does not stop the next.
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
    /// How many writes the record shows were queued, for their ids, and how many it does not
    /// show.
    queued: u64,
    unseen: u64,
    /// The turn: whether a write runs, the next ticket to give, and the writes that wait for
    /// the turn, each with its ticket and its keys.
    running: bool,
    tickets: u64,
    waiting: Vec<(u64, Vec<Key>)>,
    /// Whether the server stops: nothing lands any more, and nothing waits.
    closed: bool,
}

/// A queued write: what the record shows of it, the keys of the writes that wait for it, how
/// it lands, the write it was queued by, which names the commits its landing defers, and the
/// name its repository's records are told under.
struct Entry {
    write: QueuedWrite,
    keys: Vec<Key>,
    work: Work,
    by: Write,
    repository: String,
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

    /// Whether the write of this ticket takes the turn now: none runs, and it has the first
    /// ticket among the waiting writes whose keys have no commit to land.
    fn goes(&self, ticket: u64) -> bool {
        let free = self.waiting.iter().filter(|(_, keys)| !self.pending(keys));
        let first = free.map(|(ticket, _)| *ticket).min();
        !self.running && first == Some(ticket)
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
    /// One that lands unseen, as the server's own fetch, is not in it.
    pub(super) fn writes(&self) -> WriteQueue {
        let state = self.state();
        let seen = state.entries.iter().filter(|entry| entry.by.seen);
        WriteQueue {
            writes: seen.map(|entry| entry.write.clone()).collect(),
        }
    }

    /// Queues a write of its own, landed by `land` on the queue's thread, after the writes
    /// queued before it: its id in the record. The writes of its keys wait for it.
    pub(super) fn add(&self, repository: &str, by: Write, land: Land) -> String {
        let mut state = self.state();
        // A write the record never shows takes no number of the ones it does.
        let id = if by.seen {
            state.queued += 1;
            format!("write-{}", state.queued)
        } else {
            state.unseen += 1;
            format!("unseen-{}", state.unseen)
        };
        let label = by.label.clone().unwrap_or_default();
        let write = QueuedWrite {
            steps: by.steps.clone(),
            ..by.queued(id.clone(), label)
        };
        state.entries.push(Entry {
            write,
            keys: by.keys.clone(),
            work: Work::Own(Some(land)),
            by,
            repository: repository.to_owned(),
        });
        drop(state);
        self.moved.notify_all();
        self.changed();
        // Its place is taken: the next call of its connection may come.
        live::placed();
        id
    }

    /// Waits for the queued commits of the write's keys and for the writes before it, then
    /// holds the turn until the returned guard drops: a commit of the same keys queued meanwhile
    /// is waited for too.
    pub(super) fn turn(self: &Arc<Self>, repository: &str, write: Write) -> Turn {
        self.take(&write.keys);
        Turn {
            queue: self.clone(),
            repository: repository.to_owned(),
            write: Some(write),
        }
    }

    /// Takes a ticket, which is the write's place among the writes that wait, then the turn
    /// once it is this ticket's.
    fn take(&self, keys: &[Key]) {
        let mut state = self.state();
        let ticket = state.tickets;
        state.tickets += 1;
        state.waiting.push((ticket, keys.to_vec()));
        // Its place is taken: the next call of its connection may come.
        live::placed();
        state = self.wait(state, |state| !state.goes(ticket));
        state.waiting.retain(|(waiting, _)| *waiting != ticket);
        state.running = true;
    }

    /// The turn of a write of its own as it lands: after the writes that wait, waiting for no
    /// queued commit, its own included. The commits it defers are queued under its name.
    fn landing_turn(self: &Arc<Self>, repository: &str, by: Write) -> Turn {
        self.take(&[]);
        Turn {
            queue: self.clone(),
            repository: repository.to_owned(),
            write: Some(by),
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
            self.changed();
        }
    }

    /// Lands the queued writes, one after another, in order, until the queue closes: the
    /// queue's own thread runs it.
    pub(super) fn land(self: &Arc<Self>) {
        while let Some(next) = self.next() {
            self.changed();
            let id = &next.id;
            let refusal = match next.work {
                Work::Deferred(deferred) => {
                    let landed = api::land(&self.path, &deferred, |line| self.printed(id, line));
                    landed.err().map(Refusal::of_commit)
                }
                Work::Own(land) => {
                    let turn = self.landing_turn(&next.repository, next.by);
                    let landing = Landing { queue: self, id };
                    // A landing that panics is refused: the thread goes on with the next.
                    let run = || land.map(|land| land(&landing));
                    // A landing that panics is refused, and whoever waits for it is answered
                    // as its answer is dropped: the thread goes on with the next.
                    let landed = catch_unwind(AssertUnwindSafe(run));
                    let panicked = || Fault::internal("the write panicked as it landed");
                    let (refusal, answer) = match landed {
                        Ok(Some(landed)) => (landed.refusal, Some(landed.answer)),
                        Ok(None) => (None, None),
                        Err(_) => (Some(panicked()), None),
                    };
                    drop(turn);
                    self.settle(id, refusal.map(Refusal::of_fault));
                    answer.into_iter().for_each(|answer| answer());
                    continue;
                }
            };
            self.settle(id, refusal);
        }
    }

    /// Stops the queue: the write that runs ends, none starts after it, and nothing waits. The
    /// writes of their own not landed are dropped, which answers whoever waits for one.
    pub(super) fn close(&self) {
        let mut state = self.state();
        state.closed = true;
        let waiting = |entry: &Entry| entry.write.state == WriteState::Waiting;
        state.entries.retain(|entry| !waiting(entry));
        drop(state);
        self.moved.notify_all();
    }

    /// Lets the writes of the lists stop waiting for a write still landing: a start whose commit
    /// landed lets them go while it makes its branch.
    fn free_lists(&self, id: &str) {
        if let Some(entry) = self.state().entry(id) {
            entry.keys.retain(|key| *key != Key::Lists);
        }
        self.moved.notify_all();
    }

    /// Replaces a start's steps in the record.
    fn set_steps(&self, id: &str, steps: Vec<StartStep>) {
        if let Some(entry) = self.state().entry(id) {
            entry.write.steps = Some(steps);
        }
        self.changed();
    }

    /// Says the record changed.
    fn changed(&self) {
        self.bus.changed_all::<WriteQueue>();
    }

    /// Ends a write's turn: the commits it deferred are queued under its name, in order, the
    /// next write runs, and the repository's records are read again.
    fn end(&self, repository: &str, write: &Write) {
        let taken = api::take_deferred(&self.path);
        let queued = !taken.is_empty();
        let mut state = self.state();
        for deferred in taken {
            state.queued += 1;
            let id = format!("write-{}", state.queued);
            state.entries.push(Entry {
                write: write.queued(id, deferred.subject),
                keys: write.keys.clone(),
                work: Work::Deferred(deferred.id),
                by: write.clone(),
                repository: repository.to_owned(),
            });
        }
        state.running = false;
        drop(state);
        self.moved.notify_all();
        records::written(&self.bus, repository);
        if queued {
            self.changed();
        }
    }

    /// The next write to land, now running: it waits for one, and gives none once closed.
    fn next(&self) -> Option<Next> {
        let waiting = |entry: &Entry| entry.write.state == WriteState::Waiting;
        let idle = |state: &State| !state.closed && !state.entries.iter().any(waiting);
        let mut state = self.wait(self.state(), idle);
        if state.closed {
            return None;
        }
        let entry = state.entries.iter_mut().find(|entry| waiting(entry))?;
        entry.write.state = WriteState::Running;
        let work = match &mut entry.work {
            Work::Deferred(deferred) => Work::Deferred(deferred.clone()),
            Work::Own(land) => Work::Own(land.take()),
        };
        Some(Next {
            id: entry.write.id.clone(),
            work,
            by: entry.by.clone(),
            repository: entry.repository.clone(),
        })
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
        self.changed();
    }

    /// Takes a landed write out of the record, or keeps a refused one in it, with why: one that
    /// lands unseen leaves either way. Its repository's records are read again: a commit moved
    /// a step and the Git page, and a hook's refusal put the write's files back.
    fn settle(&self, id: &str, refusal: Option<Refusal>) {
        let mut state = self.state();
        let repository = state.entry(id).map(|entry| entry.repository.clone());
        let unseen = state.entry(id).is_some_and(|entry| !entry.by.seen);
        match refusal.filter(|_| !unseen) {
            None => state.entries.retain(|entry| entry.write.id != id),
            Some(refusal) => {
                if let Some(entry) = state.entry(id) {
                    entry.write.state = WriteState::Refused;
                    entry.write.failure = Some(refusal.failure);
                    entry.write.output = Some(refusal.output);
                }
            }
        }
        drop(state);
        self.moved.notify_all();
        self.changed();
        if let Some(repository) = repository {
            records::written(&self.bus, &repository);
        }
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
    /// The repository's name in the list, which its records are told under.
    repository: String,
    write: Option<Write>,
}

impl Drop for Turn {
    fn drop(&mut self) {
        if let Some(write) = self.write.take() {
            self.queue.end(&self.repository, &write);
        }
    }
}

/// The next write to land.
struct Next {
    id: String,
    work: Work,
    by: Write,
    repository: String,
}

/// A write of its own, as it lands: what its landing says of it in the record.
pub(crate) struct Landing<'a> {
    queue: &'a Queue,
    id: &'a str,
}

impl Landing<'_> {
    /// The repository's main checkout.
    pub(crate) fn path(&self) -> &Path {
        &self.queue.path
    }

    /// Adds a line git or a hook printed to the write's output.
    pub(crate) fn printed(&self, line: &str) {
        self.queue.printed(self.id, line);
    }

    /// Shows a start's steps as they are now.
    pub(crate) fn steps(&self, steps: Vec<StartStep>) {
        self.queue.set_steps(self.id, steps);
    }

    /// Lets the lists' writes stop waiting for this one, which goes on: a start whose commit
    /// landed, as it makes its branch.
    pub(crate) fn free_lists(&self) {
        self.queue.free_lists(self.id);
    }
}

/// Why a write did not land, as the record keeps it.
struct Refusal {
    failure: WriteFailure,
    output: String,
}

impl Refusal {
    /// A deferred commit's: only a hook's refusal, which the core undid, is `hook`. Its output
    /// is what failed, then what git and the hooks printed.
    fn of_commit(refusal: ApiError) -> Refusal {
        let failure = match refusal.code {
            "hook" => WriteFailure::Hook,
            _ => WriteFailure::Failed,
        };
        let output = match refusal.output.filter(|output| !output.is_empty()) {
            Some(output) => format!("{}\n\n{output}", refusal.message),
            None => refusal.message,
        };
        Refusal { failure, output }
    }

    /// A write of its own's: its fault, whose message is a hook's output for a hook's refusal.
    fn of_fault(fault: Fault) -> Refusal {
        let failure = match fault.code() {
            ErrorCode::Hook => WriteFailure::Hook,
            _ => WriteFailure::Failed,
        };
        Refusal {
            failure,
            output: fault.message().to_owned(),
        }
    }
}
