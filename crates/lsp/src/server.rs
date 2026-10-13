//! The protocol loop: initialize, then route each request and notification to the module of its
//! capability, until `exit`.

use std::path::PathBuf;

use crossbeam_channel::Sender;
use lsp_server::{Connection, ErrorCode, Message, Notification, Request, Response, ResponseError};
use lsp_types::notification::{
    DidChangeTextDocument, DidCloseTextDocument, DidOpenTextDocument, DidSaveTextDocument, Exit,
    Notification as _, PublishDiagnostics,
};
use lsp_types::request::{Request as _, Shutdown};
use lsp_types::{
    InitializeParams, InitializeResult, PublishDiagnosticsParams, SaveOptions, ServerCapabilities,
    ServerInfo, TextDocumentSyncCapability, TextDocumentSyncKind, TextDocumentSyncOptions,
    TextDocumentSyncSaveOptions, Uri,
};
use serde::Serialize;
use serde::de::DeserializeOwned;
use serde_json::Value;

use crate::documents::{self, Documents};
use crate::{Error, diagnostics};

pub(crate) fn run(connection: Connection) -> Result<(), Error> {
    let (id, params) = connection.initialize_start()?;
    let params: InitializeParams = serde_json::from_value(params)?;
    connection.initialize_finish(id, serde_json::to_value(initialize_result())?)?;
    let mut server = Server {
        sender: connection.sender.clone(),
        documents: Documents::new(root(&params)),
        shut_down: false,
    };
    for message in &connection.receiver {
        match message {
            Message::Request(request) => server.on_request(request),
            Message::Notification(notification) if notification.method == Exit::METHOD => break,
            Message::Notification(notification) => server.on_notification(notification),
            Message::Response(_) => {}
        }
    }
    Ok(())
}

fn initialize_result() -> InitializeResult {
    InitializeResult {
        capabilities: ServerCapabilities {
            text_document_sync: Some(TextDocumentSyncCapability::Options(
                TextDocumentSyncOptions {
                    open_close: Some(true),
                    change: Some(TextDocumentSyncKind::FULL),
                    save: Some(TextDocumentSyncSaveOptions::SaveOptions(SaveOptions {
                        include_text: Some(false),
                    })),
                    ..TextDocumentSyncOptions::default()
                },
            )),
            ..ServerCapabilities::default()
        },
        server_info: Some(ServerInfo {
            name: "ura lsp".to_string(),
            version: Some(env!("CARGO_PKG_VERSION").to_string()),
        }),
    }
}

/// The server's root: the first workspace folder, else `rootUri`, else the current folder.
fn root(params: &InitializeParams) -> PathBuf {
    #[allow(deprecated)]
    let root_uri = params.root_uri.as_ref();
    params
        .workspace_folders
        .iter()
        .flatten()
        .map(|folder| &folder.uri)
        .chain(root_uri)
        .find_map(documents::file_path)
        .or_else(|| std::env::current_dir().ok())
        .unwrap_or_default()
}

struct Server {
    sender: Sender<Message>,
    documents: Documents,
    /// Set by `shutdown`: every later request is refused, until `exit`.
    shut_down: bool,
}

impl Server {
    fn on_request(&mut self, request: Request) {
        let result = if self.shut_down {
            Err(error(
                ErrorCode::InvalidRequest,
                "the server is shutting down".to_string(),
            ))
        } else {
            match request.method.as_str() {
                Shutdown::METHOD => handle::<Shutdown>(request.params, |()| {
                    self.shut_down = true;
                    Ok(())
                }),
                method => Err(error(
                    ErrorCode::MethodNotFound,
                    format!("method not found: {method}"),
                )),
            }
        };
        self.send(Response {
            id: request.id,
            response_result: result,
        });
    }

    fn on_notification(&mut self, notification: Notification) {
        let params = notification.params;
        match notification.method.as_str() {
            DidOpenTextDocument::METHOD => notify::<DidOpenTextDocument>(params, |params| {
                let document = params.text_document;
                self.documents.open(document.uri.clone(), document.text);
                self.publish_diagnostics(document.uri);
            }),
            DidChangeTextDocument::METHOD => notify::<DidChangeTextDocument>(params, |params| {
                // Full sync: the last change holds the whole text.
                if let Some(change) = params.content_changes.into_iter().last() {
                    let uri = params.text_document.uri;
                    self.documents.change(uri.clone(), change.text);
                    self.publish_diagnostics(uri);
                }
            }),
            DidSaveTextDocument::METHOD => notify::<DidSaveTextDocument>(params, |params| {
                self.publish_diagnostics(params.text_document.uri);
            }),
            DidCloseTextDocument::METHOD => notify::<DidCloseTextDocument>(params, |params| {
                let uri = params.text_document.uri;
                self.documents.close(&uri);
                self.publish_diagnostics(uri);
            }),
            _ => {}
        }
    }

    /// Publishes the diagnostics of `uri`, an empty list once it is closed or when it is not a
    /// file under `specs/`, so an editor clears what it showed.
    fn publish_diagnostics(&self, uri: Uri) {
        let path = self.documents.path(&uri);
        if !path.is_some_and(|path| self.documents.in_specs(&path)) {
            return;
        }
        let diagnostics = diagnostics::of(&self.documents, &uri);
        self.notify::<PublishDiagnostics>(PublishDiagnosticsParams {
            uri,
            diagnostics,
            version: None,
        });
    }

    fn notify<N: lsp_types::notification::Notification>(&self, params: N::Params) {
        self.send(Notification::new(N::METHOD.to_string(), params));
    }

    fn send(&self, message: impl Into<Message>) {
        // The client is gone once the channel closes: the loop ends on its own.
        let _ = self.sender.send(message.into());
    }
}

/// Answers a typed request with `answer`, or refuses params that do not match its type.
fn handle<R: lsp_types::request::Request>(
    params: Value,
    answer: impl FnOnce(R::Params) -> Result<R::Result, ResponseError>,
) -> Result<Value, ResponseError>
where
    R::Params: DeserializeOwned,
    R::Result: Serialize,
{
    let params = serde_json::from_value(params)
        .map_err(|e| error(ErrorCode::InvalidParams, format!("{}: {e}", R::METHOD)))?;
    let result = answer(params)?;
    serde_json::to_value(result).map_err(|e| error(ErrorCode::InternalError, e.to_string()))
}

/// Handles a typed notification, and ignores one whose params do not match its type: a
/// notification has no answer to carry the error.
fn notify<N: lsp_types::notification::Notification>(params: Value, handle: impl FnOnce(N::Params))
where
    N::Params: DeserializeOwned,
{
    if let Ok(params) = serde_json::from_value(params) {
        handle(params);
    }
}

pub(crate) fn error(code: ErrorCode, message: String) -> ResponseError {
    ResponseError {
        code: code as i32,
        message,
        data: None,
    }
}
