//! Codex's model catalog without its sub-agents: the one switch Codex 0.163.0 honours for a
//! model its catalog puts on multi-agent v2, where `features.multi_agent` leaves `spawn_agent`
//! on.

use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::Duration;

use futures_util::FutureExt as _;
use futures_util::future::{BoxFuture, Shared as SharedFuture};
use serde_json::{Value, json};
use sha2::{Digest as _, Sha256};

use super::short;
use crate::live::locked;
use crate::runtimes::Spawn;
use crate::secret;
use crate::shared::Shared;

/// `codex debug models` gives up after this long.
const CATALOG_TIMEOUT: Duration = Duration::from_secs(5);

/// The catalog a session runs on, its file's path, or why it could not be written.
pub(super) type Catalog = Result<PathBuf, String>;

/// What a session shows when it runs on Codex's own catalog, `problem` saying why.
pub(super) fn notice(problem: &str) -> String {
    format!(
        "Codex's own sub-agents may run in this session: its model catalog without them could \
         not be written ({problem})."
    )
}

/// Codex's raw model catalog, `{ models: [...] }`, with every model's `multi_agent_version`
/// set to `"disabled"`: every model and every other field kept, so no model is hidden.
///
/// # Errors
///
/// On anything else, as Codex would then run on a catalog it cannot read.
fn without_sub_agents(mut catalog: Value) -> Result<Value, String> {
    let models = catalog.get_mut("models").and_then(Value::as_array_mut);
    let Some(models) = models else {
        return Err("codex debug models gave no models".to_owned());
    };
    for model in models.iter_mut().filter_map(Value::as_object_mut) {
        model.insert("multi_agent_version".to_owned(), json!("disabled"));
    }
    Ok(catalog)
}

/// The catalog's file for the sessions of a working directory, in `folder`: one per directory,
/// named by a hash of it, as a project's own Codex configuration may change the catalog.
fn catalog_path(folder: &Path, cwd: &Path) -> PathBuf {
    let hash = Sha256::digest(cwd.to_string_lossy().as_bytes());
    let hex: String = hash.iter().map(|byte| format!("{byte:02x}")).collect();
    folder.join(format!("models-{}.json", &hex[..16]))
}

/// Writes a file whole, through a temporary one removed when it cannot be put in place.
fn write_whole(path: &Path, text: &str) -> std::io::Result<()> {
    let mut next = path.as_os_str().to_owned();
    next.push(format!(".{}", secret::random(9)));
    let written = fs::write(&next, text).and_then(|()| fs::rename(&next, path));
    if written.is_err() {
        let _ = fs::remove_file(&next);
    }
    written
}

/// The catalogs without sub-agents, written to one folder: read afresh at each open, as
/// Codex's own catalog changes with its version, and once for the sessions of a working
/// directory opening together.
pub(super) struct Catalogs {
    folder: PathBuf,
    running: Mutex<HashMap<PathBuf, SharedFuture<BoxFuture<'static, Catalog>>>>,
}

impl Catalogs {
    /// The catalogs of a server, kept in `folder`: never in Codex's home.
    pub(super) fn new(folder: PathBuf) -> Catalogs {
        Catalogs {
            folder,
            running: Mutex::default(),
        }
    }

    /// The catalog of the sessions in `cwd`, as `command debug models` prints it there, written
    /// only when it changed, as processes opening together read it. On a failure, why: the
    /// server prints it, and the process runs on Codex's own catalog.
    pub(super) async fn write(&self, shared: &Shared, command: &str, cwd: &Path) -> Catalog {
        let writing = {
            let mut running = locked(&self.running);
            let writing = running.entry(cwd.to_owned()).or_insert_with(|| {
                let path = catalog_path(&self.folder, cwd);
                let (shared, command) = (shared.clone(), command.to_owned());
                let (folder, cwd) = (self.folder.clone(), cwd.to_owned());
                let write = async move { write(&shared, &command, &folder, &cwd, &path).await };
                write.boxed().shared()
            });
            writing.clone()
        };
        let catalog = writing.await;
        locked(&self.running).remove(cwd);
        if let Err(problem) = &catalog {
            say_err!(
                "uraeda: Codex's sub-agents stay on in a session: its model catalog could not \
                 be written ({problem})"
            );
        }
        catalog
    }
}

/// Reads Codex's catalog in `cwd`, and writes it without its sub-agents at `path`.
async fn write(shared: &Shared, command: &str, folder: &Path, cwd: &Path, path: &Path) -> Catalog {
    let spawn = Spawn {
        program: command.to_owned(),
        args: vec!["debug".to_owned(), "models".to_owned()],
        cwd: cwd.to_owned(),
        env: Vec::new(),
    };
    let raw = short::run(shared, spawn, CATALOG_TIMEOUT).await?;
    let catalog = serde_json::from_str(&raw).map_err(|error| error.to_string())?;
    let text = format!("{}\n", without_sub_agents(catalog)?);
    let failed = |error: std::io::Error| error.to_string();
    fs::create_dir_all(folder).map_err(failed)?;
    if fs::read_to_string(path).ok().as_deref() != Some(&text) {
        write_whole(path, &text).map_err(failed)?;
    }
    Ok(path.to_owned())
}
