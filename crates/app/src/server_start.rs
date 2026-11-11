//! The app's way to the server of its data folder: it finds the one that runs, through its status
//! file, `run/server.json`, or starts `ura serve` and waits until it answers. The app owns a server
//! it started, and stops it when it closes; it never stops one it found running.
//!
//! The status file is the server's (`crates/server/src/status.rs`): its port, its process, and the
//! host token that proves a request is the owner's own, which only the data folder's user reads.
//! A server killed leaves its file behind, so the app asks the server before it believes it.

use std::ffi::OsString;
use std::fs::{self, OpenOptions};
use std::os::unix::fs::DirBuilderExt as _;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Mutex, MutexGuard, PoisonError};
use std::time::{Duration, Instant};

use serde::Deserialize;

/// How long the app waits for a server it started to answer: its first start reads every
/// repository and builds the extensions' pages.
const START: Duration = Duration::from_secs(60);

/// How long a stopped server has to end before it is killed.
const STOP: Duration = Duration::from_secs(10);

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

/// The server of one data folder, as the app sees it: the process it started, if any.
#[derive(Debug)]
pub struct Local {
    options: LocalOptions,
    started: Mutex<Option<Child>>,
    /// The app closes: it starts no server any more, as a late call of its window would.
    closing: AtomicBool,
}

impl Local {
    pub fn new(options: LocalOptions) -> Local {
        Local {
            options,
            started: Mutex::new(None),
            closing: AtomicBool::new(false),
        }
    }

    /// The data folder.
    pub fn data_dir(&self) -> &Path {
        &self.options.data_dir
    }

    /// The server that runs, found or started, once it answers.
    ///
    /// # Errors
    ///
    /// When `ura` cannot start, or its server stops or says nothing within a minute: the words
    /// say why, with the end of its log.
    pub fn ensure(&self) -> Result<Running, String> {
        let mut started = self.started();
        // A server the app started that ended since: its process is reaped, and forgotten.
        if started
            .as_mut()
            .is_some_and(|child| !matches!(child.try_wait(), Ok(None)))
        {
            *started = None;
        }
        let owned = started.as_ref().map(Child::id);
        if let Some(running) = self.answering(owned) {
            return Ok(running);
        }
        if self.closing.load(Ordering::SeqCst) {
            return Err("The app is closing: it starts no server.".to_owned());
        }
        let child = self.start()?;
        let pid = child.id();
        *started = Some(child);
        let begun = Instant::now();
        loop {
            if let Some(running) = self.answering(Some(pid)) {
                return Ok(running);
            }
            let child = started.as_mut().expect("the child just started");
            if let Ok(Some(status)) = child.try_wait() {
                *started = None;
                return Err(
                    self.failed(&format!("Uraeda's server stopped as it started ({status})"))
                );
            }
            if begun.elapsed() > START {
                return Err(self.failed("Uraeda's server did not answer within a minute"));
            }
            std::thread::sleep(Duration::from_millis(50));
        }
    }

    /// The server that runs now, if one answers: none is started.
    pub fn running(&self) -> Option<Running> {
        let owned = self.started().as_ref().map(Child::id);
        self.answering(owned)
    }

    /// Stops the server the app started, if it still runs, and starts none after: the app closes.
    /// A server found running is left.
    pub fn stop(&self) {
        self.closing.store(true, Ordering::SeqCst);
        let Some(mut child) = self.started().take() else {
            return;
        };
        if !matches!(child.try_wait(), Ok(None)) {
            return;
        }
        let pid = libc::pid_t::try_from(child.id()).unwrap_or(0);
        // SAFETY: a signal to the process this app started and has not reaped yet.
        unsafe { libc::kill(pid, libc::SIGTERM) };
        let asked = Instant::now();
        while asked.elapsed() < STOP {
            if !matches!(child.try_wait(), Ok(None)) {
                return;
            }
            std::thread::sleep(Duration::from_millis(20));
        }
        let _ = child.kill();
        let _ = child.wait();
    }

    fn started(&self) -> MutexGuard<'_, Option<Child>> {
        self.started.lock().unwrap_or_else(PoisonError::into_inner)
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

    /// Why a start failed, with the last lines its server logged.
    fn failed(&self, why: &str) -> String {
        let logged = fs::read_to_string(self.log()).unwrap_or_default();
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
