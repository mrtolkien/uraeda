//! What the server's domains share: where it runs, its clock and environment, the state each
//! domain provides for the others, and the work that stops with the server.

use std::any::{Any, TypeId, type_name};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, PoisonError, RwLock};
use std::time::SystemTime;

use axum::http::{HeaderMap, header};

use crate::clock::Clock;
use crate::env::Environment;
use crate::stop::Stops;
use crate::{Options, secret};

/// The server's shared state: a handle, cheap to clone, that every handler and task holds.
#[derive(Clone)]
pub struct Shared(Arc<Inner>);

struct Inner {
    port: u16,
    config_dir: PathBuf,
    data_dir: PathBuf,
    epoch: String,
    clock: Clock,
    environment: Environment,
    allow_origins: Vec<String>,
    token: String,
    hosts: RwLock<Arc<[String]>>,
    provided: RwLock<HashMap<TypeId, Arc<dyn Any + Send + Sync>>>,
    stops: Stops,
}

impl Shared {
    /// The state of a server that listens on `port`, with its host token.
    pub(crate) fn new(options: Options, port: u16, token: String) -> Shared {
        let environment = Environment::load(&options.config_dir, options.environment);
        let hosts = allowed_hosts(&environment, &options.config_dir);
        Shared(Arc::new(Inner {
            port,
            config_dir: options.config_dir,
            data_dir: options.data_dir,
            epoch: secret::random(9),
            clock: options.clock,
            environment,
            allow_origins: options.allow_origins,
            token,
            hosts: RwLock::new(hosts.into()),
            provided: RwLock::default(),
            stops: Stops::default(),
        }))
    }

    /// The port the server listens on, on 127.0.0.1.
    pub fn port(&self) -> u16 {
        self.0.port
    }

    /// The server's address on its own machine, `http://127.0.0.1:<port>`.
    pub fn address(&self) -> String {
        format!("http://127.0.0.1:{}", self.0.port)
    }

    /// The config folder: the settings, the themes, the extensions, and `.env`.
    pub fn config_dir(&self) -> &Path {
        &self.0.config_dir
    }

    /// The data folder, this server's own.
    pub fn data_dir(&self) -> &Path {
        &self.0.data_dir
    }

    /// The epoch of this start of the server, which every `welcome` carries: a sequence number
    /// means something under its own epoch only.
    pub fn epoch(&self) -> &str {
        &self.0.epoch
    }

    /// The time now, on the server's clock: what anything the server dates or lets expire reads.
    pub fn now(&self) -> SystemTime {
        self.0.clock.now()
    }

    /// The server's environment, with the config folder's secrets: `environment().command(..)`
    /// starts every process the server runs.
    pub fn environment(&self) -> &Environment {
        &self.0.environment
    }

    /// The origins accepted besides the server's own and the allowed hosts'.
    pub fn allow_origins(&self) -> &[String] {
        &self.0.allow_origins
    }

    /// The host names accepted besides 127.0.0.1 and localhost, in force now.
    pub fn allowed_hosts(&self) -> Arc<[String]> {
        self.0
            .hosts
            .read()
            .unwrap_or_else(PoisonError::into_inner)
            .clone()
    }

    /// Replaces the allowed host names: the next request is checked against them.
    pub fn allow_hosts(&self, names: Vec<String>) {
        *self.0.hosts.write().unwrap_or_else(PoisonError::into_inner) = names.into();
    }

    /// Whether a request is the host's own `ura` or app: it carries
    /// `Authorization: Bearer <host token>`, the token of the status file, compared in constant
    /// time.
    pub fn from_host(&self, headers: &HeaderMap) -> bool {
        let given = headers
            .get(header::AUTHORIZATION)
            .and_then(|value| value.to_str().ok())
            .unwrap_or_default();
        secret::same(given, &format!("Bearer {}", self.0.token))
    }

    /// Provides a domain's state to the others, by its type: one value per type.
    pub fn provide<T: Send + Sync + 'static>(&self, state: T) {
        self.0
            .provided
            .write()
            .unwrap_or_else(PoisonError::into_inner)
            .insert(TypeId::of::<T>(), Arc::new(state));
    }

    /// The state a domain provided, by its type.
    ///
    /// # Panics
    ///
    /// When no domain provided it: the domain is missing from the server's list, or mounts after
    /// the one that asks.
    pub fn get<T: Send + Sync + 'static>(&self) -> Arc<T> {
        self.find().unwrap_or_else(|| {
            panic!(
                "no domain provided {}: mount it earlier in the server's list",
                type_name::<T>()
            )
        })
    }

    /// The state a domain provided, by its type, or none when none did.
    pub fn find<T: Send + Sync + 'static>(&self) -> Option<Arc<T>> {
        let provided = self
            .0
            .provided
            .read()
            .unwrap_or_else(PoisonError::into_inner);
        let state = provided.get(&TypeId::of::<T>())?.clone();
        state.downcast().ok()
    }

    /// Registers work that stops with the server, as a preview's command, a child process, or a
    /// VM: `Server::stop` runs each, the last registered first, and waits for it. Work registered
    /// once the server is stopping runs at once.
    pub fn on_stop<F>(&self, name: &'static str, work: F)
    where
        F: Future<Output = ()> + Send + 'static,
    {
        self.0.stops.add(name, work);
    }

    /// Waits until the server stops: a connection or a task that lives as long as the server
    /// ends itself then.
    pub async fn stopping(&self) {
        self.0.stops.begun().await;
    }

    /// The work that stops with the server.
    pub(crate) fn stops(&self) -> &Stops {
        &self.0.stops
    }
}

/// The allowed host names at the start: `URAEDA_ALLOWED_HOSTS`, separated by commas, or else the
/// settings file's, or else none.
///
/// TEMPORARY: read once, until the settings' record follows the file and calls `allow_hosts`
/// (task 7).
fn allowed_hosts(environment: &Environment, config_dir: &Path) -> Vec<String> {
    match environment.var("URAEDA_ALLOWED_HOSTS") {
        Some(names) => names
            .split(',')
            .map(|name| name.trim().to_lowercase())
            .filter(|name| !name.is_empty())
            .collect(),
        None => uraeda_core::settings::read(config_dir)
            .ok()
            .and_then(|settings| settings.server.allowed_hosts)
            .unwrap_or_default(),
    }
}
