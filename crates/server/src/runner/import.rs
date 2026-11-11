//! The one-time import of the Node server's sessions, `runner.sqlite`, into the store: what
//! `ura import-sessions` runs.
//!
//! TEMPORARY: removed with the Node server, once the port is done (task 61).
//!
//! - **Never under a running server**: a server that runs on the new data folder holds its
//!   sessions in memory, runs their turns, and times their jobs; replacing its store under it
//!   would mix an imported transcript into a live turn. The import is refused until it stops.
//! - **The old store is only read**: it is opened read-only, and never written.
//! - **All or nothing**: the sessions, their turns, and their logs land in one transaction. The
//!   images are copied inside it, and removed again when it fails, its commit included.
//! - **Once**: a store that already holds sessions is refused, unless told to replace them: it
//!   is then emptied and filled again in the same transaction.
//! - **Nothing imported runs by itself**: the Node server may still run, and would run it too.
//!   A turn that ran or waited there is stopped here, a turn that server's stop cut, which its
//!   next start may continue, reads stopped for [`IMPORTED`], and a continue that waited for its
//!   time is dropped. A message continues such a run, as any stopped one.
//! - **Ids are kept**: a session's, a turn's, a message's, a tool call's. An event's place in
//!   its log is new: an item is one to three events, see [`lines`].

mod lines;
mod old;

use std::collections::BTreeSet;
use std::fs;
use std::io;
use std::os::unix::fs::DirBuilderExt as _;
use std::path::{Path, PathBuf};
use std::time::SystemTime;

use rusqlite::Transaction;

use self::lines::Line;
use self::old::Old;
use super::event::Event;
use super::log;
use super::session;
use super::store::{Store, StoreError, millis, time};
use super::turn::{self, Turn, TurnState};
use crate::files::chat_images::{FOLDER, is_id};
use crate::status;

/// Why a turn the Node server ran, queued, or cut as it stopped is stopped in the store.
pub const IMPORTED: &str =
    "Stopped: it ran in the earlier server, and nothing imported continues by itself.";

/// The Node server's reason for a turn its stop cut, which its next start continues.
const CUT: &str = "Stopped: the server stopped while it ran.";

/// The Node server's store, in its data folder.
const OLD_FILE: &str = "runner.sqlite";

/// Whether the import empties a store that already holds sessions.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Replace {
    /// A store that holds sessions is refused.
    No,
    /// Its sessions are removed, and the old store's are imported in their place.
    Yes,
}

/// What an import did.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct Imported {
    pub sessions: u64,
    pub turns: u64,
    /// The events of every turn's log.
    pub events: u64,
    /// The items of the old store that could not be read, and were left out.
    pub unread: u64,
    /// The turns the old server ran, queued, or cut as it stopped, stopped in the new one.
    pub stopped: u64,
    /// The continues that waited for their time in the old store, dropped.
    pub continues: u64,
    /// The chat images copied to the new data folder.
    pub images: u64,
    /// The scheduled jobs' runs, each time a job started, skipped, or failed to start.
    pub job_runs: u64,
}

/// Why nothing was imported.
#[derive(Debug, thiserror::Error)]
pub enum ImportError {
    #[error("{} holds no {OLD_FILE}: there are no sessions to import", folder.display())]
    Missing { folder: PathBuf },
    #[error(
        "{} is at schema {found}, and this import reads schema {}: \
         start the Node server of this version once on its folder, then import again",
        path.display(),
        old::SCHEMA
    )]
    Schema { path: PathBuf, found: u32 },
    #[error(
        "a server runs on {} (process {pid}): stop it first, then import again",
        folder.display()
    )]
    Running { folder: PathBuf, pid: u32 },
    #[error("the store already holds {sessions} sessions: nothing was imported")]
    Holds { sessions: u64 },
    #[error("{} could not be read: {source}", path.display())]
    Old {
        path: PathBuf,
        source: rusqlite::Error,
    },
    #[error("the image {} could not be copied: {source}", path.display())]
    Image { path: PathBuf, source: io::Error },
    #[error(transparent)]
    Store(#[from] StoreError),
}

