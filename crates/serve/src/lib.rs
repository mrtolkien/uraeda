//! `ura serve`: the pages a human answers a round and reviews a spec or a plan on, from the `ura`
//! binary alone. Every page is HTML the server writes, readable without a script, with one style
//! sheet and one script embedded in the binary: nothing is fetched from outside.
//!
//! The pages write files and never commit, branch, or make a worktree: the next agent step commits
//! the human's work. A page opens to a browser signed in with the token, and every write must come
//! from the page's own origin (see [`guard`]).

pub mod assets;
pub mod config;
pub mod files;
pub mod guard;
pub mod html;
pub mod login;
pub mod marks;
pub mod providers;
pub mod render;
pub mod review;
pub mod round;
pub mod settings;
pub mod sync;
pub mod token;
pub mod usage;
pub mod vault_page;
pub mod waiting;
pub mod wake;

use std::net::{Ipv4Addr, SocketAddr};
use std::path::PathBuf;
use std::sync::Arc;

use axum::Router;
use axum::extract::DefaultBodyLimit;
use axum::extract::State;
use axum::response::Html;
use axum::routing::{get, post};

pub use config::Settings;

/// The port `ura serve` listens on when nothing names another.
pub const DEFAULT_PORT: u16 = 4310;

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
    /// What a signed-in browser's cookie holds: see [`token::session`].
    pub session: String,
    /// The key in the address of a feature's files: see [`token::files_key`].
    pub files_key: String,
    settings: std::sync::RwLock<Settings>,
    /// The folder of `config.toml`, which the settings page writes.
    pub config_dir: PathBuf,
    /// Held by every write, for its whole read-change-write: two saves at once, of two questions
    /// of a round, never write over each other.
    pub writes: std::sync::Mutex<()>,
    /// The agents' models, as last listed, and when: kept 10 minutes, as listing them takes a
    /// few seconds. `None` once, before the first listing; a list given by a test never expires.
    agents: std::sync::Mutex<Option<(Option<std::time::Instant>, Vec<providers::Provider>)>>,
    /// The vault synced with the phone: none until one is given.
    vault: std::sync::RwLock<Option<uraeda_vault::Vault>>,
    /// The vault's hashes, kept between two syncs.
    pub hashes: uraeda_vault::manifest::Hashes,
    /// When the vault's folders and links were last made again.
    pub refreshed: std::sync::Mutex<Option<std::time::Instant>>,
    /// Uraeda's data folder, whose `Uraeda` is the vault when the settings name none.
    pub data_dir: Option<PathBuf>,
}

impl Shared {
    pub fn new(token: String, settings: Settings, config_dir: PathBuf) -> Shared {
        Shared {
            session: token::session(&token),
            files_key: token::files_key(&token),
            token,
            settings: std::sync::RwLock::new(settings),
            config_dir,
            writes: std::sync::Mutex::new(()),
            agents: std::sync::Mutex::new(None),
            vault: std::sync::RwLock::new(None),
            hashes: uraeda_vault::manifest::Hashes::default(),
            refreshed: std::sync::Mutex::new(None),
            data_dir: None,
        }
    }

    /// The same, knowing Uraeda's data folder.
    #[must_use]
    pub fn with_data_dir(mut self, data_dir: PathBuf) -> Shared {
        self.data_dir = Some(data_dir);
        self
    }

    /// The same, syncing `vault`.
    #[must_use]
    pub fn with_vault(self, vault: uraeda_vault::Vault) -> Shared {
        self.set_vault(vault);
        self
    }

    /// The vault synced with the phone.
    pub fn vault(&self) -> Option<uraeda_vault::Vault> {
        self.vault
            .read()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
            .clone()
    }

