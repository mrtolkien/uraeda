//! The write queue, for the whole server: every write to a repository goes through [`write`],
//! which gives it its turn, and lands the commits it deferred behind it, in order. The record
//! `WriteQueue` shows them, and `writes.dismiss` takes a refused one out.
//!
//! ```ignore
//! // A save: it commits nothing, and waits for its turn only.
//! write(call.shared(), &input.repo, Write::saving(), |repo| {
//!     Ok(api::save_text(repo, &input.path, &input.text, &input.hash)?)
//! })
//! // A commit of a feature's file, named in the record as the client asked.
//! let write = Write::of_feature(&input.folder).file(&input.file).named(input.write);
//! write(call.shared(), &input.repo, write, |repo| {
//!     Ok(api::retry_commit(repo, &input.folder, &input.file)?)
//! })
//! ```
//!
//! The core defers the commits of a repository whose queue is open: a committing call writes
//! its files and returns, so its action answers at once, and the commit runs here, with the
//! hooks. A hook's refusal puts the files back, and stays in the record until dismissed.

mod repository;

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, PoisonError};
use std::thread::JoinHandle;

use uraeda_core::api;
use uraeda_protocol::{QueuedWrite, WriteName, WriteQueue, WriteState, WritesDismiss};

use repository::Queue;

use crate::live::{Bus, Fault, Registry};
use crate::shared::Shared;

/// What a committing write commits, which the next commit of the same waits for.
#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) enum Key {
    /// A feature's or a change's files, by its folder.
    Feature(String),
    /// The default branch's lists: the inbox, the priorities, their rounds, and the proposal
    /// files, whose commits take each other's files along.
    Lists,
}

/// A write to a repository, as the queue takes it: what it commits, and how the record names
/// the commits it defers.
#[derive(Default)]
pub(crate) struct Write {
    keys: Vec<Key>,
    name: Option<WriteName>,
    folder: Option<String>,
    file: Option<String>,
}

impl Write {
    /// A write that saves files and commits nothing: it waits for its turn only.
    pub(crate) fn saving() -> Write {
        Write::default()
    }

    /// A write that commits files of a feature or a change: it waits for that folder's queued
    /// commits first.
    pub(crate) fn of_feature(folder: &str) -> Write {
        Write {
            keys: vec![Key::Feature(folder.to_owned())],
            folder: Some(folder.to_owned()),
            ..Write::default()
        }
    }

    /// A write that commits files of the default branch's lists: it waits for their queued
    /// commits first.
    pub(crate) fn of_lists() -> Write {
        Write {
            keys: vec![Key::Lists],
            ..Write::default()
        }
    }

    /// The file the write concerns, as the record shows it.
    pub(crate) fn file(mut self, file: &str) -> Write {
        self.file = Some(file.to_owned());
        self
    }

    /// What the client names the write with: without it, each commit shows its subject.
    pub(crate) fn named(mut self, name: Option<WriteName>) -> Write {
        self.name = name;
        self
    }

    /// One of the write's commits as the record shows it, waiting: `subject` names it when the
    /// client did not.
    fn queued(&self, id: String, subject: String) -> QueuedWrite {
        let (label, href) = match &self.name {
            Some(name) => (name.label.clone(), name.href.clone()),
            None => (subject, String::new()),
        };
        QueuedWrite {
            id,
            label,
            href,
            folder: self.folder.clone(),
            file: self.file.clone(),
            state: WriteState::Waiting,
            failure: None,
            output: None,
        }
    }
}

/// Runs a write to the repository listed as `repository`, in its turn: after the writes that
/// reached the queue before it, and after the queued commits of what it commits. `run` is given
/// the repository's main checkout, and calls the core. The commits it deferred land behind it,
/// one after another, even when it fails after deferring one: `write` answers once the files
/// are written.
///
/// # Errors
///
/// `refused` for a repository the list does not hold, and whatever `run` fails with.
pub(crate) fn write<T>(
    shared: &Shared,
    repository: &str,
    write: Write,
    run: impl FnOnce(&Path) -> Result<T, Fault>,
) -> Result<T, Fault> {
    let path = super::repository(shared, repository)?;
    let queue = shared.get::<Queues>().open(shared, &path);
    let _turn = queue.turn(write);
    run(&path)
}

/// The queue of each repository written to since the server started, by its main checkout.
#[derive(Default)]
struct Queues(Mutex<HashMap<PathBuf, Open>>);

/// An open queue, and the thread that lands its commits.
struct Open {
    queue: Arc<Queue>,
    landing: JoinHandle<()>,
}

impl Queues {
    /// A repository's queue, opened at its first write: the core defers its commits from then
    /// on, and a thread of the queue's own lands them.
    fn open(&self, shared: &Shared, path: &Path) -> Arc<Queue> {
        let mut queues = self.0.lock().unwrap_or_else(PoisonError::into_inner);
        if let Some(open) = queues.get(path) {
            return open.queue.clone();
        }
        let queue = Arc::new(Queue::new(path, Bus::clone(&shared.get::<Bus>())));
        api::defer_commits(path, true);
        let lander = queue.clone();
        let landing = std::thread::spawn(move || lander.land());
        let open = Open {
            queue: queue.clone(),
            landing,
        };
        queues.insert(path.to_owned(), open);
        queue
    }

    /// A repository's queue, when a write opened it.
    fn found(&self, path: &Path) -> Option<Arc<Queue>> {
        let queues = self.0.lock().unwrap_or_else(PoisonError::into_inner);
        queues.get(path).map(|open| open.queue.clone())
    }

    /// Stops every queue as the server stops: the commit that runs ends, and the core defers
    /// no commit any more. The ones not landed are forgotten, their files left written.
    fn close(&self) {
        let queues = std::mem::take(&mut *self.0.lock().unwrap_or_else(PoisonError::into_inner));
        for Open { queue, landing } in queues.into_values() {
            queue.close();
            let _ = landing.join();
            api::defer_commits(queue.path(), false);
        }
    }
}

/// Provides the queues, stops them with the server, and registers the record `WriteQueue` and
/// the action `writes.dismiss`.
pub(super) fn register(shared: &Shared, registry: &Registry) {
    shared.provide(Queues::default());
    let stopping = shared.clone();
    shared.on_stop("write queues", async move {
        let closing = tokio::task::spawn_blocking(move || stopping.get::<Queues>().close());
        let _ = closing.await;
    });
    registry.record::<WriteQueue>(|shared, args| {
        let path = super::repository(shared, &args.repo)?;
        let queue = shared.get::<Queues>().found(&path);
        Ok(queue.map(|queue| queue.writes()).unwrap_or_default())
    });
    registry.action::<WritesDismiss>(|call, input| {
        let path = super::repository(call.shared(), &input.repo)?;
        if let Some(queue) = call.shared().get::<Queues>().found(&path) {
            queue.dismiss(&input.id);
        }
        Ok(())
    });
}
