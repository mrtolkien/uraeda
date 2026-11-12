//! The app's way to the server of its data folder: it finds the one that runs, through its status
//! file, `run/server.json`, or starts `ura serve` and waits until it answers. The app owns a server
//! it started, one at a time, and stops it when it closes; it never stops one it found running.
//!
//! The status file is the server's (`crates/server/src/status.rs`): its port, its process, and the
//! host token that proves a request is the owner's own, which only the data folder's user reads.
//! A server killed leaves its file behind, so the app asks the server before it believes it.

use std::ffi::OsString;
use std::fs::{self, OpenOptions};
use std::os::unix::fs::DirBuilderExt as _;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, ExitStatus, Stdio};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Mutex, MutexGuard, PoisonError};
use std::time::{Duration, Instant};

use serde::Deserialize;

/// How long the app waits for a server it started to answer: its first start reads every
/// repository and builds the extensions' pages.
pub const START: Duration = Duration::from_secs(60);

/// How long a stopped server has to end before it is killed.
pub const STOP: Duration = Duration::from_secs(10);

/// How long a server has to answer the app's question, "do you run?".
const ASK: Duration = Duration::from_secs(2);

/// How the app reaches its own machine's server.
#[derive(Clone, Debug)]
pub struct LocalOptions {
    /// `ura`, which serves.
    pub ura: PathBuf,
    /// The data folder, which one server at a time owns.
    pub data_dir: PathBuf,
    /// The port a server the app starts listens on: `ura serve`'s own, 4320, unless given.
    pub port: Option<u16>,
    /// The folder a server the app starts runs in: its repository joins the list, as with
    /// `ura serve` run there.
    pub folder: PathBuf,
    /// Variables a server the app starts gets beside the app's own.
    pub environment: Vec<(OsString, OsString)>,
    /// How long a call waits for a server the app started to answer: [`START`], but in tests.
    pub start_wait: Duration,
    /// How long a stopped server has to end before it is killed: [`STOP`], but in tests.
    pub stop_wait: Duration,
}

/// A server of the data folder that answers.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Running {
    /// Where it listens: `http://127.0.0.1:4320`.
    pub address: String,
    /// Its process.
    pub pid: u32,
    /// The app started it, and stops it when it closes.
    pub owned: bool,
    /// The host token of its status file.
    pub token: String,
}

/// The status file, as the server writes it.
#[derive(Deserialize)]
struct Status {
    pid: u32,
    port: u16,
    token: String,
}

/// What a start answers once the app closes.
const CLOSING: &str = "The app is closing: it starts no server.";

/// How often a start asks its server whether it answers, and a stop whether it ended.
const LOOK: Duration = Duration::from_millis(20);

/// The server the app started.
#[derive(Debug)]
struct Owned {
    child: Child,
    /// It answered once: its end is then a server that stopped while the app is open, which the
    /// app starts again, and no longer a start that failed.
    answered: bool,
}

/// What the app has of a server of its own.
enum Own {
    /// None, or one that ended after it had answered, forgotten.
    None,
    /// It runs, whether it answers or not: its process.
    Runs(u32),
    /// It ended before it ever answered, and how.
    Failed(Option<ExitStatus>),
}

/// The server of one data folder, as the app sees it: the process it started, if any.
///
/// The app owns at most one server at a time. The one it started stays its own while it runs,
/// whether it answers or not: a call waits for it, and none starts another before that one
/// ended and was reaped. The lock guards the handle alone, taken to read or to swap it: a wait,
/// for an answer or for an end, is never held under it, so a close and a question go through
/// while a start waits.
#[derive(Debug)]
pub struct Local {
    options: LocalOptions,
    started: Mutex<Option<Owned>>,
    /// The app closes: it starts no server any more, as a late call of its window would, and a
    /// start that waits gives up.
    closing: AtomicBool,
    /// Where the log of the app's last start begins: its failure shows those lines alone, never
    /// an earlier start's.
    logged_from: AtomicU64,
}

impl Local {
    pub fn new(options: LocalOptions) -> Local {
        Local {
            options,
            started: Mutex::new(None),
            closing: AtomicBool::new(false),
            logged_from: AtomicU64::new(0),
        }
    }

    /// The data folder.
    pub fn data_dir(&self) -> &Path {
        &self.options.data_dir
    }

    /// The server that runs, found or started, once it answers. A server the app started that
    /// does not answer yet is waited for, by this call and by the next: none replaces it.
    ///
    /// # Errors
    ///
    /// When `ura` cannot start, its server stops before it answers, or says nothing within the
    /// start's wait, a minute: the words say why, with the end of its log. And once the app
    /// closes.
    pub fn ensure(&self) -> Result<Running, String> {
        let begun = Instant::now();
        loop {
            let own = self.owned();
            if let Some(running) = self.found(&own) {
                return Ok(running);
            }
            if self.closing.load(Ordering::SeqCst) {
                return Err(CLOSING.to_owned());
            }
            match own {
                Own::Runs(_) => {}
                Own::None => self.start_one()?,
                Own::Failed(status) => {
                    let how = status.map(|status| format!(" ({status})"));
                    let how = how.unwrap_or_default();
                    return Err(self.failed(&format!("Uraeda's server stopped as it started{how}")));
                }
            }
            if begun.elapsed() > self.options.start_wait {
                let waited = self.options.start_wait.as_secs();
                return Err(self.failed(&format!(
                    "Uraeda's server did not answer within {waited} s. It still runs: trying \
                     again waits for it, and closing the app stops it"
                )));
            }
            std::thread::sleep(LOOK);
        }
    }

    /// The server that runs now, if one answers: none is started.
    pub fn running(&self) -> Option<Running> {
        self.found(&self.owned())
    }

