//! The record of the process groups the server's preview commands lead, in the data folder's
//! `run/previews.json`. A server that is killed stops nothing and leaves the file behind: the
//! next start on the data folder, the only server there, stops the groups it names that still
//! run. The record names processes only: a preview's base holds the frame secret, which stays in
//! memory.

use std::fs::{self, DirBuilder, OpenOptions};
use std::io::Write as _;
use std::path::PathBuf;
use std::sync::{Mutex, PoisonError};

use serde::{Deserialize, Serialize};

use crate::env::Environment;
use crate::process::{Signal, signal_group};
use crate::shared::Shared;

/// The record's file, in the data folder's `run/`.
const FILE: &str = "previews.json";

/// A group, by its leader's process id and start time, which tells the leader from a later
/// process of the same id: `{ "groups": [{ "pid": 4242, "started": "Tue Nov 10 09:00:00 2026" }] }`.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
struct Recorded {
    pid: u32,
    /// As `ps -o lstart=` prints it, in the C locale and in UTC: the server's own locale and
    /// time zone may differ from one start to the next.
    started: String,
}

/// The file: the groups a server runs.
#[derive(Default, Serialize, Deserialize)]
struct Record {
    groups: Vec<Recorded>,
}

/// The groups this server runs, written at each change, and removed when it runs none.
pub(super) struct Groups {
    file: PathBuf,
    environment: Environment,
    recorded: Mutex<Vec<Recorded>>,
}

impl Groups {
    /// The record of the server's data folder, once the groups an earlier server left running
    /// are stopped.
    pub(super) fn open(shared: &Shared) -> Groups {
        let groups = Groups {
            file: shared.data_dir().join("run").join(FILE),
            environment: shared.environment().clone(),
            recorded: Mutex::default(),
        };
        groups.stop_left();
        groups
    }

    /// Records the group led by `pid`, if it runs. It asks `ps`: call it from a blocking thread.
    pub(super) fn add(&self, pid: u32) {
        if let Some(started) = self.start_time(pid) {
            let mut recorded = self.recorded.lock().unwrap_or_else(PoisonError::into_inner);
            recorded.push(Recorded { pid, started });
            self.write(&recorded);
        }
    }

    /// Forgets the group led by `pid`, once it was stopped.
    pub(super) fn remove(&self, pid: u32) {
        let mut recorded = self.recorded.lock().unwrap_or_else(PoisonError::into_inner);
        let before = recorded.len();
        recorded.retain(|group| group.pid != pid);
        if recorded.len() != before {
            self.write(&recorded);
        }
    }

    /// Stops the groups the file names whose leader is still the process recorded, and removes
    /// the file. A leader whose id now names another process is not signalled.
    fn stop_left(&self) {
        let Ok(text) = fs::read_to_string(&self.file) else {
            return;
        };
        let left: Record = serde_json::from_str(&text).unwrap_or_default();
        for group in left.groups {
            if self.start_time(group.pid).as_ref() == Some(&group.started) {
                signal_group(group.pid, Signal::Kill);
            }
        }
        let _ = fs::remove_file(&self.file);
    }

    /// The start time of the process `pid`, as `ps` prints it: none when none runs.
    fn start_time(&self, pid: u32) -> Option<String> {
        let mut ps = self.environment.command("ps");
        ps.args(["-o", "lstart=", "-p", &pid.to_string()]);
        ps.env("LC_ALL", "C").env("TZ", "UTC");
        let output = ps.output().ok()?;
        let started = String::from_utf8(output.stdout).ok()?;
        let started = started.trim();
        (!started.is_empty()).then(|| started.to_owned())
    }

    /// Writes the record, the owner's alone, or removes it when no group runs.
    fn write(&self, recorded: &[Recorded]) {
        if recorded.is_empty() {
            let _ = fs::remove_file(&self.file);
            return;
        }
        let record = Record {
            groups: recorded.to_vec(),
        };
        if let Err(error) = self.store(&record) {
            say_err!("uraeda: {}: {error}", self.file.display());
        }
    }

    fn store(&self, record: &Record) -> std::io::Result<()> {
        let folder = self.file.parent().expect("a file of the run folder");
        let mut builder = DirBuilder::new();
        builder.recursive(true);
        let mut options = OpenOptions::new();
        options.write(true).create(true).truncate(true);
        #[cfg(unix)]
        {
            use std::os::unix::fs::{DirBuilderExt as _, OpenOptionsExt as _};
            builder.mode(0o700);
            options.mode(0o600);
        }
        builder.create(folder)?;
        let text = serde_json::to_string(record).map_err(std::io::Error::other)?;
        options.open(&self.file)?.write_all(text.as_bytes())
    }
}
