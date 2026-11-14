//! Uraeda's server, everything `ura serve-app` does: the routes, sign-in, live records, files, agent
//! runs, previews, and extensions. It calls the core directly, and owns every durable fact.
//!
//! # Adding a domain
//!
//! A domain, as sign-in, the live engine, or the previews, is a module with a function
//! `mount(&Shared, &mut Routes) -> Result<(), Failure>`, and its one line in [`DOMAINS`]. As the
//! server starts, `mount`:
//!
//! - adds its routes, `routes.route("/pair", post(pair))`: a handler takes `State<Shared>`;
//! - provides its state to the other domains, `shared.provide(Store::open(..)?)`, which they
//!   read by its type, `shared.get::<Store>()`;
//! - registers what stops with the server, `shared.on_stop("previews", async move { .. })`: a
//!   command, a child process, a VM. [`Server::stop`] runs them all, and nothing else stops them;
//! - registers what reads its records and runs its actions with the live engine's
//!   `shared.get::<Registry>()`, and says what changed on `shared.get::<Bus>()`: see [`live`]. A
//!   domain that is only records and actions is a file of `records/`, with its line there.
//!
//! A rule every request passes, as the guard, is a layer in `http::router`. A process the server
//! runs starts from `shared.environment().command(..)`. A time is `shared.now()`. A line printed
//! is `say!` or `say_err!`, which never panic.

// A closed stdout or stderr makes `println!` and `eprintln!` panic: see `say`.
#![warn(clippy::print_stdout, clippy::print_stderr)]

#[macro_use]
mod say;
pub mod browser;
mod clock;
mod env;
pub mod extensions;
mod files;
pub mod guard;
mod handoff;
mod http;
pub mod jobs;
pub mod live;
pub mod mcp;
mod paths;
mod port;
pub mod preview;
mod process;
mod records;
mod run;
pub mod runner;
pub mod runtimes;
pub mod sandbox;
pub mod secret;
mod shared;
pub mod sign_in;
mod start;
pub mod status;
mod stop;

use std::path::PathBuf;
use std::time::Duration;

use tokio::task::JoinHandle;

pub use clock::Clock;
pub use env::Environment;
pub use http::Routes;
pub use port::asked_port;
pub use run::run;
pub use shared::Shared;
pub use start::{Holder, NotStarted};

/// The port `ura serve-app` listens on when nothing gives one: the port Uraeda's server always had.
pub const DEFAULT_PORT: u16 = 4310;

/// How long open requests get to end once the server stops.
const GRACE: Duration = Duration::from_secs(5);

/// Why a domain could not start.
pub type Failure = Box<dyn std::error::Error + Send + Sync>;

/// How a domain joins the server: see [the crate's documentation](crate#adding-a-domain).
type Mount = fn(&Shared, &mut Routes) -> Result<(), Failure>;

/// The server's domains, in the order they start, and the reverse of the order they stop in. A
/// domain may use what the ones before it provide.
const DOMAINS: &[Mount] = &[
    live::mount,
    sign_in::mount,
    runner::mount,
    runtimes::mount,
    http::open::mount,
    http::diagram::mount,
    http::socket::mount,
    files::mount,
    mcp::mount,
    preview::mount,
    extensions::mount,
    runner::serve,
    jobs::mount,
    sandbox::mount,
];

/// How a server starts.
#[derive(Clone, Debug)]
pub struct Options {
    /// `--port`: the port to listen on, on 127.0.0.1, where 0 takes a free one. Without it,
    /// the port is `URAEDA_PORT`'s, else the settings file's, else [`DEFAULT_PORT`]: see
    /// [`asked_port`].
    pub port: Option<u16>,
    /// The config folder: the settings, the themes, the extensions, and the `.env` of secrets.
    pub config_dir: PathBuf,
    /// The data folder, which one server at a time owns.
    pub data_dir: PathBuf,
    /// The folder the server starts in, whose repository joins its list: a second start hands
    /// its own to the first.
    pub folder: Option<PathBuf>,
    /// The environment the server starts in: the process's, for `ura serve-app`.
    pub environment: Vec<(String, String)>,
    /// Origins accepted besides the server's own and the allowed hosts', like a development
    /// server's.
    pub allow_origins: Vec<String>,
    /// The server's clock: the system's, but in tests.
    pub clock: Clock,
    /// `ura serve-app --no-scheduled-jobs`: no job starts at its times, whatever the settings say.
    pub no_scheduled_jobs: bool,
    /// `ura sandbox`: the sample projects' server, on the fake agent alone, its list locked, and
    /// without sign-in unless its mode keeps it. Only code sets it.
    pub sandbox: Option<sandbox::Mode>,
    /// How long a piece of an extension's server code may run once it is loaded: none for its
    /// 10 seconds. Only a test of that limit sets it, to see it cut off sooner.
    pub extension_call_limit: Option<Duration>,
    /// How long a start waits for a data folder's lock that another server holds and does not hand
    /// over, as one stopping does: none for its 10 seconds. Only a test sets it.
    pub lock_wait: Option<Duration>,
}

/// A running server.
pub struct Server {
    shared: Shared,
    /// The data folder's lock, let go once the server has stopped.
    lock: status::Lock,
    routes: Vec<&'static str>,
    serving: Option<JoinHandle<()>>,
}

impl Server {
    /// Starts a server on 127.0.0.1, or hands the start's folder to the one already running on
    /// its data folder.
    ///
    /// # Errors
    ///
    /// [`NotStarted`]: handed over to the running server, the port taken by another program or
    /// another data folder's server, or a domain that could not start.
    pub async fn start(options: Options) -> Result<Server, NotStarted> {
        start::start(options).await
    }

    /// The port the server listens on.
    pub fn port(&self) -> u16 {
        self.shared.port()
    }

    /// The server's address on its own machine, `http://127.0.0.1:<port>`.
    pub fn address(&self) -> String {
        self.shared.address()
    }

    /// The state the server's domains share.
    pub fn shared(&self) -> &Shared {
        &self.shared
    }

    /// The paths of the server's routes, as their domains declared them.
    pub fn routes(&self) -> Vec<&'static str> {
        self.routes.clone()
    }

    /// Stops the server: it takes no new connection, runs the work its domains registered with
    /// `Shared::on_stop`, the last registered first, each to its end, gives open requests a
    /// moment to end, and removes its status file. Everything that stops with the server is
    /// registered there.
    pub async fn stop(self) {
        self.shared.stops().run().await;
        if let Some(mut serving) = self.serving
            && tokio::time::timeout(GRACE, &mut serving).await.is_err()
        {
            // A request that never ends does not keep the server from stopping.
            serving.abort();
        }
        status::remove(self.shared.data_dir());
        drop(self.lock);
    }
}