    /// Syncs another vault from now on: its folders and links are made at the next sync.
    pub fn set_vault(&self, vault: uraeda_vault::Vault) {
        *self
            .vault
            .write()
            .unwrap_or_else(std::sync::PoisonError::into_inner) = Some(vault);
        *self
            .refreshed
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner) = None;
    }

    /// The same, its agents and models given, never listed: for tests.
    #[must_use]
    pub fn with_agents(self, agents: Vec<providers::Provider>) -> Shared {
        *self
            .agents
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner) = Some((None, agents));
        self
    }

    /// The agents and their models: as last listed, or listed again when that is more than 10
    /// minutes ago. Blocks while it lists them.
    pub fn agents(&self) -> Vec<providers::Provider> {
        let mut held = self
            .agents
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        let fresh = |at: &Option<std::time::Instant>| {
            at.is_none_or(|at| at.elapsed() < std::time::Duration::from_secs(600))
        };
        match held.as_ref() {
            Some((at, agents)) if fresh(at) => agents.clone(),
            _ => {
                let agents = providers::read();
                *held = Some((Some(std::time::Instant::now()), agents.clone()));
                agents
            }
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
    #[error("{0}")]
    Vault(#[from] uraeda_vault::config::ConfigError),
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
        .route("/", get(home))
        .route("/login", get(login::page).post(login::sign_in))
        .route("/a/{version}/{name}", get(assets::serve))
        .route("/settings", get(settings::page))
        .route("/settings/runs", post(settings::save_runs))
        .route("/settings/serve", post(settings::save_serve))
        .route("/{repo}/{folder}/round", get(round::routes::page))
        .route("/{repo}/{folder}/file/{*path}", get(files::page))
        .route("/{repo}/{folder}/raw/{key}/{*path}", get(files::raw))
        .route("/{repo}/{folder}/answer", post(round::routes::save))
        .route("/{repo}/{folder}/notes", post(round::routes::notes))
        .route("/{repo}/{folder}/settled", post(round::routes::settled))
        .route("/{repo}/{folder}/submit", post(round::routes::submit))
        .route("/{repo}/{folder}/review/{file}", get(review::routes::page))
        .route(
            "/{repo}/{folder}/review/{file}/comment",
            post(review::routes::comment),
        )
        .route(
            "/{repo}/{folder}/review/{file}/verdict",
            post(review::routes::verdict),
        )
        .route("/vault", get(vault_page::page_route))
        .route("/vault/place", post(vault_page::save_place))
        .route("/vault/start.zip", get(vault_page::start_zip))
        .route(
            "/vault/plan",
            post(sync::plan).layer(DefaultBodyLimit::max(sync::MAX_PLAN)),
        )
        .route(
            "/vault/file",
            get(sync::get_file)
                .put(sync::put_file)
                .delete(sync::delete_file)
                .layer(DefaultBodyLimit::max(sync::MAX_FILE)),
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
    let vault = shared.vault().map(|v| v.name());
    let body = waiting::render(&waiting, vault.as_deref()).replacen(
        "</main>",
        "<p class=\"settings-link\"><a class=\"button\" href=\"settings\">Settings: how each \
         step runs</a> <a class=\"button\" href=\"vault\">Obsidian setup</a></p></main>",
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
/// a phone reaches it through `tailscale serve`. Prints the address, then the token, first.
pub fn run(options: Options) -> Result<(), ServeError> {
    let settings = config::read(&options.config_dir, &options.cwd)?;
    let token = token::keep(&options.data_dir)
        .map_err(|error| ServeError::Token(options.data_dir.clone(), error))?;
    let port = options.port.or(settings.port).unwrap_or(DEFAULT_PORT);
    let vault = uraeda_vault::Vault::locate(&options.config_dir, &options.data_dir)?;
    let shared = Arc::new(
        Shared::new(token, settings, options.config_dir)
            .with_vault(vault)
            .with_data_dir(options.data_dir.clone()),
    );
    sync::refresh_now(&shared, std::time::Duration::ZERO);
    // The agents' models, listed as the server starts: the settings page finds them ready.
    let listing = Arc::clone(&shared);
    std::thread::spawn(move || listing.agents());
    let runtime = tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()?;
    runtime.block_on(async move {
        let address = SocketAddr::from((Ipv4Addr::LOCALHOST, port));
        let listener = tokio::net::TcpListener::bind(address)
            .await
            .map_err(|error| ServeError::Listen(port, error))?;
        let port = listener.local_addr()?.port();
        let pages = format!("http://127.0.0.1:{port}/");
        println!("{pages}");
        println!("token: {}", shared.token);
        if let Some(vault) = shared.vault() {
            let _ = uraeda_vault::plugin::configure_desktop(&vault, &pages);
            println!("vault: {}", vault.root().display());
        }
        axum::serve(listener, router(shared))
            .with_graceful_shutdown(async {
                let _ = tokio::signal::ctrl_c().await;
            })
            .await?;
        Ok(())
    })
}
