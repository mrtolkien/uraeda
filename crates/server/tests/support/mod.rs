//! What every test of the server starts from: a real server on a free port, with a config folder
//! and a data folder of its own, a clock the test sets, a client speaking the real protocol over a
//! real WebSocket, and plain HTTP requests.
//!
//! ```ignore
//! let server = support::server().await;
//! let mut client = server.connect().await;
//! let answer = server.get("/session").send().await;
//! ```
//!
//! `support::setup()` prepares a start that differs: a file in the config folder, a variable of
//! the server's environment, the folder it starts in, a folder of commands of the test's own.
//!
//! No server started here finds the machine's agents: see `machine.rs`.
//!
//! Beside it: `fixture_repo(name)`, the git repository built from `fixtures/repo/`, `Hook`, its
//! pre-commit hook as a test holds it, and `read`, `call`, `Held`, `Live`, and `idle`, which read
//! records and call actions over `/live`: see `live.rs`; and `group_members` and `gone`, the
//! processes of a group a test's server started.

#![allow(
    dead_code,
    unused_imports,
    reason = "each test binary uses only part of the shared helpers"
)]

#[path = "../../../core/tests/common/repo.rs"]
pub mod repo;

mod client;
mod fixture;
mod hook;
mod live;
pub mod machine;
mod process;
mod request;

use std::fs;
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime};

use serde_json::json;
use tempfile::TempDir;
use uraeda_protocol::SignIn;
use uraeda_server::{Clock, Options, Server, Shared, sign_in, status};

pub use client::TestClient;
pub use fixture::{fixture, fixture_repo, fixture_text};
pub use hook::Hook;
pub use live::{Held, Live, Refused, call, idle, read, writes};
pub use process::{gone, group_members};
pub use repo::TestRepo;
pub use request::{TestRequest, TestResponse};

/// When a test's server starts: 2026-11-10 at 09:00 UTC, until the test moves its clock.
pub const START: Duration = Duration::from_secs(1_794_301_200);

/// A started server with nothing given: `setup().start()`.
pub async fn server() -> TestServer {
    setup().start().await
}

/// A start to prepare, on new temporary folders.
pub fn setup() -> Setup {
    let stand_ins = TempDir::new().expect("a temporary folder");
    machine::stand_ins(stand_ins.path());
    Setup {
        config: TempDir::new().expect("a temporary folder"),
        data: TempDir::new().expect("a temporary folder"),
        stand_ins,
        commands: Vec::new(),
        folder: None,
        environment: Vec::new(),
        allow_origins: Vec::new(),
    }
}

/// A start being prepared: its folders exist, and nothing runs yet.
pub struct Setup {
    config: TempDir,
    data: TempDir,
    /// The stand-ins of the machine's agents, which the server finds in their place.
    stand_ins: TempDir,
    /// The folders of the test's own commands, found before anything else.
    commands: Vec<PathBuf>,
    folder: Option<PathBuf>,
    environment: Vec<(String, String)>,
    allow_origins: Vec<String>,
}

impl Setup {
    /// Writes a file of the config folder, as `.env` or `config.toml`.
    pub fn config(self, path: &str, text: &str) -> Self {
        let file = self.config.path().join(path);
        fs::create_dir_all(file.parent().expect("a file in the config folder")).unwrap();
        fs::write(file, text).unwrap();
        self
    }

    /// Sets a variable of the environment the server starts in. Its `PATH` is not one to set:
    /// a test's own commands are a folder given to [`Setup::commands`], so that no test takes
    /// the stand-ins of the machine's agents off it.
    pub fn env(mut self, name: &str, value: &str) -> Self {
        assert_ne!(name, "PATH", "give the folder to `Setup::commands`");
        self.environment.push((name.to_owned(), value.to_owned()));
        self
    }

