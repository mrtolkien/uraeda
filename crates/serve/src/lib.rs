//! `ura serve`: the pages a human answers a round and reviews a spec or a plan on, from the `ura`
//! binary alone. Every page is HTML the server writes, readable without a script, with one style
//! sheet and one script embedded in the binary: nothing is fetched from outside.
//!
//! The pages write files and never commit, branch, or make a worktree: the next agent step commits
//! the human's work. Every address starts with a token, `/<token>/`, and every write must come from
//! the page's own origin (see [`guard`]).

pub mod assets;
pub mod config;
pub mod guard;
pub mod html;
pub mod token;
pub mod waiting;
pub mod wake;

use std::net::{Ipv4Addr, SocketAddr};
use std::path::PathBuf;
use std::sync::Arc;

use axum::Router;
use axum::extract::State;
use axum::response::Html;
use axum::routing::get;

pub use config::Settings;

/// The port `ura serve` listens on when nothing names another: today's server keeps 4310.
pub const DEFAULT_PORT: u16 = 4320;

/// How `ura serve` starts.
pub struct Options {
    /// The port, over the settings' own.
    pub port: Option<u16>,
    /// The folder of `config.toml`.
    pub config_dir: PathBuf,
    /// The folder the token is kept in.
    pub data_dir: PathBuf,
    /// The folder `ura serve` was started in: its repository is served when the settings name none.
    pub cwd: PathBuf,
}

/// What every request reads: the token and the settings, as read at the start.
pub struct Shared {
    pub token: String,
    pub settings: Settings,
}

#[derive(Debug, thiserror::Error)]
pub enum ServeError {
    #[error("{0}")]
    Config(#[from] config::ConfigError),
    #[error("the token could not be kept in {0}: {1}")]
    Token(PathBuf, std::io::Error),
    #[error("port {0} could not be opened: {1}")]
    Listen(u16, std::io::Error),
    #[error("{0}")]
    Io(#[from] std::io::Error),
}

/// Every route, behind the guard.
pub fn router(shared: Arc<Shared>) -> Router {
    Router::new()
        .route("/{token}/", get(home))
        .route("/{token}/a/{version}/{name}", get(assets::serve))
        .fallback(not_found)
        .layer(axum::middleware::from_fn_with_state(
            shared.clone(),
            guard::guard,
        ))
        .with_state(shared)
}

async fn home(State(shared): State<Arc<Shared>>) -> Html<String> {
    let settings = shared.settings.clone();
    let waiting = tokio::task::spawn_blocking(move || waiting::read(&settings))
        .await
        .unwrap_or_default();
    Html(html::page("What waits on you", &waiting::render(&waiting)))
}

async fn not_found() -> (axum::http::StatusCode, Html<String>) {
    (
        axum::http::StatusCode::NOT_FOUND,
        Html(html::page(
            "Not found",
            "<main><h1>Not found</h1><p>This page does not exist.</p></main>",
        )),
    )
}

/// Reads the settings and the token, then serves until stopped, on this machine's loopback only:
/// a phone reaches it through `tailscale serve`. Prints the address with its token first.
pub fn run(options: Options) -> Result<(), ServeError> {
    let settings = config::read(&options.config_dir, &options.cwd)?;
    let token = token::keep(&options.data_dir)
        .map_err(|error| ServeError::Token(options.data_dir.clone(), error))?;
    let port = options.port.or(settings.port).unwrap_or(DEFAULT_PORT);
    let shared = Arc::new(Shared { token, settings });
    let runtime = tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()?;
    runtime.block_on(async move {
        let address = SocketAddr::from((Ipv4Addr::LOCALHOST, port));
        let listener = tokio::net::TcpListener::bind(address)
            .await
            .map_err(|error| ServeError::Listen(port, error))?;
        let port = listener.local_addr()?.port();
        println!("http://127.0.0.1:{port}/{}/", shared.token);
        axum::serve(listener, router(shared))
            .with_graceful_shutdown(async {
                let _ = tokio::signal::ctrl_c().await;
            })
            .await?;
        Ok(())
    })
}
