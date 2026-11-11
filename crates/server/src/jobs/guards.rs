//! What a start shares, and the guards it reads: the job and repository whose start is
//! reserved, the jobs an acceptance holds busy, whether a run's session works, and why a time is
//! skipped. The scheduler's queue, a run by hand, and the record's next run read them, so each
//! decides on the same state.

use std::collections::{HashMap, HashSet};
use std::path::Path;

use uraeda_core::api;
use uraeda_protocol::SessionStatus;

use super::{Key, Scheduler};
use crate::live::locked;
use crate::runner::{Runner, Store};
use crate::shared::Shared;

/// The starts reserved, by job and repository name, and the jobs an acceptance holds busy, by
/// job and main checkout: a change being opened is the job's run still working, though its
/// session is in no folder yet and its agent does not work.
#[derive(Default)]
pub(crate) struct Starts {
    reserved: HashSet<Key>,
    busy: HashMap<Key, u32>,
}

impl Starts {
    /// Reserves the start of a job in a repository: false when it is reserved already.
    pub(crate) fn reserve(&mut self, key: &Key) -> bool {
        self.reserved.insert(key.clone())
    }

    pub(crate) fn release(&mut self, key: &Key) {
        self.reserved.remove(key);
    }

    /// Holds a job busy in a main checkout, until [`Starts::leave`].
    pub(crate) fn enter(&mut self, key: Key) {
        *self.busy.entry(key).or_default() += 1;
    }

    pub(crate) fn leave(&mut self, key: &Key) {
        if let Some(count) = self.busy.get_mut(key) {
            *count -= 1;
            if *count == 0 {
                self.busy.remove(key);
            }
        }
    }

    /// Whether no acceptance holds a job busy.
    pub(crate) fn is_idle(&self) -> bool {
        self.busy.is_empty()
    }

    pub(crate) fn is_busy(&self, key: &Key) -> bool {
        self.busy.contains_key(key)
    }
}

/// A reservation of a start, released as it is dropped.
pub(crate) struct Reserved<'a> {
    scheduler: &'a Scheduler,
    key: Key,
}

impl Reserved<'_> {
    /// Reserves the start of a job in a repository by name: none when it is reserved already.
    pub(crate) fn take(scheduler: &Scheduler, key: Key) -> Option<Reserved<'_>> {
        let taken = locked(&scheduler.starts).reserve(&key);
        taken.then_some(Reserved { scheduler, key })
    }
}

impl Drop for Reserved<'_> {
    fn drop(&mut self) {
        locked(&self.scheduler.starts).release(&self.key);
    }
}

/// Whether the session's agent works, or waits to go on by itself: a turn runs or is queued,
/// its run waits to continue, or its process waits for a wakeup the agent set. A chat's status
/// reads no wakeup, so it is read here. The scheduler and the acceptance both read it.
pub(crate) fn works(runner: &Runner, session: &str) -> bool {
    let Ok(Some(row)) = runner.store().session(session) else {
        return false;
    };
    if runner.session_working(session) || runner.wakeup(session) {
        return true;
    }
    let Ok(turns) = runner.turns_of(session) else {
        return false;
    };
    let read = runner.status_of(&row, &turns, None, false);
    read.status.status == SessionStatus::Working
}

/// The changes and features of the workspace, read once: the folders not merged yet, and every
/// folder's title.
pub(crate) struct Changes {
    pub open: HashSet<String>,
    pub titles: HashMap<String, String>,
}

/// What the workspace of a main checkout says of its changes.
pub(crate) fn open_changes(root: &str) -> Changes {
    let features = api::read_workspace(Path::new(root)).map(|read| read.features);
    let features = features.unwrap_or_default();
    let open = features.iter().filter(|feature| {
        let step = feature.step.name.as_str();
        step != "done" && step != "none"
    });
    Changes {
        open: open.map(|feature| feature.folder.clone()).collect(),
        titles: features
            .iter()
            .map(|feature| (feature.folder.clone(), feature.title.clone()))
            .collect(),
    }
}

/// The folders of the job's runs, and the workspace's open ones, read together before a start.
pub(crate) struct Read {
    folders: Vec<String>,
    open: HashSet<String>,
}

/// The workspace's open changes, when a run of the job started a change to look at: the one read
/// a skip needs, which is slow, so a start makes it first, before what it must decide on.
pub(crate) fn read_for(store: &Store, job: &str, root: &str) -> Option<Read> {
    let folders = store.job_change_folders(job, root).unwrap_or_default();
    (!folders.is_empty()).then(|| Read {
        open: open_changes(root).open,
        folders,
    })
}

/// Why a time is skipped, with the open change that blocked it.
#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) enum Skip {
    Working,
    ChangeOpen(String),
}

impl Skip {
    pub(crate) fn reason(&self) -> &'static str {
        match self {
            Skip::Working => "working",
            Skip::ChangeOpen(_) => "change-open",
        }
    }
}

/// Why the job's time is skipped in a main checkout, with the workspace's read given: its last
/// run works, an acceptance is opening its change, or a change one of its runs started is open.
/// A folder the runs name that the read did not, or all of them without a read, counts as open:
/// a change an offer opened meanwhile is not in the read, and a time is skipped rather than run
/// beside a change.
pub(crate) fn skip_now(
    shared: &Shared,
    job: &str,
    root: &str,
    read: Option<&Read>,
) -> Option<Skip> {
    let runner = Runner::find(shared)?;
    let store = runner.store();
    let key = (job.to_owned(), root.to_owned());
    let busy = locked(&shared.get::<Scheduler>().starts).is_busy(&key);
    let last = store.job_latest_started(job, root).ok().flatten();
    let last = last.and_then(|run| run.session);
    if busy || last.is_some_and(|session| works(&runner, &session)) {
        return Some(Skip::Working);
    }
    let folders = store.job_change_folders(job, root).unwrap_or_default();
    let open = |folder: &&String| {
        read.is_none_or(|read| read.open.contains(*folder) || !read.folders.contains(folder))
    };
    folders.iter().find(open).cloned().map(Skip::ChangeOpen)
}
