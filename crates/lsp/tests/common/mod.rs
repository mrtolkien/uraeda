//! `Session`: the language server on a thread, driven in memory as an editor would drive it.
#![allow(
    dead_code,
    unused_imports,
    reason = "each test binary uses only part of the shared helpers"
)]

#[path = "../../../core/tests/common/repo.rs"]
pub mod repo;
#[path = "../../../core/tests/common/texts.rs"]
pub mod texts;

use std::collections::{HashMap, VecDeque};
use std::path::{Path, PathBuf};
use std::thread::JoinHandle;
use std::time::{Duration, Instant};

use lsp_server::{Connection, Message, Notification, Request, RequestId, Response, ResponseError};
use lsp_types::notification::{
    DidChangeTextDocument, DidCloseTextDocument, DidOpenTextDocument, DidSaveTextDocument, Exit,
    Initialized, Notification as _, PublishDiagnostics,
};
use lsp_types::request::{Initialize, Request as _, Shutdown};
use lsp_types::{
    ClientCapabilities, Diagnostic, DidChangeTextDocumentParams, DidCloseTextDocumentParams,
    DidOpenTextDocumentParams, DidSaveTextDocumentParams, InitializeParams, InitializeResult,
    PublishDiagnosticsParams, TextDocumentContentChangeEvent, TextDocumentIdentifier,
    TextDocumentItem, Uri, VersionedTextDocumentIdentifier, WindowClientCapabilities,
    WorkspaceFolder,
};
use serde_json::{Value, json};

pub use repo::TestRepo;
pub use texts::*;

/// How long `diagnostics` and a request wait for the server.
const WAIT: Duration = Duration::from_secs(2);

/// This repository's top level.
pub fn repository() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../..")
        .canonicalize()
        .unwrap()
}

/// A language server on a thread, initialized with `root` as its only workspace folder.
pub struct Session {
    client: Connection,
    server: Option<JoinHandle<()>>,
    next_id: i32,
    versions: i32,
    /// Notifications received and not yet read, in order.
    received: VecDeque<Notification>,
    /// Responses received and not yet read, by request.
    responses: HashMap<RequestId, Response>,
    /// The server's own requests, in order.
    server_requests: Vec<Request>,
    /// The initialize result.
    pub initialized: InitializeResult,
}

impl Session {
    pub fn start(root: &Path) -> Session {
        let (server, client) = Connection::memory();
        let thread = std::thread::spawn(move || uraeda_lsp::run(server).expect("the server runs"));
        let mut session = Session {
            client,
            server: Some(thread),
            next_id: 0,
            versions: 0,
            received: VecDeque::new(),
            responses: HashMap::new(),
            server_requests: Vec::new(),
            initialized: InitializeResult::default(),
        };
        let uri = uraeda_lsp::file_uri(root);
        let params = InitializeParams {
            // As Neovim does: the server may create work done progress.
            capabilities: ClientCapabilities {
                window: Some(WindowClientCapabilities {
                    work_done_progress: Some(true),
                    ..WindowClientCapabilities::default()
                }),
                ..ClientCapabilities::default()
            },
            workspace_folders: Some(vec![WorkspaceFolder {
                uri,
                name: "root".to_string(),
            }]),
            ..InitializeParams::default()
        };
        session.initialized = session.request::<Initialize>(params);
        session.notify::<Initialized>(lsp_types::InitializedParams {});
        session
    }

    pub fn uri(path: &Path) -> Uri {
        uraeda_lsp::file_uri(path)
    }

    pub fn open(&mut self, path: &Path, text: &str) {
        self.versions += 1;
        self.notify::<DidOpenTextDocument>(DidOpenTextDocumentParams {
            text_document: TextDocumentItem::new(
                Self::uri(path),
                "markdown".to_string(),
                self.versions,
                text.to_string(),
            ),
        });
    }

    /// Replaces the open document's whole text, as full sync does.
    pub fn change(&mut self, path: &Path, text: &str) {
        self.versions += 1;
        self.notify::<DidChangeTextDocument>(DidChangeTextDocumentParams {
            text_document: VersionedTextDocumentIdentifier::new(Self::uri(path), self.versions),
            content_changes: vec![TextDocumentContentChangeEvent {
                range: None,
                range_length: None,
                text: text.to_string(),
            }],
        });
    }

    pub fn save(&mut self, path: &Path) {
        self.notify::<DidSaveTextDocument>(DidSaveTextDocumentParams {
            text_document: TextDocumentIdentifier::new(Self::uri(path)),
            text: None,
        });
    }

    pub fn close(&mut self, path: &Path) {
        self.notify::<DidCloseTextDocument>(DidCloseTextDocumentParams {
            text_document: TextDocumentIdentifier::new(Self::uri(path)),
        });
    }

    /// Sends a typed request, and panics unless it succeeds.
    pub fn request<R: lsp_types::request::Request>(&mut self, params: R::Params) -> R::Result {
        let params = serde_json::to_value(params).unwrap();
        match self.raw(R::METHOD, params) {
            Ok(result) => serde_json::from_value(result).unwrap(),
            Err(error) => panic!("{} failed: {}", R::METHOD, error.message),
        }
    }

    /// Sends a request by its method, and waits for its response.
    pub fn raw(&mut self, method: &str, params: Value) -> Result<Value, ResponseError> {
        let id = self.send(method, params);
        self.response(&id)
    }

