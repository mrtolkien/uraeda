//! The sync of the human's vault with the plugin on their phone. The desktop decides, the phone
//! carries the plan out:
//!
//! - `POST /{token}/vault/plan`: the phone's files and its base, each a path and a SHA-256, and
//!   its local time for naming copies. Answers the plan (see [`uraeda_vault::plan`]).
//! - `GET /{token}/vault/file?path=`: a file of the vault.
//! - `PUT /{token}/vault/file?path=&expect=`: writes a file, only while the desktop's is still
//!   `expect`, no `expect` for no file: else `409`, and the next sync keeps both.
//! - `DELETE /{token}/vault/file?path=&expect=`: moves a file to the vault's `.trash/`, on the
//!   same condition.
//!
//! A write or a deletion never goes through a link of the vault: a link leads to a repository's
//! files, or out of the vault. A read follows them, as the listing does.
//!
//! The plugin's requests carry no `Origin`: they write with the token in `Authorization: Bearer`,
//! which a page of another site cannot send without CORS, which `ura serve` never allows (see
//! [`crate::guard`]).
//!
//! Before each plan, at most every 5 seconds, the vault's folders and links are made again from
//! the repositories and their worktrees.

use std::sync::Arc;
use std::time::{Duration, Instant};

use axum::Json;
use axum::body::Bytes;
use axum::extract::{Query, State};
use axum::http::{StatusCode, header};
use axum::response::{IntoResponse, Response};
use serde::{Deserialize, Serialize};
use uraeda_vault::manifest::{Manifest, hash_file};
use uraeda_vault::plan::{Action, plan as decide};
use uraeda_vault::{Vault, layout, links, notes, paths, plugin};

use crate::{Shared, waiting};

/// The largest list of files the phone may send: some 300,000 files with their hashes, twice.
pub const MAX_PLAN: usize = 64 * 1024 * 1024;

/// The largest file the phone may send: a video of a few minutes.
pub const MAX_FILE: usize = 512 * 1024 * 1024;

#[derive(Deserialize)]
pub struct PlanRequest {
    files: Manifest,
    #[serde(default)]
    base: Manifest,
    #[serde(default)]
    stamp: String,
    /// The vault the phone last synced with: its base holds only for that one.
    #[serde(default)]
    vault: String,
}

#[derive(Serialize)]
pub struct PlanResponse {
    actions: Vec<Action>,
    /// The vault's folders, which the phone makes when missing: an empty `inbox/` is there to
    /// write in.
    folders: Vec<String>,
    /// The vault's identity, which the phone sends back next time.
    vault: String,
}

#[derive(Deserialize)]
pub struct Target {
    path: String,
    #[serde(default)]
    expect: Option<String>,
}