    /// Stops the server the app started, if it still runs, and starts none after: the app closes.
    /// A start that waits for it gives up. A server found running is left.
    pub fn stop(&self) {
        // Before the handle is taken: a start that finds none then knows why, and starts none.
        self.closing.store(true, Ordering::SeqCst);
        let Some(Owned { mut child, .. }) = self.started().take() else {
            return;
        };
        if !matches!(child.try_wait(), Ok(None)) {
            return;
        }
        let pid = libc::pid_t::try_from(child.id()).unwrap_or(0);
        // SAFETY: a signal to the process this app started and has not reaped yet.
        unsafe { libc::kill(pid, libc::SIGTERM) };
        let asked = Instant::now();
        while asked.elapsed() < self.options.stop_wait {
            if !matches!(child.try_wait(), Ok(None)) {
                return;
            }
            std::thread::sleep(LOOK);
        }
        let _ = child.kill();
        let _ = child.wait();
    }

    fn started(&self) -> MutexGuard<'_, Option<Owned>> {
        self.started.lock().unwrap_or_else(PoisonError::into_inner)
    }

    /// What the app has of a server of its own, now. One that ended is reaped and forgotten,
    /// here alone.
    fn owned(&self) -> Own {
        let mut started = self.started();
        let Some(owned) = started.as_mut() else {
            return Own::None;
        };
        match owned.child.try_wait() {
            Ok(None) => Own::Runs(owned.child.id()),
            ended => {
                let answered = owned.answered;
                *started = None;
                match answered {
                    true => Own::None,
                    false => Own::Failed(ended.ok().flatten()),
                }
            }
        }
    }

    /// The server that answers, if one does: the app's own is then known to have answered.
    fn found(&self, own: &Own) -> Option<Running> {
        let owned = match own {
            Own::Runs(pid) => Some(*pid),
            Own::None | Own::Failed(_) => None,
        };
        let running = self.answering(owned)?;
        if running.owned
            && let Some(owned) = self.started().as_mut()
            && owned.child.id() == running.pid
        {
            owned.answered = true;
        }
        Some(running)
    }

    /// Starts `ura serve`, unless the app has a server of its own since, started by another
    /// call, or closes.
    fn start_one(&self) -> Result<(), String> {
        let mut started = self.started();
        // Under the lock a close takes the handle under: a close that came first is seen here,
        // and one that comes after finds what is started.
        if self.closing.load(Ordering::SeqCst) {
            return Err(CLOSING.to_owned());
        }
        if started.is_none() {
            let child = self.start()?;
            let answered = false;
            *started = Some(Owned { child, answered });
        }
        Ok(())
    }

    /// The server of the status file, when it answers; `owned` is the process the app started.
    fn answering(&self, owned: Option<u32>) -> Option<Running> {
        let path = self.options.data_dir.join("run").join("server.json");
        let status: Status = serde_json::from_str(&fs::read_to_string(path).ok()?).ok()?;
        let address = format!("http://127.0.0.1:{}", status.port);
        answers(&address).then(|| Running {
            address,
            pid: status.pid,
            owned: owned == Some(status.pid),
            token: status.token,
        })
    }

    /// Starts `ura serve`, its output in the data folder's `run/server.log`.
    fn start(&self) -> Result<Child, String> {
        let options = &self.options;
        let log = self.log();
        let log = (|| {
            fs::DirBuilder::new()
                .recursive(true)
                .mode(0o700)
                .create(log.parent().expect("a file of run/"))?;
            OpenOptions::new().create(true).append(true).open(&log)
        })()
        .map_err(|error| format!("Uraeda's server cannot log in {}: {error}", log.display()))?;
        let length = log.metadata().map_or(0, |metadata| metadata.len());
        self.logged_from.store(length, Ordering::SeqCst);
        let mut command = Command::new(&options.ura);
        command
            .arg("serve")
            .arg("--data-dir")
            .arg(&options.data_dir);
        if let Some(port) = options.port {
            command.args(["--port", &port.to_string()]);
        }
        let errors = log.try_clone().map_err(|error| error.to_string())?;
        command
            .current_dir(&options.folder)
            .envs(
                options
                    .environment
                    .iter()
                    .map(|(name, value)| (name, value)),
            )
            .stdin(Stdio::null())
            .stdout(log)
            .stderr(errors);
        command.spawn().map_err(|error| {
            format!(
                "`{}` cannot start: {error}. Install Uraeda's command, or name it with `--ura`.",
                options.ura.display()
            )
        })
    }

    fn log(&self) -> PathBuf {
        self.options.data_dir.join("run").join("server.log")
    }

    /// Why a start failed, with the last lines its server logged in this start.
    fn failed(&self, why: &str) -> String {
        let logged = fs::read(self.log()).unwrap_or_default();
        let from = usize::try_from(self.logged_from.load(Ordering::SeqCst)).unwrap_or(usize::MAX);
        let logged = String::from_utf8_lossy(logged.get(from..).unwrap_or_default());
        let lines: Vec<&str> = logged.lines().rev().take(5).collect();
        let last: Vec<&str> = lines.into_iter().rev().collect();
        if last.is_empty() {
            format!("{why}.")
        } else {
            format!("{why}: {}", last.join("\n"))
        }
    }
}

impl Drop for Local {
    fn drop(&mut self) {
        self.stop();
    }
}

/// Whether an Uraeda server answers at `address`: it asks a request without a session to sign in.
pub fn answers(address: &str) -> bool {
    let config = ureq::Agent::config_builder()
        .timeout_global(Some(ASK))
        .http_status_as_error(false)
        .build();
    let agent = ureq::Agent::new_with_config(config);
    agent
        .get(&format!("{address}/session"))
        .call()
        .is_ok_and(|answer| matches!(answer.status().as_u16(), 204 | 401))
}
