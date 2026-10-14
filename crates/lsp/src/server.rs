//! The protocol loop: initialize, then route each request and notification to the module of its
//! capability, until `exit`.

use std::path::PathBuf;
use std::thread::JoinHandle;

use crossbeam_channel::Sender;
use lsp_server::{
    Connection, ErrorCode, Message, Notification, Request, RequestId, Response, ResponseError,
};
use lsp_types::notification::{
    DidChangeTextDocument, DidCloseTextDocument, DidOpenTextDocument, DidSaveTextDocument, Exit,
    Notification as _, Progress, PublishDiagnostics,
};
use lsp_types::request::{
    CodeActionRequest, Completion, DocumentSymbolRequest, ExecuteCommand, InlayHintRequest,
    Request as _, Shutdown, WorkDoneProgressCreate,
};
use lsp_types::{
    CodeActionKind, CodeActionOptions, CodeActionProviderCapability, CompletionOptions,
    ExecuteCommandOptions, ExecuteCommandParams, InitializeParams, InitializeResult, OneOf,
    ProgressParams, ProgressParamsValue, ProgressToken, PublishDiagnosticsParams, SaveOptions,
    ServerCapabilities, ServerInfo, TextDocumentSyncCapability, TextDocumentSyncKind,
    TextDocumentSyncOptions, TextDocumentSyncSaveOptions, Uri, WorkDoneProgress,
    WorkDoneProgressBegin, WorkDoneProgressCreateParams, WorkDoneProgressEnd,
};
use serde::Serialize;
use serde::de::DeserializeOwned;
use serde_json::Value;

use crate::documents::{self, Documents};
use crate::{Error, actions, commands, completion, diagnostics, hints, requests, symbols};

pub(crate) fn run(connection: Connection) -> Result<(), Error> {
    let (id, params) = connection.initialize_start()?;
    let params: InitializeParams = serde_json::from_value(params)?;
    connection.initialize_finish(id, serde_json::to_value(initialize_result())?)?;
    let progress = params
        .capabilities
        .window
        .as_ref()
        .and_then(|window| window.work_done_progress)
        .unwrap_or(false);
    let (jobs, worker) = worker(connection.sender.clone(), progress);
    let mut server = Server {
        sender: connection.sender.clone(),
        documents: Documents::new(root(&params)),
        shut_down: false,
        jobs,
    };
    for message in &connection.receiver {
        match message {
            Message::Request(request) => server.on_request(request),
            Message::Notification(notification) if notification.method == Exit::METHOD => break,
            Message::Notification(notification) => server.on_notification(notification),
            Message::Response(_) => {}
        }
    }
    // The command running finishes, so a commit is never cut in half.
    drop(server);
    worker.join().map_err(|_| "the command worker panicked")?;
    Ok(())
}

/// A command for the worker: the request to answer, and a copy of the open documents.
struct Job {
    id: RequestId,
    params: ExecuteCommandParams,
    documents: Documents,
}

/// The worker: one thread running the commands one at a time, between `$/progress` `begin` and
/// `end`, and answering each, while the loop keeps answering other requests. `progress` is
/// whether the client creates work done progress on the server's request.
fn worker(sender: Sender<Message>, progress: bool) -> (Sender<Job>, JoinHandle<()>) {
    let (jobs, receiver) = crossbeam_channel::unbounded::<Job>();
    let thread = std::thread::spawn(move || {
        for (index, job) in receiver.into_iter().enumerate() {
            let send = |message: Message| {
                let _ = sender.send(message);
            };
            let ExecuteCommandParams {
                command,
                mut arguments,
                work_done_progress_params,
            } = job.params;
            let args = if arguments.is_empty() {
                Value::Null
            } else {
                arguments.swap_remove(0)
            };
            // The client's token, else one the server creates, when the client supports it.
            let token = work_done_progress_params.work_done_token.or_else(|| {
                progress.then(|| {
                    let token = ProgressToken::String(format!("uraeda/command/{index}"));
                    let create = WorkDoneProgressCreateParams {
                        token: token.clone(),
                    };
                    send(
                        Request::new(
                            RequestId::from(format!("uraeda/progress/{index}")),
                            WorkDoneProgressCreate::METHOD.to_string(),
                            create,
                        )
                        .into(),
                    );
                    token
                })
            });
            let report = |value: WorkDoneProgress| {
                if let Some(token) = &token {
                    let params = ProgressParams {
                        token: token.clone(),
                        value: ProgressParamsValue::WorkDone(value),
                    };
                    send(Notification::new(Progress::METHOD.to_string(), params).into());
                }
            };
            report(WorkDoneProgress::Begin(WorkDoneProgressBegin {
                title: commands::title(&job.documents, &command, &args),
                ..WorkDoneProgressBegin::default()
            }));
            let done = commands::run(&job.documents, &command, args);
            report(WorkDoneProgress::End(WorkDoneProgressEnd {
                message: done.as_ref().ok().and_then(|done| done.message.clone()),
            }));
            let result = done.and_then(|done| {
                serde_json::to_value(done.outcome)
                    .map_err(|e| error(ErrorCode::InternalError, e.to_string()))
            });
            send(
                Response {
                    id: job.id,
                    response_result: result,
                }
                .into(),
            );
        }
    });
    (jobs, thread)
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
            completion_provider: Some(CompletionOptions {
                trigger_characters: Some(vec![" ".to_string()]),
                ..CompletionOptions::default()
            }),
            document_symbol_provider: Some(OneOf::Left(true)),
            inlay_hint_provider: Some(OneOf::Left(true)),
            code_action_provider: Some(CodeActionProviderCapability::Options(CodeActionOptions {
                code_action_kinds: Some(vec![CodeActionKind::REFACTOR_REWRITE]),
                ..CodeActionOptions::default()
            })),
            execute_command_provider: Some(ExecuteCommandOptions {
                commands: commands::COMMANDS.map(String::from).to_vec(),
                ..ExecuteCommandOptions::default()
            }),
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
    #[allow(deprecated, reason = "older clients send only `rootUri`")]
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
    /// The commands for the worker.
    jobs: Sender<Job>,
}