    /// Sends a request by its method, without waiting for its response.
    pub fn send(&mut self, method: &str, params: Value) -> RequestId {
        self.next_id += 1;
        let id = RequestId::from(self.next_id);
        let request = Request::new(id.clone(), method.to_string(), params);
        self.client.sender.send(request.into()).unwrap();
        id
    }

    /// Waits for the response to the request `id`.
    pub fn response(&mut self, id: &RequestId) -> Result<Value, ResponseError> {
        let deadline = Instant::now() + WAIT * 5;
        loop {
            if let Some(response) = self.responses.remove(id) {
                return response.response_result;
            }
            if self.receive(deadline).is_none() {
                panic!("no response to the request {id}");
            }
        }
    }

    /// Whether the response to the request `id` has arrived, without waiting for it.
    pub fn answered(&mut self, id: &RequestId) -> bool {
        while self.receive(Instant::now()).is_some() {}
        self.responses.contains_key(id)
    }

    /// The params of every request of `method` the server sent so far.
    pub fn server_requests(&mut self, method: &str) -> Vec<Value> {
        while self.receive(Instant::now()).is_some() {}
        self.server_requests
            .iter()
            .filter(|request| request.method == method)
            .map(|request| request.params.clone())
            .collect()
    }

    /// Runs a command, `workspace/executeCommand` with `args` as its only argument.
    pub fn command(&mut self, name: &str, args: Value) -> Result<Value, ResponseError> {
        let id = self.start_command(name, args);
        self.response(&id)
    }

    /// Sends a command, without waiting for its response.
    pub fn start_command(&mut self, name: &str, args: Value) -> RequestId {
        self.send(
            "workspace/executeCommand",
            json!({ "command": name, "arguments": [args] }),
        )
    }

    /// The next diagnostics published for `path`, waiting up to 2 s for them.
    pub fn diagnostics(&mut self, path: &Path) -> Vec<Diagnostic> {
        let uri = Self::uri(path);
        let deadline = Instant::now() + WAIT;
        loop {
            let found = self.received.iter().position(|notification| {
                notification.method == PublishDiagnostics::METHOD
                    && notification.params["uri"] == uri.as_str()
            });
            if let Some(index) = found {
                let notification = self.received.remove(index).unwrap();
                let params: PublishDiagnosticsParams =
                    serde_json::from_value(notification.params).unwrap();
                return params.diagnostics;
            }
            match self.receive(deadline) {
                Some(_) => {}
                None => panic!("no diagnostics for {} within 2 s", path.display()),
            }
        }
    }

    /// The params of every notification of `method` received so far, read and removed.
    pub fn notifications(&mut self, method: &str) -> Vec<Value> {
        while self.receive(Instant::now()).is_some() {}
        let (matching, rest) = self
            .received
            .drain(..)
            .partition::<Vec<_>, _>(|notification| notification.method == method);
        self.received = rest.into();
        matching
            .into_iter()
            .map(|notification| notification.params)
            .collect()
    }

    fn notify<N: lsp_types::notification::Notification>(&mut self, params: N::Params) {
        let notification = Notification::new(N::METHOD.to_string(), params);
        self.client.sender.send(notification.into()).unwrap();
    }

    /// Receives one message until `deadline`: notifications and responses are kept for later, and
    /// the server's own requests kept and answered with `null`. `None` once the deadline passes.
    fn receive(&mut self, deadline: Instant) -> Option<Message> {
        let timeout = deadline.saturating_duration_since(Instant::now());
        let message = self.client.receiver.recv_timeout(timeout).ok()?;
        match &message {
            Message::Notification(notification) => self.received.push_back(notification.clone()),
            Message::Request(request) => {
                self.server_requests.push(request.clone());
                let response = Response::new_ok(request.id.clone(), Value::Null);
                self.client.sender.send(response.into()).unwrap();
            }
            Message::Response(response) => {
                self.responses.insert(response.id.clone(), response.clone());
            }
        }
        Some(message)
    }
}

impl Drop for Session {
    fn drop(&mut self) {
        if std::thread::panicking() {
            return;
        }
        self.request::<Shutdown>(());
        self.notify::<Exit>(());
        if let Some(server) = self.server.take() {
            server.join().expect("the server stops");
        }
    }
}

/// The example project's feature folder, a valid feature with an approved spec.
pub const FEATURE: &str = "specs/2026-10-06-recurring-tasks";

/// The example project's root, holding its `specs/`.
pub fn example() -> PathBuf {
    repository().join("skills/uraeda/assets/example")
}

/// A repository holding the example project's `specs/`, committed on `main`; returns it, the
/// spec's path, and the spec's text.
pub fn feature_with_spec() -> (TestRepo, PathBuf, String) {
    let repo = TestRepo::new();
    write_example(&repo);
    repo.commit("feature");
    let path = repo.path().join(FEATURE).join("spec.md");
    let text = std::fs::read_to_string(&path).unwrap();
    (repo, path, text)
}

/// Copies the example project's `specs/` into the repository.
pub fn write_example(repo: &TestRepo) {
    fn copy(from: &Path, to: &Path) {
        std::fs::create_dir_all(to).unwrap();
        for entry in std::fs::read_dir(from).unwrap() {
            let path = entry.unwrap().path();
            let target = to.join(path.file_name().unwrap());
            if path.is_dir() {
                copy(&path, &target);
            } else {
                std::fs::copy(&path, &target).unwrap();
            }
        }
    }
    copy(&example().join("specs"), &repo.path().join("specs"));
}
