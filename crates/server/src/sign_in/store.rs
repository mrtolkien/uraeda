//! The access key, the sessions, and the paired devices, in `sign-in.json` in the data folder: the
//! only place they are kept, and only as hashes. One server owns a data folder, so the file is
//! read once, as the server starts, and written at each change.

use std::collections::HashMap;
use std::fs::{self, DirBuilder, OpenOptions};
use std::io::{ErrorKind, Write as _};
use std::os::unix::fs::{DirBuilderExt as _, OpenOptionsExt as _};
use std::path::{Path, PathBuf};
use std::sync::{Mutex, MutexGuard, PoisonError};
use std::time::{Duration, SystemTime};

use serde::{Deserialize, Serialize};
use serde_json::Value;
use tokio::sync::watch;

use crate::secret::{self, Hashed};
use crate::sign_in::date;
use crate::sign_in::listeners::{Change, Listeners};

/// The sign-in file's name, in the data folder.
const FILE: &str = "sign-in.json";

/// The version of the file this server writes, and the only one it reads.
const VERSION: u64 = 1;

/// How long a session or a device may go unused before it ends: 30 days.
pub(crate) const UNUSED: Duration = Duration::from_secs(30 * 24 * 60 * 60);

/// How often a use is recorded: once a day, so the file is not written at every request.
const RECORDED: Duration = Duration::from_secs(24 * 60 * 60);

/// What signs in: a browser's session, with its cookie, or a paired device, with its token.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Kind {
    /// A browser that signed in with the access key or a one-time link.
    Session,
    /// A device that paired with a one-time code.
    Device,
}

/// Why the sign-in file could not be read or written, with what the owner can do.
#[derive(Clone, Debug, thiserror::Error)]
#[error("{0}")]
pub struct Problem(String);

/// A session or a device, as the file holds it: its public id, its secret's hash, and when it
/// was made and last used. A device has a name.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub(crate) struct Signed {
    pub(crate) id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) name: Option<String>,
    secret: Hashed,
    #[serde(with = "date")]
    pub(crate) created: SystemTime,
    #[serde(with = "date")]
    pub(crate) used: SystemTime,
}

/// The sign-in file, as written.
#[derive(Serialize, Deserialize)]
struct Stored {
    version: u64,
    /// None until a key is asked for: one is made only where a person sees it.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    key: Option<Hashed>,
    sessions: Vec<Signed>,
    #[serde(default)]
    devices: Vec<Signed>,
}

impl Stored {
    /// The sessions, or the devices.
    fn of(&mut self, kind: Kind) -> &mut Vec<Signed> {
        match kind {
            Kind::Session => &mut self.sessions,
            Kind::Device => &mut self.devices,
        }
    }

    /// Every session, then every device, each with its kind.
    fn all(&mut self) -> impl Iterator<Item = (Kind, &mut Signed)> {
        let sessions = self
            .sessions
            .iter_mut()
            .map(|signed| (Kind::Session, signed));
        let devices = self.devices.iter_mut().map(|signed| (Kind::Device, signed));
        sessions.chain(devices)
    }

    /// Takes out the sessions and the devices that `ends` picks: what the change they make is.
    fn end(&mut self, mut ends: impl FnMut(Kind, &Signed) -> bool) -> Change {
        let mut change = Change::default();
        for kind in [Kind::Session, Kind::Device] {
            let (ended, kept) = std::mem::take(self.of(kind))
                .into_iter()
                .partition::<Vec<_>, _>(|signed| ends(kind, signed));
            *self.of(kind) = kept;
            change.devices |= kind == Kind::Device && !ended.is_empty();
            change
                .ended
                .extend(ended.into_iter().map(|signed| signed.id));
        }
        change.write = !change.ended.is_empty();
        change
    }
}

/// What the store holds: the file as last written, and the signal of each sign-in that was asked
/// for, which says when it ends.
struct State {
    stored: Stored,
    signals: HashMap<String, watch::Sender<bool>>,
}

/// A sign-in the store found, and whether its use was just recorded, the first in a day.
pub(crate) struct Found {
    pub(crate) kind: Kind,
    pub(crate) id: String,
    /// False until the sign-in ends.
    pub(crate) ended: watch::Receiver<bool>,
    pub(crate) recorded: bool,
}

/// The sign-in file of a data folder, and what was read from it.
pub(crate) struct Store {
    path: PathBuf,
    state: Mutex<State>,
    pub(crate) listeners: Listeners,
}

