//! A start: the port taken, or handed over to the server already running; the status file; then
//! each domain, in order.

use std::io::ErrorKind;
use std::net::Ipv4Addr;
use std::path::Path;

use tokio::net::TcpListener;

use crate::handoff::{HandOff, hand_over};
use crate::http::{self, Routes};
use crate::shared::Shared;
use crate::{DOMAINS, Options, Server, status};

/// Why a start did not give a server.
#[derive(Clone, Debug, PartialEq, Eq, thiserror::Error)]
pub enum NotStarted {
    /// The data folder's server already runs: it took the start's folder, and answered its page.
    #[error("Uraeda already runs at {address}{url}")]
    HandedOver { address: String, url: String },
    /// The data folder's server already runs, and refused the start's folder.
    #[error("{0}")]
    Refused(String),
    /// The port is not free, and not this data folder's server's.
    #[error("port {port} is used by {by}")]
    PortTaken { port: u16, by: Holder },
    /// The server could not start.
    #[error("{0}")]
    Failed(String),
}

/// Who holds a port.
#[derive(Clone, Copy, Debug, PartialEq, Eq, thiserror::Error)]
pub enum Holder {
    /// An Uraeda server that refused this data folder's host token.
    #[error("an Uraeda server with another data folder")]
    Uraeda,
    /// A program that does not answer as Uraeda.
    #[error("another program: pass --port to use another one")]
    Other,
}

/// Starts a server, or hands over to the one running.
pub(crate) async fn start(options: Options) -> Result<Server, NotStarted> {
    let failed = |error: std::io::Error| NotStarted::Failed(error.to_string());
    let listener = listen(&options).await?;
    let port = listener.local_addr().map_err(failed)?.port();
    // The status file before the rest of the start: a second start meanwhile finds the token,
    // and waits for the answer.
    let token = status::write(&options.data_dir, port)
        .map_err(|error| {
            let path = status::path(&options.data_dir);
            NotStarted::Failed(format!("cannot write {}: {error}", path.display()))
        })?
        .token;
    let folder = options.folder.clone();
    let shared = Shared::new(options, port, token);
    // The core starts git itself, in the process's environment: it adds the config folder's
    // secrets, so a hook gets what every process the server runs gets, until the server stops.
    uraeda_core::git::set_environment(shared.environment().added());
    shared.on_stop("environment", async {
        uraeda_core::git::set_environment(Vec::new());
    });
    let mut server = Server {
        shared: shared.clone(),
        routes: Vec::new(),
        serving: None,
    };
    let mut routes = Routes::default();
    for mount in DOMAINS {
        if let Err(failure) = mount(&shared, &mut routes) {
            // What the domains before it started stops with it.
            server.stop().await;
            return Err(NotStarted::Failed(failure.to_string()));
        }
    }
    if let Err(problem) = http::open::open_folder(&shared, folder).await {
        // The list's problem shows where the list does: it never keeps the server from starting.
        eprintln!("uraeda: {problem}");
    }
    server.routes = routes.paths();
    let router = http::router(&shared, routes);
    server.serving = Some(tokio::spawn(http::serve(listener, router, shared)));
    Ok(server)
}

/// Takes the port, on the loopback interface only. Before that, a server its status file names is
/// asked to take the folder: one data folder has one server, whatever port this start asks for.
async fn listen(options: &Options) -> Result<TcpListener, NotStarted> {
    let folder = options.folder.as_deref();
    if let Some(running) = status::read(&options.data_dir) {
        let handed = hand_over(running.port, Some(&running.token), folder).await;
        // A status file whose server does not answer to its token is one a killed server left.
        if let Some(over) = handed_over(running.port, handed) {
            return Err(over);
        }
    }
    match TcpListener::bind((Ipv4Addr::LOCALHOST, options.port)).await {
        Ok(listener) => Ok(listener),
        Err(error) if error.kind() == ErrorKind::AddrInUse => Err(taken(options, folder).await),
        Err(error) => Err(NotStarted::Failed(format!(
            "cannot listen on port {}: {error}",
            options.port
        ))),
    }
}

/// Why the port is taken: by this data folder's server, which took it since its status file was
/// read, by another Uraeda, or by another program.
async fn taken(options: &Options, folder: Option<&Path>) -> NotStarted {
    let port = options.port;
    let token = status::read(&options.data_dir)
        .filter(|running| running.port == port)
        .map(|running| running.token);
    let handed = hand_over(port, token.as_deref(), folder).await;
    let by = match handed {
        HandOff::Unauthorized => Holder::Uraeda,
        _ => Holder::Other,
    };
    handed_over(port, handed).unwrap_or(NotStarted::PortTaken { port, by })
}

/// The end of a start whose folder the server on `port` took, or refused.
fn handed_over(port: u16, handed: HandOff) -> Option<NotStarted> {
    match handed {
        HandOff::Opened(url) => Some(NotStarted::HandedOver {
            address: format!("http://127.0.0.1:{port}"),
            url,
        }),
        HandOff::Refused(error) => Some(NotStarted::Refused(error)),
        HandOff::Unauthorized | HandOff::Other => None,
    }
}
