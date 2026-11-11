//! Uraeda's server, everything `ura serve` does: the routes, sign-in, live records, files, agent
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
//! runs starts from `shared.environment().command(..)`. A time is `shared.now()`.

mod clock;
mod env;
pub mod extensions;
mod files;
pub mod guard;
mod handoff;
mod http;
pub mod live;
pub mod mcp;
pub mod preview;
mod process;
mod records;
mod run;
pub mod runner;
pub mod runtimes;
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
pub use run::run;
pub use shared::Shared;
pub use start::{Holder, NotStarted};

/// The port `ura serve` listens on by default.
///
/// TEMPORARY: apart from the Node server's 4310 while both exist: it becomes that port when the
/// Node server goes (task 61).
pub const DEFAULT_PORT: u16 = 4320;

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
    http::socket::mount,
    files::mount,
    mcp::mount,
    preview::mount,
    extensions::mount,
];

/// The data folder `ura serve` keeps its files in by default: the core's data folder, with
/// `-next` after its name, as `~/.local/share/uraeda-next`.
///
/// TEMPORARY: apart from the Node server's while both exist (task 61).
pub fn default_data_dir() -> PathBuf {
    let mut folder = uraeda_core::repositories::default_data_dir().into_os_string();
    folder.push("-next");
    folder.into()
}

/// How a server starts.
#[derive(Clone, Debug)]
pub struct Options {
    /// The port to listen on, on 127.0.0.1: 0 takes a free one.
    pub port: u16,
    /// The config folder: the settings, the themes, the extensions, and the `.env` of secrets.
    pub config_dir: PathBuf,
    /// The data folder, which one server at a time owns.
    pub data_dir: PathBuf,
    /// The folder the server starts in, whose repository joins its list: a second start hands
    /// its own to the first.
    pub folder: Option<PathBuf>,
    /// The environment the server starts in: the process's, for `ura serve`.
    pub environment: Vec<(String, String)>,
    /// Origins accepted besides the server's own and the allowed hosts', like a development
    /// server's.
    pub allow_origins: Vec<String>,
    /// The server's clock: the system's, but in tests.
    pub clock: Clock,
}

/// A running server.
pub struct Server {
    shared: Shared,
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
    }
}
