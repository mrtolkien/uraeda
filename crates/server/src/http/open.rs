//! `POST /open`: a second start hands its folder to the server already running, which adds the
//! folder's repository to its list and answers its page. The start itself opens its own folder
//! the same way.

use std::path::{Path, PathBuf};

use axum::Json;
use axum::body::Bytes;
use axum::extract::State;
use axum::http::{HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::routing::post;
use serde_json::{Value, json};
use uraeda_core::repositories::{self, ListError};

use crate::Failure;
use crate::http::{Routes, segment};
use crate::shared::Shared;

/// Mounts `POST /open`.
pub(crate) fn mount(_: &Shared, routes: &mut Routes) -> Result<(), Failure> {
    routes.route("/open", post(open));
    Ok(())
}

/// Answers the host's own `ura`: 200 with the server's version, which marks it as Uraeda, and
/// the page to open; 401 without the host token; 400 with `{ error }` for a folder that is not an
/// absolute path, or a list the core refuses to change.
async fn open(State(shared): State<Shared>, headers: HeaderMap, body: Bytes) -> Response {
    if !shared.from_host(&headers) {
        let error = "Only the server's own host hands a folder over.";
        return (StatusCode::UNAUTHORIZED, Json(json!({ "error": error }))).into_response();
    }
    let opened = match folder(&body) {
        Ok(folder) => open_folder(&shared, folder).await,
        Err(problem) => Err(problem),
    };
    match opened {
        Ok(url) => Json(json!({ "uraeda": env!("CARGO_PKG_VERSION"), "url": url })).into_response(),
        Err(error) => (StatusCode::BAD_REQUEST, Json(json!({ "error": error }))).into_response(),
    }
}

/// The folder a request's body names: none when it names none, as a start outside any folder.
fn folder(body: &[u8]) -> Result<Option<PathBuf>, String> {
    let problem = || "folder must be an absolute path".to_owned();
    let body: Value = serde_json::from_slice(body).map_err(|_| problem())?;
    match body.as_object().ok_or_else(problem)?.get("folder") {
        None | Some(Value::Null) => Ok(None),
        Some(Value::String(folder)) if Path::new(folder).is_absolute() => Ok(Some(folder.into())),
        Some(_) => Err(problem()),
    }
}

/// Adds the main checkout of the repository holding `folder` to the list, or touches it when
/// listed, and returns its page, `/r/<name>/`: `/` without a folder, or for one outside git.
///
/// # Errors
///
/// When the core refuses to change the list.
pub(crate) async fn open_folder(
    shared: &Shared,
    folder: Option<PathBuf>,
) -> Result<String, String> {
    let Some(folder) = folder else {
        return Ok("/".to_owned());
    };
    let (data_dir, now) = (shared.data_dir().to_owned(), shared.now());
    let added = tokio::task::spawn_blocking(move || repositories::add(&data_dir, &folder, now))
        .await
        .map_err(|error| error.to_string())?;
    match added {
        Ok(added) => Ok(format!("/r/{}/", segment(&added.repository.name))),
        Err(ListError::NotARepository(_) | ListError::NoSuchFolder(_)) => Ok("/".to_owned()),
        Err(error) => Err(error.to_string()),
    }
}