/// A refusal, in plain text: the plugin shows it.
struct Failure(StatusCode, &'static str);

impl IntoResponse for Failure {
    fn into_response(self) -> Response {
        (self.0, self.1).into_response()
    }
}

fn failure(status: StatusCode, message: &'static str) -> Failure {
    Failure(status, message)
}

fn vault_of(shared: &Shared) -> Result<Vault, Failure> {
    shared
        .vault()
        .ok_or_else(|| failure(StatusCode::NOT_FOUND, "No vault is synced."))
}

pub async fn plan(State(shared): State<Arc<Shared>>, body: Bytes) -> Response {
    let Ok(request) = serde_json::from_slice::<PlanRequest>(&body) else {
        return failure(
            StatusCode::BAD_REQUEST,
            "A plan's request is JSON: files, base, stamp.",
        )
        .into_response();
    };
    let vault = match vault_of(&shared) {
        Ok(vault) => vault,
        Err(failure) => return failure.into_response(),
    };
    let held = Arc::clone(&shared);
    let answer = tokio::task::spawn_blocking(move || {
        refresh_now(&held, Duration::from_secs(5));
        let id = plugin::vault_id(&vault).unwrap_or_default();
        // Another vault, or this one emptied: its base would read every missing file as deleted.
        let base = if request.vault == id {
            request.base
        } else {
            Manifest::new()
        };
        let desktop = held.hashes.manifest(&vault);
        let actions = decide(&desktop, &request.files, &base, &request.stamp);
        let folders = layout::folders(&vault);
        PlanResponse {
            actions,
            folders,
            vault: id,
        }
    })
    .await;
    match answer {
        Ok(response) => Json(response).into_response(),
        Err(_) => failure(StatusCode::INTERNAL_SERVER_ERROR, "The plan failed.").into_response(),
    }
}

pub async fn get_file(State(shared): State<Arc<Shared>>, Query(target): Query<Target>) -> Response {
    let vault = match vault_of(&shared) {
        Ok(vault) => vault,
        Err(failure) => return failure.into_response(),
    };
    let Some(path) = paths::clean(&target.path).filter(|p| paths::is_synced(p)) else {
        return failure(StatusCode::NOT_FOUND, "No such file.").into_response();
    };
    let full = vault.root().join(path);
    blocking(move || {
        let bytes =
            std::fs::read(full).map_err(|_| failure(StatusCode::NOT_FOUND, "No such file."))?;
        Ok((
            [
                (header::CONTENT_TYPE, "application/octet-stream"),
                (header::CACHE_CONTROL, "no-store"),
            ],
            bytes,
        )
            .into_response())
    })
    .await
}

pub async fn put_file(
    State(shared): State<Arc<Shared>>,
    Query(target): Query<Target>,
    body: Bytes,
) -> Response {
    let vault = match vault_of(&shared) {
        Ok(vault) => vault,
        Err(failure) => return failure.into_response(),
    };
    let held = Arc::clone(&shared);
    blocking(move || {
        let (_, full) = writable(&vault, &target.path)?;
        let _write = held
            .writes
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        expect(&full, target.expect.as_deref())?;
        notes::write_atomic(&full, &body).map_err(|_| {
            failure(
                StatusCode::INTERNAL_SERVER_ERROR,
                "The file was not written.",
            )
        })?;
        Ok(uraeda_vault::manifest::hash_bytes(&body).into_response())
    })
    .await
}

pub async fn delete_file(
    State(shared): State<Arc<Shared>>,
    Query(target): Query<Target>,
) -> Response {
    let vault = match vault_of(&shared) {
        Ok(vault) => vault,
        Err(failure) => return failure.into_response(),
    };
    let held = Arc::clone(&shared);
    blocking(move || {
        let (path, full) = writable(&vault, &target.path)?;
        let _write = held
            .writes
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        if !full.is_file() {
            return Ok(StatusCode::OK.into_response());
        }
        if target.expect.is_none() {
            return Err(failure(
                StatusCode::CONFLICT,
                "A deletion names the file it expects.",
            ));
        }
        expect(&full, target.expect.as_deref())?;
        notes::trash(&vault, &path)
            .map_err(|_| failure(StatusCode::INTERNAL_SERVER_ERROR, "The file was not moved."))?;
        Ok(StatusCode::OK.into_response())
    })
    .await
}

async fn blocking(work: impl FnOnce() -> Result<Response, Failure> + Send + 'static) -> Response {
    match tokio::task::spawn_blocking(work).await {
        Ok(Ok(response)) => response,
        Ok(Err(failure)) => failure.into_response(),
        Err(_) => failure(StatusCode::INTERNAL_SERVER_ERROR, "The write failed.").into_response(),
    }
}

/// The path the phone may write or delete, cleaned, and its file: never the plugin's, git's, or
/// one behind a link.
fn writable(vault: &Vault, path: &str) -> Result<(String, std::path::PathBuf), Failure> {
    let refused = || failure(StatusCode::FORBIDDEN, "The phone may not write this file.");
    let full = notes::writable(vault, path).map_err(|_| refused())?;
    let clean = paths::clean(path).ok_or_else(refused)?;
    Ok((clean, full))
}

/// Whether the desktop's file is still what the phone expects: `None` for no file.
fn expect(full: &std::path::Path, expected: Option<&str>) -> Result<(), Failure> {
    let current = full.is_file().then(|| hash_file(full).ok()).flatten();
    let expected = expected.filter(|e| !e.is_empty());
    if current.as_deref() == expected {
        Ok(())
    } else {
        Err(failure(
            StatusCode::CONFLICT,
            "The file changed on the desktop.",
        ))
    }
}

/// Makes the vault's folders and links again when the last time is older than `every`. Blocks on
/// disk and git.
pub fn refresh_now(shared: &Shared, every: Duration) {
    {
        let mut last = shared
            .refreshed
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        if last.is_some_and(|at| at.elapsed() < every) {
            return;
        }
        *last = Some(Instant::now());
    }
    let Some(vault) = shared.vault() else { return };
    let names = waiting::repository_names(&shared.settings());
    let projects: Vec<&str> = names.iter().map(|(name, _)| name.as_str()).collect();
    if layout::ensure(&vault, &projects).is_err() || plugin::install(&vault).is_err() {
        return;
    }
    for (name, path) in &names {
        if let Ok(found) = links::of_repository(path) {
            let _ = links::apply(&vault, name, &found);
        }
    }
    let _ = links::prune(&vault, &projects);
}
