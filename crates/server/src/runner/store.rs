//! `sessions.sqlite`, the sessions' store: the file, its one connection, and its transactions.
//! What it holds is beside this file: [sessions](super::session), [turns](super::turn), and each
//! turn's [log](super::log).

use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, PoisonError};
use std::time::{Duration, SystemTime};

use rusqlite::{Connection, Transaction, TransactionBehavior};

use super::schema;

/// The store's file, in the server's data folder.
pub const FILE: &str = "sessions.sqlite";

/// How long a statement waits for another connection's lock.
const BUSY: Duration = Duration::from_secs(5);

/// Why the store could not be opened, read, or written.
#[derive(Debug, thiserror::Error)]
pub enum StoreError {
    /// A later version wrote the file: this one neither reads nor changes it.
    #[error(
        "{} was written by a newer Uraeda (schema {found}, this one reads {known}): it is left as it is",
        path.display()
    )]
    Newer {
        path: PathBuf,
        found: u32,
        known: u32,
    },
    /// The store closed with its server.
    #[error("the session store is closed: its server stopped")]
    Closed,
    #[error("the session store could not be read or written: {0}")]
    Sqlite(#[from] rusqlite::Error),
    #[error("the session store holds an event that cannot be read: {0}")]
    Event(#[from] serde_json::Error),
    #[error("{}: {source}", path.display())]
    File { path: PathBuf, source: io::Error },
}

/// The sessions, their turns, and the turns' logs, in SQLite: the only code that opens
/// `sessions.sqlite`. One server at a time owns the data folder, so one connection writes it.
///
/// Every method takes the time it writes as an argument, the server's `shared.now()`: the store
/// has no clock.
pub struct Store {
    folder: PathBuf,
    /// The one connection, none once the store closed.
    db: Mutex<Option<Connection>>,
}

impl Store {
    /// Opens the store of a data folder, making the folder and the file when missing, and brings
    /// an earlier schema up to this version's.
    ///
    /// # Errors
    ///
    /// [`StoreError::Newer`] for a file a later version wrote, which is left untouched, and any
    /// other error for a file that is not a store or cannot be opened: it is never replaced.
    pub fn open(data_dir: &Path) -> Result<Store, StoreError> {
        let path = data_dir.join(FILE);
        fs::create_dir_all(data_dir).map_err(|source| StoreError::File {
            path: data_dir.to_owned(),
            source,
        })?;
        let mut db = Connection::open(&path)?;
        db.busy_timeout(BUSY)?;
        // Before anything is written, the journal's mode included: a newer file keeps its bytes.
        let (found, known) = (schema::found(&db)?, schema::known());
        if found > known {
            return Err(StoreError::Newer { path, found, known });
        }
        db.pragma_update_and_check(None, "journal_mode", "WAL", |_| Ok(()))?;
        // With a write-ahead log, a commit is safe from a crash of the server without a sync.
        db.pragma_update(None, "synchronous", "NORMAL")?;
        db.pragma_update(None, "foreign_keys", true)?;
        if found < known {
            schema::migrate(&mut db)?;
        }
        Ok(Store {
            folder: data_dir.to_owned(),
            db: Mutex::new(Some(db)),
        })
    }

    /// The data folder the store is in.
    pub fn data_dir(&self) -> &Path {
        &self.folder
    }

    /// Closes the file, as the server stops: every later call fails with [`StoreError::Closed`].
    pub fn close(&self) {
        // Dropped here: SQLite folds the write-ahead log into the file, and removes it.
        self.db
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
            .take();
    }

    /// Reads with the connection.
    pub(super) fn read<T>(
        &self,
        work: impl FnOnce(&Connection) -> Result<T, StoreError>,
    ) -> Result<T, StoreError> {
        let db = self.db.lock().unwrap_or_else(PoisonError::into_inner);
        work(db.as_ref().ok_or(StoreError::Closed)?)
    }

    /// Writes in one transaction: all of `work`, or nothing when it fails.
    pub(super) fn write<T, E: From<StoreError>>(
        &self,
        work: impl FnOnce(&Transaction) -> Result<T, E>,
    ) -> Result<T, E> {
        let mut db = self.db.lock().unwrap_or_else(PoisonError::into_inner);
        let db = db.as_mut().ok_or(StoreError::Closed)?;
        let transaction = db
            .transaction_with_behavior(TransactionBehavior::Immediate)
            .map_err(StoreError::from)?;
        let done = work(&transaction)?;
        transaction.commit().map_err(StoreError::from)?;
        Ok(done)
    }
}

/// A time as the store keeps it: the milliseconds since 1970, 0 for a time before.
pub(super) fn millis(time: SystemTime) -> i64 {
    let since = time.duration_since(SystemTime::UNIX_EPOCH);
    since.map_or(0, |since| {
        i64::try_from(since.as_millis()).unwrap_or(i64::MAX)
    })
}

/// The time the store keeps as milliseconds since 1970.
pub(super) fn time(millis: i64) -> SystemTime {
    SystemTime::UNIX_EPOCH + Duration::from_millis(u64::try_from(millis).unwrap_or_default())
}
