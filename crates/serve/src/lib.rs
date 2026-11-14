//! `ura serve`: the pages a human answers a round and reviews a spec or a plan on, from the `ura`
//! binary alone. Every page is HTML the server writes, readable without a script, with one style
//! sheet and one script embedded in the binary: nothing is fetched from outside.
//!
//! The pages write files and never commit, branch, or make a worktree: the next agent step commits
//! the human's work. Every address starts with a token, `/<token>/`, and every write must come from
//! the page's own origin (see [`guard`]).

pub mod assets;
pub mod config;
pub mod files;
pub mod guard;
pub mod html;
pub mod render;
pub mod review;
pub mod round;
pub mod settings;
pub mod token;
pub mod waiting;
pub mod wake;

use std::net::{Ipv4Addr, SocketAddr};
use std::path::PathBuf;
use std::sync::Arc;

use axum::Router;
use axum::extract::State;
use axum::response::Html;
use axum::routing::{get, post};

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

/// What every request reads: the token, the settings, and where they are kept.
pub struct Shared {
    pub token: String,
    settings: std::sync::RwLock<Settings>,
    /// The folder of `config.toml`, which the settings page writes.
    pub config_dir: PathBuf,
    /// Held by every write, for its whole read-change-write: two saves at once, of two questions
    /// of a round, never write over each other.
    pub writes: std::sync::Mutex<()>,
}

impl Shared {
    pub fn new(token: String, settings: Settings, config_dir: PathBuf) -> Shared {
        Shared {
            token,
            settings: std::sync::RwLock::new(settings),
            config_dir,
            writes: std::sync::Mutex::new(()),
        }
    }

    /// The settings as they stand now.
    pub fn settings(&self) -> Settings {
        self.settings
            .read()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
            .clone()
    }

    /// Changes the settings in memory, once their file holds the change.
    pub fn update(&self, change: impl FnOnce(&mut Settings)) {
        change(
            &mut self
                .settings
                .write()
                .unwrap_or_else(std::sync::PoisonError::into_inner),
        );
    }
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
        .route("/{token}/settings", get(settings::page))
        .route("/{token}/settings/runs", post(settings::save_runs))
        .route("/{token}/settings/serve", post(settings::save_serve))
        .route("/{token}/{repo}/{folder}/round", get(round::routes::page))
        .route("/{token}/{repo}/{folder}/file/{*path}", get(files::page))
        .route("/{token}/{repo}/{folder}/raw/{*path}", get(files::raw))
        .route("/{token}/{repo}/{folder}/answer", post(round::routes::save))
        .route("/{token}/{repo}/{folder}/notes", post(round::routes::notes))
        .route(
            "/{token}/{repo}/{folder}/settled",
            post(round::routes::settled),
        )
        .route(
            "/{token}/{repo}/{folder}/submit",
            post(round::routes::submit),
        )
        .route(
            "/{token}/{repo}/{folder}/review/{file}",
            get(review::routes::page),
        )
        .route(
            "/{token}/{repo}/{folder}/review/{file}/comment",
            post(review::routes::comment),
        )
        .route(
            "/{token}/{repo}/{folder}/review/{file}/verdict",
            post(review::routes::verdict),
        )
        .fallback(not_found)
        .layer(axum::middleware::from_fn_with_state(
            shared.clone(),
            guard::guard,
        ))
        .with_state(shared)
}

async fn home(State(shared): State<Arc<Shared>>) -> Html<String> {
    let settings = shared.settings();
    let waiting = tokio::task::spawn_blocking(move || waiting::read(&settings))
        .await
        .unwrap_or_default();
    let body = waiting::render(&waiting).replacen(
        "</main>",
        "<p class=\"settings-link\"><a class=\"button\" href=\"settings\">Settings: how each \
         step runs</a></p></main>",
        1,
    );
    Html(html::page("What waits on you", &body))
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
    let shared = Arc::new(Shared::new(token, settings, options.config_dir));
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