impl Store {
    /// Opens the store of a data folder. At the first start the file does not exist: it is
    /// written with no access key, which is made only once someone asks to see it.
    ///
    /// # Errors
    ///
    /// For a file that cannot be read, or that this version did not write, which is left as it
    /// is, and for a folder the new file cannot be written to.
    pub(crate) fn open(data_dir: &Path) -> Result<Store, Problem> {
        let path = data_dir.join(FILE);
        let (stored, first) = match fs::read_to_string(&path) {
            Ok(text) => (
                parse(&text).map_err(|reason| unreadable(&path, &reason))?,
                false,
            ),
            Err(error) if error.kind() == ErrorKind::NotFound => (Stored::new(), true),
            Err(error) => return Err(unreadable(&path, &error.to_string())),
        };
        let state = State {
            stored,
            signals: HashMap::new(),
        };
        let store = Store {
            path,
            state: Mutex::new(state),
            listeners: Listeners::default(),
        };
        if first {
            let made = DirBuilder::new()
                .recursive(true)
                .mode(0o700)
                .create(data_dir);
            made.map_err(|error| store.unwritable(&error))?;
            store.write(&store.state().stored)?;
        }
        Ok(store)
    }

    /// Whether a text is the access key, the blanks and line breaks around it ignored.
    pub(crate) fn is_key(&self, text: &str) -> bool {
        let state = self.state();
        state
            .stored
            .key
            .as_ref()
            .is_some_and(|key| key.is(text.trim()))
    }

    /// Makes the access key when there is none yet, and returns it, the only time it is shown:
    /// nothing ends, as no one signed in with a key. `None` when there is one already.
    pub(crate) fn first_key(&self) -> Result<Option<String>, Problem> {
        let key = new_key();
        let (made, written) = self.change(|state| {
            let made = state.stored.key.is_none();
            if made {
                state.stored.key = Some(Hashed::of(&key));
            }
            let change = Change {
                write: made,
                ..Change::default()
            };
            (made, change)
        });
        if written.is_err() && made {
            self.state().stored.key = None;
        }
        written.map(|()| made.then_some(key))
    }

    /// Makes a new access key and returns it, the only time it is shown: every session and every
    /// device ends. When the file cannot be written, they end all the same, and the key stays
    /// the one the owner has: a key nobody was shown would lock them out.
    pub(crate) fn replace_key(&self) -> Result<String, Problem> {
        let key = new_key();
        let (old, written) = self.change(|state| {
            let old = state.stored.key.replace(Hashed::of(&key));
            let mut change = state.stored.end(|_, _| true);
            change.write = true;
            (old, change)
        });
        if written.is_err() {
            self.state().stored.key = old;
        }
        written.map(|()| key)
    }

    /// Makes a session or a device, and returns what signs it in, `<id>.<secret>`, which is
    /// never stored: a cookie's value, or a device's token.
    pub(crate) fn add(
        &self,
        kind: Kind,
        name: Option<String>,
        now: SystemTime,
    ) -> Result<String, Problem> {
        let (id, secret) = (secret::random(16), secret::random(32));
        let signed = Signed {
            id: id.clone(),
            name,
            secret: Hashed::of(&secret),
            created: now,
            used: now,
        };
        let written = self.change(|state| {
            state.stored.of(kind).push(signed);
            ((), Change::written(kind))
        });
        written.1.map(|()| format!("{id}.{secret}"))
    }

    /// The session or the device that `<id>.<secret>` signs in, unless the secret is wrong or it
    /// has ended: one unused for more than 30 days ends now. Its use is recorded once a day at
    /// most.
    pub(crate) fn find(&self, kind: Kind, sign_in: &str, now: SystemTime) -> Option<Found> {
        let (id, secret) = sign_in.split_once('.')?;
        let (found, written) = self.change(|state| {
            let known = state
                .stored
                .of(kind)
                .iter_mut()
                .find(|signed| signed.id == id);
            let Some(signed) = known.filter(|signed| signed.secret.is(secret)) else {
                return (None, Change::default());
            };
            let unused = now.duration_since(signed.used).unwrap_or_default();
            if unused > UNUSED {
                return (
                    None,
                    state.stored.end(|of, signed| of == kind && signed.id == id),
                );
            }
            let recorded = unused >= RECORDED;
            if recorded {
                signed.used = now;
            }
            let found = Found {
                kind,
                id: id.to_owned(),
                ended: state.signal(id),
                recorded,
            };
            let change = if recorded {
                Change::written(kind)
            } else {
                Change::default()
            };
            (Some(found), change)
        });
        if let Err(problem) = written {
            // The sign-in holds for this run of the server: only its last use is not kept.
            eprintln!("uraeda: {problem}");
        }
        found
    }

    /// Ends a session or a device, by its id: signed out, or revoked, and its connections
    /// close. Whether there was one.
    pub(crate) fn end(&self, kind: Kind, id: &str) -> Result<bool, Problem> {
        let (ended, written) = self.change(|state| {
            let change = state.stored.end(|of, signed| of == kind && signed.id == id);
            (change.write, change)
        });
        written.map(|()| ended)
    }

    /// Ends every session and every device.
    pub(crate) fn end_all(&self) -> Result<(), Problem> {
        self.change(|state| ((), state.stored.end(|_, _| true))).1
    }