/// Imports every session of the Node server's data folder `from` into the store, with the chat
/// images their messages hold. `now` ends a turn that ran with nothing to date it.
///
/// # Errors
///
/// [`ImportError`], and nothing is imported: a server runs on the new store's data folder, the
/// folder has no store, its store is at another schema or cannot be read, or the new store
/// holds sessions and `replace` is `No`.
pub fn import(
    from: &Path,
    store: &Store,
    now: SystemTime,
    replace: Replace,
) -> Result<Imported, ImportError> {
    if let Some(running) = status::running(store.data_dir()) {
        let folder = store.data_dir().to_owned();
        return Err(ImportError::Running {
            folder,
            pid: running.pid,
        });
    }
    let path = from.join(OLD_FILE);
    if !path.is_file() {
        let folder = from.to_owned();
        return Err(ImportError::Missing { folder });
    }
    let unread = |source| ImportError::Old {
        path: path.clone(),
        source,
    };
    let old = Old::open(&path).map_err(unread)?;
    let found = old.schema().map_err(unread)?;
    if found != old::SCHEMA {
        return Err(ImportError::Schema { path, found });
    }
    let now = millis(now);
    let mut copied = Vec::new();
    let imported = store.write(|new| {
        make_room(new, replace)?;
        let mut imported = Imported::default();
        for session in old.sessions().map_err(unread)? {
            session::insert(new, &session).map_err(StoreError::from)?;
            imported.sessions += 1;
        }
        let mut images = BTreeSet::new();
        for mut turn in old.turns().map_err(unread)? {
            let (lines, left_out) = lines::of(old.items(turn.id, now).map_err(unread)?);
            settle(&mut turn, &lines, now, &mut imported);
            write_turn(new, &turn, &lines)?;
            images.extend(sent_images(&lines));
            imported.turns += 1;
            imported.events += lines.len() as u64;
            imported.unread += left_out;
        }
        copy_images(from, store.data_dir(), &images, &mut copied)?;
        imported.images = copied.len() as u64;
        imported.job_runs = old
            .copy_job_runs(new)
            .map_err(unread)?
            .map_err(StoreError::from)?;
        Ok(imported)
    });
    // The transaction rolled back, or its commit failed: the images it copied go too.
    if imported.is_err() {
        copied.iter().for_each(|image| drop(fs::remove_file(image)));
    }
    imported
}

/// Refuses a store that holds sessions, or empties it when told to.
fn make_room(new: &Transaction, replace: Replace) -> Result<(), ImportError> {
    let sessions = held(new)?;
    if sessions > 0 && replace == Replace::No {
        return Err(ImportError::Holds { sessions });
    }
    Ok(emptied(new)?)
}

/// How many sessions the store holds.
fn held(new: &Transaction) -> Result<u64, StoreError> {
    Ok(new.query_row("SELECT COUNT(*) FROM sessions", [], |row| row.get(0))?)
}

/// Removes every session, with its turns and their logs.
fn emptied(new: &Transaction) -> Result<(), StoreError> {
    Ok(new.execute_batch(
        "DELETE FROM job_runs; DELETE FROM events; DELETE FROM turns; DELETE FROM sessions;",
    )?)
}

/// Makes a turn one that nothing runs or continues here: the Node server may still do both.
///
/// - One that ran or waited is stopped, at the latest of its events and its start, else now.
/// - One the Node server's stop cut, with no continue decided and not dismissed, is the one a
///   server continues as it starts: it reads stopped for the import instead.
/// - A continue that waited is dropped, with its reason: the run reads as failed or stopped.
fn settle(turn: &mut Turn, lines: &[Line], now: i64, imported: &mut Imported) {
    let live = matches!(turn.state, TurnState::Running | TurnState::Queued);
    let cut = turn.state == TurnState::Stopped
        && turn.reason.as_deref() == Some(CUT)
        && turn.continue_reason.is_none()
        && turn.dismissed_at.is_none();
    if live {
        let last = lines.iter().map(|line| line.at).max();
        let started = turn.started_at.map(millis);
        turn.state = TurnState::Stopped;
        turn.ended_at = Some(time(last.max(started).unwrap_or(now)));
    }
    if live || cut {
        turn.reason = Some(IMPORTED.to_owned());
        imported.stopped += 1;
    }
    if turn.continue_at.take().is_some() {
        turn.continue_reason = None;
        imported.continues += 1;
    }
}

/// Writes a turn under its id, then its log.
fn write_turn(new: &Transaction, turn: &Turn, lines: &[Line]) -> Result<(), StoreError> {
    turn::insert(new, turn, Some(turn.id))?;
    for line in lines {
        log::add(new, turn.id, line.at, &line.event)?;
    }
    Ok(())
}

/// The chat images the messages of a log hold, by their names.
fn sent_images(lines: &[Line]) -> impl Iterator<Item = String> {
    let images = lines.iter().filter_map(|line| match &line.event {
        Event::Message { images, .. } => Some(images),
        _ => None,
    });
    images.flatten().map(|image| image.id.clone())
}

/// Copies the chat images the imported messages hold from the old data folder to the new one,
/// each copy's path added to `copied` as it is made: one already there, or gone from the old
/// folder, is not copied.
fn copy_images(
    from: &Path,
    to: &Path,
    images: &BTreeSet<String>,
    copied: &mut Vec<PathBuf>,
) -> Result<(), ImportError> {
    let (from, to) = (from.join(FOLDER), to.join(FOLDER));
    // An id names a file of the images' folder, and nothing outside it.
    for image in images.iter().filter(|image| is_id(image)) {
        let (source, target) = (from.join(image), to.join(image));
        if !source.is_file() || target.exists() {
            continue;
        }
        let made = fs::DirBuilder::new()
            .recursive(true)
            .mode(0o700)
            .create(&to);
        let made = made.and_then(|()| fs::copy(&source, &target));
        // A copy cut short leaves part of a file: it goes too.
        copied.push(target);
        made.map_err(|error| ImportError::Image {
            path: source,
            source: error,
        })?;
    }
    Ok(())
}
