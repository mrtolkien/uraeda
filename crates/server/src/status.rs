//! The status file, `run/server.json` in the data folder: where the server of that folder
//! listens, and the host token. It lives while the server runs. A second `ura serve` and the app
//! find the running server there, and prove with the token that they are the host's own: only the
//! data folder's user can read it.

use std::fs::{self, DirBuilder, File, OpenOptions, TryLockError};
use std::io::{self, Write as _};
use std::os::unix::fs::{DirBuilderExt as _, OpenOptionsExt as _};
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::secret;

/// The file's name, in the data folder's `run/`, where the files that live while a server runs go.
pub const FILE: &str = "server.json";

/// A running server, as its status file tells it.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Status {
    /// The server's process.
    pub pid: u32,
    /// The port it listens on, on 127.0.0.1.
    pub port: u16,
    /// The host token: what a request of the host's own `ura` or app carries, as
    /// `Authorization: Bearer <token>`.
    pub token: String,
}

/// The lock file, in the data folder's `run/`: the server that runs on the folder holds an
/// advisory lock on it, from before it reads the status file until it stops, or its process ends.
pub const LOCK: &str = "server.lock";

/// The data folder's lock, when no other process holds it: `None` when one does. Held as long as
/// the file returned is open.
///
/// # Errors
///
/// When the data folder cannot take the file, or the lock cannot be asked for.
pub fn lock(data_dir: &Path) -> io::Result<Option<File>> {
    let path = data_dir.join("run").join(LOCK);
    DirBuilder::new()
        .recursive(true)
        .mode(0o700)
        .create(path.parent().expect("a file of run/"))?;
    let file = OpenOptions::new()
        .write(true)
        .create(true)
        .truncate(false)
        .mode(0o600)
        .open(&path)?;
    match file.try_lock() {
        Ok(()) => Ok(Some(file)),
        Err(TryLockError::WouldBlock) => Ok(None),
        Err(TryLockError::Error(error)) => Err(error),
    }
}

/// The status file of a data folder.
pub fn path(data_dir: &Path) -> PathBuf {
    data_dir.join("run").join(FILE)
}

/// Writes the status of this process's server on `port`, with a new host token of 32 random
/// bytes, readable by its owner only, replacing one a killed server left.
///
/// # Errors
///
/// When the data folder cannot take the file.
pub fn write(data_dir: &Path, port: u16) -> io::Result<Status> {
    let status = Status {
        pid: std::process::id(),
        port,
        token: secret::random(32),
    };
    let path = path(data_dir);
    let folder = path.parent().expect("a file of run/");
    DirBuilder::new()
        .recursive(true)
        .mode(0o700)
        .create(folder)?;
    // Removed first: a file left behind keeps its mode, which writing it again would not change.
    remove(data_dir);
    let mut file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .mode(0o600)
        .open(&path)?;
    file.write_all(&serde_json::to_vec(&status)?)?;
    Ok(status)
}

/// The status a server wrote in `data_dir`: none when there is no file, or it cannot be read. A
/// killed server leaves its file: whoever reads one asks the server before believing it.
pub fn read(data_dir: &Path) -> Option<Status> {
    serde_json::from_str(&fs::read_to_string(path(data_dir)).ok()?).ok()
}

/// The server that runs on `data_dir`: the status its file holds, when its process is alive. A
/// file a killed server left names a process that is gone. A process that took a dead server's id
/// since reads as running: the way out is to remove the file.
pub fn running(data_dir: &Path) -> Option<Status> {
    read(data_dir).filter(|status| alive(status.pid))
}

/// Whether the process `pid` exists, whoever owns it.
#[cfg(unix)]
fn alive(pid: u32) -> bool {
    let Ok(pid) = libc::pid_t::try_from(pid) else {
        return false;
    };
    // SAFETY: `kill` takes no pointer; the signal 0 checks the process, and sends nothing.
    let sent = unsafe { libc::kill(pid, 0) };
    pid > 0 && (sent == 0 || io::Error::last_os_error().raw_os_error() == Some(libc::EPERM))
}

/// Without unix, a status file is believed.
#[cfg(not(unix))]
fn alive(_pid: u32) -> bool {
    true
}

/// Removes the status file, as the server stops.
pub fn remove(data_dir: &Path) {
    // A file that is not there is removed already.
    let _ = fs::remove_file(path(data_dir));
}