    /// Puts a folder of the test's own commands on the server's `PATH`, before the stand-ins
    /// of the machine's agents and the machine's commands: the first given is found first.
    pub fn commands(mut self, dir: &Path) -> Self {
        self.commands.push(dir.to_owned());
        self
    }

    /// The options the server starts with. `PATH` is the one variable it takes from the test's
    /// own environment, after the test's commands and the stand-ins: see `machine.rs`.
    pub fn options(&self) -> Options {
        let path = machine::path(&self.commands, self.stand_ins.path());
        let mut environment = vec![("PATH".to_owned(), path)];
        environment.extend(self.environment.iter().cloned());
        Options {
            port: Some(0),
            config_dir: self.config.path().to_owned(),
            data_dir: self.data.path().to_owned(),
            folder: self.folder.clone(),
            environment,
            allow_origins: self.allow_origins.clone(),
            clock: Clock::fixed(SystemTime::UNIX_EPOCH + START),
            no_scheduled_jobs: false,
            sandbox: None,
        }
    }

    /// The folder the server starts in, whose repository joins its list.
    pub fn folder(mut self, folder: &Path) -> Self {
        self.folder = Some(folder.to_owned());
        self
    }

    /// Accepts an origin besides the server's own, as a development server's.
    pub fn allow_origin(mut self, origin: &str) -> Self {
        self.allow_origins.push(origin.to_owned());
        self
    }

    /// Starts the server, on a free port.
    pub async fn start(self) -> TestServer {
        let options = self.options();
        let server = Server::start(options.clone())
            .await
            .expect("the server starts");
        let key = sign_in::key_at_start(server.shared())
            .expect("its file is written")
            .expect("a first start shows its key");
        TestServer {
            server,
            clock: options.clock.clone(),
            options,
            key,
            config: self.config,
            data: self.data,
            stand_ins: self.stand_ins,
            commands: self.commands,
        }
    }
}

/// A running server, and the temporary folders it lives in, removed with it.
pub struct TestServer {
    server: Server,
    options: Options,
    clock: Clock,
    key: String,
    config: TempDir,
    data: TempDir,
    stand_ins: TempDir,
    commands: Vec<PathBuf>,
}

impl TestServer {
    /// The port the server listens on.
    pub fn port(&self) -> u16 {
        self.server.port()
    }

    /// The server's own `Host`, `127.0.0.1:<port>`.
    pub fn host(&self) -> String {
        format!("127.0.0.1:{}", self.port())
    }

    /// The server's address, `http://127.0.0.1:<port>`.
    pub fn address(&self) -> String {
        self.server.address()
    }

    /// The server's config folder.
    pub fn config_dir(&self) -> &Path {
        &self.options.config_dir
    }

    /// The server's data folder.
    pub fn data_dir(&self) -> &Path {
        &self.options.data_dir
    }

    /// The options the server started with, for a second start on the same folders.
    pub fn options(&self) -> Options {
        self.options.clone()
    }

    /// The server's clock, which stands still until the test sets or advances it.
    pub fn clock(&self) -> &Clock {
        &self.clock
    }

    /// The state the server's domains share.
    pub fn shared(&self) -> &Shared {
        self.server.shared()
    }

    /// Asserts that the server runs no agent of the machine, and no `gh`: the `claude`, the
    /// `codex`, and the `gh` its `PATH` finds are the test's own, or the stand-ins, of which it
    /// asked each agent's as it started.
    pub async fn runs_no_agent_of_the_machine(&self) {
        let environment = self.shared().environment();
        let path = environment.var("PATH").expect("a server has a PATH");
        for command in machine::COMMANDS {
            let found = machine::found(path, command).expect("a stand-in is found");
            let folder = found.parent().expect("a file is in a folder");
            if self.commands.iter().any(|own| own == folder) {
                continue;
            }
            assert_eq!(
                folder,
                self.stand_ins.path(),
                "the server would run the machine's `{command}`"
            );
            if machine::AGENTS.contains(&command) {
                self.asked(command).await;
            }
        }
    }