impl Server {
    fn on_request(&mut self, request: Request) {
        if !self.shut_down && request.method == ExecuteCommand::METHOD {
            return self.execute(request);
        }
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
                Completion::METHOD => handle::<Completion>(request.params, |params| {
                    Ok(completion::complete(&self.documents, params))
                }),
                DocumentSymbolRequest::METHOD => {
                    handle::<DocumentSymbolRequest>(request.params, |params| {
                        Ok(symbols::symbols(&self.documents, params))
                    })
                }
                CodeActionRequest::METHOD => {
                    handle::<CodeActionRequest>(request.params, |params| {
                        Ok(actions::actions(&self.documents, params))
                    })
                }
                requests::FIELDS => answer(requests::FIELDS, request.params, |params| {
                    Ok(requests::fields(&self.documents, params))
                }),
                actions::SET_FIELD => answer(actions::SET_FIELD, request.params, |params| {
                    actions::set_field(&self.documents, params)
                }),
                InlayHintRequest::METHOD => handle::<InlayHintRequest>(request.params, |params| {
                    Ok(Some(hints::hints(&self.documents, params)))
                }),
                requests::ITEMS => answer(requests::ITEMS, request.params, |params| {
                    Ok(requests::items_of(&self.documents, params))
                }),
                requests::COMMENTS => answer(requests::COMMENTS, request.params, |params| {
                    Ok(requests::comments(&self.documents, params))
                }),
                commands::CAN_COMMENT => answer(commands::CAN_COMMENT, request.params, |params| {
                    commands::can_comment(&self.documents, params)
                }),
                requests::VERDICT => answer(requests::VERDICT, request.params, |params| {
                    requests::verdict(&self.documents, params)
                }),
                requests::WAITING => answer(requests::WAITING, request.params, |_: Value| {
                    requests::waiting(&self.documents)
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

    /// Hands a known command to the worker, which answers it; refuses an unknown one at once.
    fn execute(&mut self, request: Request) {
        let params = serde_json::from_value::<ExecuteCommandParams>(request.params)
            .map_err(|e| {
                error(
                    ErrorCode::InvalidParams,
                    format!("{}: {e}", ExecuteCommand::METHOD),
                )
            })
            .and_then(|params| {
                if commands::COMMANDS.contains(&params.command.as_str()) {
                    Ok(params)
                } else {
                    Err(error(
                        ErrorCode::InvalidParams,
                        format!("unknown command {}", params.command),
                    ))
                }
            });
        match params {
            Ok(params) => {
                let job = Job {
                    id: request.id,
                    params,
                    documents: self.documents.clone(),
                };
                // The worker lives as long as the loop.
                let _ = self.jobs.send(job);
            }
            Err(refused) => self.send(Response {
                id: request.id,
                response_result: Err(refused),
            }),
        }
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
    answer_with: impl FnOnce(R::Params) -> Result<R::Result, ResponseError>,
) -> Result<Value, ResponseError>
where
    R::Params: DeserializeOwned,
    R::Result: Serialize,
{
    answer(R::METHOD, params, answer_with)
}

/// Answers a request of `method` with `answer`, or refuses params that do not match `P`: the
/// custom `uraeda/*` requests, whose results are the core's types.
fn answer<P: DeserializeOwned, T: Serialize>(
    method: &str,
    params: Value,
    answer: impl FnOnce(P) -> Result<T, ResponseError>,
) -> Result<Value, ResponseError> {
    let params = serde_json::from_value(params)
        .map_err(|e| error(ErrorCode::InvalidParams, format!("{method}: {e}")))?;
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