    /// Ends every session and every device unused for more than 30 days. One with a connection
    /// open is in use: its use is recorded instead.
    pub(crate) fn sweep(&self, now: SystemTime) -> Result<(), Problem> {
        let written = self.change(|state| {
            let State { stored, signals } = state;
            let connected = |id: &str| {
                signals
                    .get(id)
                    .is_some_and(|signal| signal.receiver_count() > 0)
            };
            let mut recorded = Change::default();
            for (kind, signed) in stored.all() {
                let unused = now.duration_since(signed.used).unwrap_or_default();
                if unused >= RECORDED && connected(&signed.id) {
                    signed.used = now;
                    recorded.merge(Change::written(kind));
                }
            }
            let unused = |signed: &Signed| now.duration_since(signed.used).unwrap_or_default();
            recorded.merge(stored.end(|_, signed| unused(signed) > UNUSED));
            ((), recorded)
        });
        written.1
    }

    /// The paired devices, the oldest pairing first.
    pub(crate) fn devices(&self) -> Vec<Signed> {
        self.state().stored.devices.clone()
    }

    /// Renames a device. Whether there is one of that id.
    pub(crate) fn rename(&self, id: &str, name: &str) -> Result<bool, Problem> {
        let (renamed, written) = self.change(|state| {
            let device = state
                .stored
                .devices
                .iter_mut()
                .find(|device| device.id == id);
            let Some(device) = device else {
                return (false, Change::default());
            };
            device.name = Some(name.to_owned());
            (true, Change::written(Kind::Device))
        });
        written.map(|()| renamed)
    }

    /// Runs a change on what the store holds, writes the file when it asks, ends the signals of
    /// what ended, then tells the listeners. What ended ends even when the write fails.
    fn change<T>(
        &self,
        change: impl FnOnce(&mut State) -> (T, Change),
    ) -> (T, Result<(), Problem>) {
        let mut state = self.state();
        let (value, change) = change(&mut state);
        let written = if change.write {
            self.write(&state.stored)
        } else {
            Ok(())
        };
        for id in &change.ended {
            if let Some(signal) = state.signals.remove(id) {
                signal.send_replace(true);
            }
        }
        drop(state);
        self.listeners.tell(&change);
        (value, written)
    }

    /// What the store holds: a writer that panicked left it whole.
    fn state(&self) -> MutexGuard<'_, State> {
        self.state.lock().unwrap_or_else(PoisonError::into_inner)
    }

    /// Writes the file, readable by its owner only, to a temporary file renamed over it, so a
    /// crash never leaves half a file.
    fn write(&self, stored: &Stored) -> Result<(), Problem> {
        let text = serde_json::to_string_pretty(stored).expect("the sign-in file is JSON");
        let name = format!("{FILE}.{}.tmp", secret::random(6));
        let temporary = self.path.with_file_name(name);
        let mut options = OpenOptions::new();
        let file = options.write(true).create_new(true).mode(0o600);
        let written = file
            .open(&temporary)
            .and_then(|mut file| file.write_all(format!("{text}\n").as_bytes()))
            .and_then(|()| fs::rename(&temporary, &self.path));
        written.map_err(|error| {
            // Nothing is left behind: the file is as it was.
            let _ = fs::remove_file(&temporary);
            self.unwritable(&error)
        })
    }

    /// The problem of a file that cannot be written.
    fn unwritable(&self, error: &std::io::Error) -> Problem {
        Problem(format!("cannot write {}: {error}", self.path.display()))
    }
}

impl State {
    /// The signal of a session or a device: false until it ends.
    fn signal(&mut self, id: &str) -> watch::Receiver<bool> {
        let signals = &mut self.signals;
        let signal = signals.entry(id.to_owned());
        signal
            .or_insert_with(|| watch::Sender::new(false))
            .subscribe()
    }
}

impl Stored {
    /// A new file, with no key yet.
    fn new() -> Stored {
        Stored {
            version: VERSION,
            key: None,
            sessions: Vec::new(),
            devices: Vec::new(),
        }
    }
}

/// A new access key: `ura_` and 32 random bytes in base64url.
fn new_key() -> String {
    format!("ura_{}", secret::random(32))
}

/// The file's content, or the reason it is not one this version of Uraeda wrote: one written by a
/// newer Uraeda is refused rather than read wrong.
fn parse(text: &str) -> Result<Stored, String> {
    let file: Value = serde_json::from_str(text).map_err(|error| error.to_string())?;
    match file.get("version") {
        Some(version) if version.as_u64() == Some(VERSION) => {}
        Some(version) => return Err(format!("version {version} is not {VERSION}")),
        None => return Err("it has no version".to_owned()),
    }
    serde_json::from_value(file).map_err(|error| error.to_string())
}

/// The problem of a file that cannot be read, with what the owner can do.
fn unreadable(path: &Path, reason: &str) -> Problem {
    let path = path.display();
    let fix = "Fix it, or delete it to make a new access key and sign every device out.";
    Problem(format!("cannot read {path}: {reason}. {fix}"))
}