    /// Waits until the stand-in of a command was asked, as the server's start asks an agent
    /// for its models.
    async fn asked(&self, command: &str) {
        let asked = || machine::asked(self.stand_ins.path());
        let named = |line: &String| line.split(' ').next() == Some(command);
        let deadline = tokio::time::Instant::now() + Duration::from_secs(30);
        while !asked().iter().any(named) {
            let waited = tokio::time::Instant::now() > deadline;
            assert!(!waited, "the stand-in of `{command}` was not asked");
            tokio::time::sleep(Duration::from_millis(20)).await;
        }
    }

    /// The paths of the server's routes, as their domains declared them.
    pub fn routes(&self) -> Vec<&'static str> {
        self.server.routes()
    }

    /// The host token, as the host's own `ura` reads it in the status file.
    pub fn host_token(&self) -> String {
        status::read(self.data_dir())
            .expect("the status file")
            .token
    }

    /// The access key, which the server showed once, as it first started.
    pub fn key(&self) -> &str {
        &self.key
    }

    /// Signs a browser in with the access key: its cookie, `uraeda=<id>.<secret>`.
    pub async fn sign_in(&self) -> String {
        let answer = self
            .post("/session")
            .json(&json!({ "key": self.key }))
            .send()
            .await;
        assert_eq!(answer.status, 204, "the key signs in: {}", answer.text());
        answer.cookie().expect("a signed-in answer sets its cookie")
    }

    /// A pairing code, as the host's own `ura pair` asks for one.
    pub async fn pairing_code(&self) -> String {
        let answer = self
            .post("/pair/code")
            .bearer(&self.host_token())
            .send()
            .await;
        assert_eq!(
            answer.status,
            200,
            "the host gets a code: {}",
            answer.text()
        );
        answer.json()["code"].as_str().expect("a code").to_owned()
    }

    /// Pairs a device named `name`: its token.
    pub async fn pair(&self, name: &str) -> String {
        let code = self.pairing_code().await;
        let answer = self
            .post("/pair")
            .json(&json!({ "code": code, "name": name }))
            .send()
            .await;
        assert_eq!(answer.status, 200, "the code pairs: {}", answer.text());
        answer.json()["token"].as_str().expect("a token").to_owned()
    }

    /// A WebSocket at `/live` that said `hello` and was welcomed: a device paired for it.
    pub async fn connect(&self) -> TestClient {
        let token = self.pair("A test's device").await;
        let mut client = self.socket().await;
        client.sign_in(SignIn::Token(token));
        client.hello().await;
        client
    }

    /// A WebSocket at `/live` that said nothing yet. Its `hello` signs in with no session.
    pub async fn socket(&self) -> TestClient {
        TestClient::open(self.port(), None).await
    }

    /// A WebSocket at `/live` opened by a browser's request, with its cookie, that said nothing
    /// yet.
    pub async fn browser_socket(&self, cookie: &str) -> TestClient {
        TestClient::open(self.port(), Some(cookie)).await
    }

    /// A `GET` of a path, to send.
    pub fn get(&self, path: &str) -> TestRequest {
        self.request("GET", path)
    }

    /// A `POST` to a path, to send.
    pub fn post(&self, path: &str) -> TestRequest {
        self.request("POST", path)
    }

    /// A request of any method, to send: from no page, to the server's own `Host`.
    pub fn request(&self, method: &str, path: &str) -> TestRequest {
        TestRequest::new(self.port(), method, path)
    }

    /// Stops the server, as `ura serve` does on a signal.
    pub async fn stop(self) {
        self.server.stop().await;
    }

    /// Stops the server, and starts it again on the same folders and the same clock: a first
    /// start no more, so it shows no key.
    pub async fn restart(self) -> TestServer {
        self.server.stop().await;
        let server = Server::start(self.options.clone())
            .await
            .expect("the server starts again");
        TestServer { server, ..self }
    }
}
