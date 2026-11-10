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
//! the server's environment, the folder it starts in.

#![allow(
    dead_code,
    unused_imports,
    reason = "each test binary uses only part of the shared helpers"
)]

#[path = "../../../core/tests/common/repo.rs"]
pub mod repo;

mod client;
mod request;

use std::fs;
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime};

use tempfile::TempDir;
use uraeda_server::{Clock, Options, Server, Shared, status};

pub use client::TestClient;
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
    let environment = std::env::var("PATH").map_or_else(|_| Vec::new(), |path| vec![path_of(path)]);
    Setup {
        config: TempDir::new().expect("a temporary folder"),
        data: TempDir::new().expect("a temporary folder"),
        folder: None,
        environment,
        allow_origins: Vec::new(),
    }
}

/// `PATH`, the one variable a test's server takes from the test's own environment: the commands
/// it runs are found as the test's are.
fn path_of(path: String) -> (String, String) {
    ("PATH".to_owned(), path)
}

/// A start being prepared: its folders exist, and nothing runs yet.
pub struct Setup {
    config: TempDir,
    data: TempDir,
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

    /// Sets a variable of the environment the server starts in.
    pub fn env(mut self, name: &str, value: &str) -> Self {
        self.environment.push((name.to_owned(), value.to_owned()));
        self
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
        let clock = Clock::fixed(SystemTime::UNIX_EPOCH + START);
        let options = Options {
            port: 0,
            config_dir: self.config.path().to_owned(),
            data_dir: self.data.path().to_owned(),
            folder: self.folder,
            environment: self.environment,
            allow_origins: self.allow_origins,
            clock: clock.clone(),
        };
        let server = Server::start(options.clone())
            .await
            .expect("the server starts");
        TestServer {
            server,
            options,
            clock,
            _config: self.config,
            _data: self.data,
        }
    }
}

/// A running server, and the temporary folders it lives in, removed with it.
pub struct TestServer {
    server: Server,
    options: Options,
    clock: Clock,
    _config: TempDir,
    _data: TempDir,
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

    /// A WebSocket at `/live` that said `hello` and was welcomed.
    pub async fn connect(&self) -> TestClient {
        let mut client = self.socket().await;
        client.hello().await;
        client
    }

    /// A WebSocket at `/live` that said nothing yet.
    pub async fn socket(&self) -> TestClient {
        TestClient::open(self.port()).await
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
}
