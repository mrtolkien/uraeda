//! A start: the data folder's lock, the port taken, or handed over to the server already running; the status file; then
//! each domain, in order.

use std::io::ErrorKind;
use std::net::Ipv4Addr;
use std::path::Path;
use std::time::{Duration, Instant};

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
    /// Another server holds the data folder, and did not take the start's folder.
    #[error("{0}")]
    Held(String),
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
    // The data folder's lock before its status and its stores: two starts on one folder, whatever
    // their ports, never both open its stores.
    let lock = hold(&options).await?;
    let (asked, asked_by) = crate::port::asked_port(&options).map_err(NotStarted::Failed)?;
    let listener = listen(&options, asked).await?;
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
    let no_scheduled_jobs = options.no_scheduled_jobs;
    let sandbox = options.sandbox;
    let call_limit = options.extension_call_limit;
    let shared = Shared::new(options, port, token);
    shared.provide(crate::port::PortFrom(asked_by));
    if no_scheduled_jobs {
        shared.provide(crate::jobs::NoScheduledJobs);
    }
    if let Some(mode) = sandbox {
        shared.provide(mode);
    }
    if let Some(limit) = call_limit {
        shared.provide(crate::extensions::CallLimit(limit));
    }
    // The core starts git itself, in the process's environment: it adds the config folder's
    // secrets, so a hook gets what every process the server runs gets, until the server stops.
    uraeda_core::git::set_environment(shared.environment().added());
    shared.on_stop("environment", async {
        uraeda_core::git::set_environment(Vec::new());
    });
    let mut server = Server {
        shared: shared.clone(),
        lock,
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
        say_err!("uraeda: {problem}");
    }
    server.routes = routes.paths();
    let router = http::router(&shared, routes);
    server.serving = Some(tokio::spawn(http::serve(listener, router, shared)));
    Ok(server)
}

/// How long a start waits for a held lock, by default: the longest a server's normal stop takes,
/// its agents' 5 seconds to end before they are killed, then its requests' 5 seconds of `GRACE`.
/// A server that answers is handed the start at once: only one that stops, or is stuck, is waited
/// for.
const LOCK_WAIT: Duration = Duration::from_secs(10);

/// How often a waiting start asks for the lock again.
const LOCK_POLL: Duration = Duration::from_millis(25);

/// The data folder's lock. When another server holds it, the start's folder goes to that server
/// when its status file names it and it answers: one data folder has one server, whatever port this
/// start asks for. Otherwise the lock is waited for: a server that stops no longer answers, and
/// removes its status file only at the end of its stop, before it lets the lock go; another
/// process that stops lets it go when its process ends. Only a lock still held past the wait is
/// refused, naming the server that did not answer, or one that is starting.
async fn hold(options: &Options) -> Result<status::Lock, NotStarted> {
    let data_dir = &options.data_dir;
    let deadline = Instant::now() + options.lock_wait.unwrap_or(LOCK_WAIT);
    loop {
        let lock = status::lock(data_dir).map_err(|error| {
            let path = data_dir.join("run").join(status::LOCK);
            NotStarted::Failed(format!("cannot lock {}: {error}", path.display()))
        })?;
        if let Some(lock) = lock {
            return Ok(lock);
        }
        // The server the status file names, when it did not answer.
        let silent = status::read(data_dir);
        if let Some(running) = &silent {
            let folder = options.folder.as_deref();
            let handed = hand_over(running.port, Some(&running.token), folder).await;
            if let Some(ended) = handed_over(running.port, handed) {
                return Err(ended);
            }
        }
        if Instant::now() >= deadline {
            return Err(NotStarted::Held(held(data_dir, silent.as_ref())));
        }
        tokio::time::sleep(LOCK_POLL).await;
    }
}

/// Why a start was refused a folder whose lock stayed held: the server that did not answer, or one
/// that is starting.
fn held(data_dir: &Path, silent: Option<&status::Status>) -> String {
    match silent {
        Some(running) => format!(
            "the data folder {} is held by the Uraeda server at http://127.0.0.1:{} (process {}), \
             which did not answer: stop it, or pass another --data-dir",
            data_dir.display(),
            running.port,
            running.pid
        ),
        None => format!(
            "another Uraeda server is starting on the data folder {}: wait for it, or stop it",
            data_dir.display()
        ),
    }
}

/// Takes the port asked for, on the loopback interface only.
async fn listen(options: &Options, port: u16) -> Result<TcpListener, NotStarted> {
    match TcpListener::bind((Ipv4Addr::LOCALHOST, port)).await {
        Ok(listener) => Ok(listener),
        Err(error) if error.kind() == ErrorKind::AddrInUse => {
            Err(taken(port, options.folder.as_deref()).await)
        }
        Err(error) => Err(NotStarted::Failed(format!(
            "cannot listen on port {port}: {error}"
        ))),
    }
}

/// Why the port is taken: by another Uraeda, or by another program. This data folder's server
/// is not on it: the start holds the folder's lock.
async fn taken(port: u16, folder: Option<&Path>) -> NotStarted {
    let handed = hand_over(port, None, folder).await;
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
