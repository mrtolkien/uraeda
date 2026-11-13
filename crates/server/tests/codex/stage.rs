//! What the tests of Codex's runtime run on: a server whose `codex` is a stand-in, which runs
//! no agent, and the built-in runtime the server registered.
//!
//! The stand-in is the program `fake-codex`, of `tests/bin/fake_codex.rs`, built beside the
//! tests, first on the `PATH` of the server's environment, before the stand-ins of the agents
//! this file's tests do not run (see `support/machine.rs`). In the folder it runs in, a
//! session's, it writes `argv`, its arguments, `token`, its token for Uraeda's tools, `pid`, and
//! `stdin`, each line it read. With `exchange.jsonl` there, it replays that exchange; without,
//! it answers as Codex does, as `options.json` beside it says.

use std::fs;
use std::os::unix::fs::PermissionsExt;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Duration;

use serde_json::Value;
use tempfile::TempDir;
use uraeda_server::runner::Event;
use uraeda_server::runtimes::{
    AgentProcess, Events, Options, Outgoing, Runtime, Runtimes, Tools, When,
};

use crate::support::{self, Setup, TestServer};

/// How long a stand-in gets to say what a test waits for.
const PATIENCE: Duration = Duration::from_secs(30);

/// The fixtures of Codex's runtime: the exchanges the stand-in replays.
pub fn fixtures() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("../../fixtures/runtimes/codex")
}

/// A server whose `codex` is the stand-in, with the folders its sessions run in.
pub struct Stage {
    pub server: TestServer,
    /// The folder of the stand-in and its settings, first on the server's `PATH`.
    pub bin: PathBuf,
    /// The home folder of the server's environment, where the models are asked for.
    pub home: PathBuf,
    folders: TempDir,
}

/// A server whose `codex` is the stand-in, with these options.
pub async fn stage(options: Value) -> Stage {
    staged(options, |setup| setup).await
}

/// As [`stage`], on a start the test prepares further.
pub async fn staged(options: Value, prepare: impl FnOnce(Setup) -> Setup) -> Stage {
    let folders = TempDir::new().expect("a temporary folder");
    let folder = |name: &str| {
        let path = folders.path().join(name);
        fs::create_dir(&path).unwrap();
        path
    };
    let (bin, home) = (folder("bin"), folder("home"));
    let script = format!(
        "#!/bin/sh\nexec \"{}\" \"{}\" \"$@\"\n",
        env!("CARGO_BIN_EXE_fake-codex"),
        bin.display()
    );
    let command = bin.join("codex");
    fs::write(&command, script).unwrap();
    fs::set_permissions(&command, fs::Permissions::from_mode(0o755)).unwrap();
    fs::write(bin.join("options.json"), options.to_string()).unwrap();
    let setup = support::setup()
        .commands(&bin)
        .env("HOME", home.to_str().unwrap());
    Stage {
        server: prepare(setup).start().await,
        bin,
        home,
        folders,
    }
}

impl Stage {
    /// The built-in runtime, as the server registered it.
    pub fn runtime(&self) -> Arc<dyn Runtime> {
        let runtimes = self.server.shared().get::<Runtimes>();
        runtimes.get("codex").expect("the built-in runtime")
    }

    /// A new folder for a session to run in.
    pub fn session_dir(&self) -> PathBuf {
        let sessions = self.folders.path().join("sessions");
        fs::create_dir_all(&sessions).unwrap();
        let dir = TempDir::new_in(sessions).expect("a temporary folder");
        dir.keep()
    }

    /// Opens a session's process, on a blocking thread, as the sessions do.
    pub async fn open(&self, options: Options) -> Box<dyn AgentProcess> {
        open_on(self.runtime(), options).await
    }

    /// Stops the server.
    pub async fn stop(self) {
        self.server.stop().await;
    }
}

/// Opens a process of a runtime, on a blocking thread.
pub async fn open_on(runtime: Arc<dyn Runtime>, options: Options) -> Box<dyn AgentProcess> {
    let opened = tokio::task::spawn_blocking(move || runtime.open(options));
    opened.await.expect("the runtime opens")
}

/// How a chat's process opens in a folder: a new thread, on the agent's defaults.
pub fn options(cwd: &Path) -> Options {
    Options {
        cwd: cwd.to_owned(),
        native_id: "id".to_owned(),
        resume: false,
        model: None,
        effort: None,
        account: None,
        allowed: Vec::new(),
        skills: Vec::new(),
        tools: Tools::Own,
    }
}

/// A message that waits for the next turn.
pub fn message(id: &str, text: &str) -> Outgoing {
    Outgoing {
        id: id.to_owned(),
        text: text.to_owned(),
        images: Vec::new(),
        when: When::Queue,
        review: false,
    }
}

/// A message that joins the running turn.
pub fn steer(id: &str, text: &str) -> Outgoing {
    Outgoing {
        when: When::Steer,
        ..message(id, text)
    }
}

/// An event as JSON, as a runtime in an extension's VM would write it.
pub fn json(event: &Event) -> Value {
    serde_json::to_value(event).expect("an event is JSON")
}

/// The next event of a process: none once its `exit` was read.
pub async fn next(events: &mut Events) -> Option<Value> {
    let event = tokio::time::timeout(PATIENCE, events.next()).await;
    event.expect("the process says more").as_ref().map(json)
}

/// Reads a process's events until one of a kind, and gives all read.
pub async fn until(events: &mut Events, kind: &str) -> Vec<Value> {
    let mut read = Vec::new();
    loop {
        let Some(event) = next(events).await else {
            panic!("no {kind} in {read:?}");
        };
        let found = event["type"] == kind;
        read.push(event);
        if found {
            return read;
        }
    }
}

/// The JSON lines the stand-in read on its stdin, in a session's folder.
pub fn written(dir: &Path) -> Vec<Value> {
    let lines = fs::read_to_string(dir.join("stdin")).unwrap_or_default();
    let lines = lines.lines().filter(|line| !line.is_empty());
    lines
        .map(|line| serde_json::from_str(line).expect("a line of JSON"))
        .collect()
}

/// The requests and notifications among them: each message with a method.
pub fn requests(dir: &Path) -> Vec<Value> {
    let mut lines = written(dir);
    lines.retain(|line| line.get("method").is_some());
    lines
}

/// The parameters of the first request of a method.
pub fn params(dir: &Path, method: &str) -> Value {
    let found = requests(dir)
        .into_iter()
        .find(|line| line["method"] == method);
    found.unwrap_or_else(|| panic!("no {method} was written"))["params"].clone()
}

/// Whether two JSON values are the same, a number read as its value: `1` is `1.0`.
pub fn same(a: &Value, b: &Value) -> bool {
    match (a, b) {
        (Value::Number(a), Value::Number(b)) => a.as_f64() == b.as_f64(),
        (Value::Array(a), Value::Array(b)) => {
            a.len() == b.len() && a.iter().zip(b).all(|(a, b)| same(a, b))
        }
        (Value::Object(a), Value::Object(b)) => {
            a.len() == b.len()
                && a.iter()
                    .all(|(key, a)| b.get(key).is_some_and(|b| same(a, b)))
        }
        (a, b) => a == b,
    }
}
