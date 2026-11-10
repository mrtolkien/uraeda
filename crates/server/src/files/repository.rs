//! The repository a route under `/r/<name>` is for.

use std::path::PathBuf;

use axum::extract::{FromRequestParts, Path};
use axum::http::StatusCode;
use axum::http::request::Parts;
use axum::response::{IntoResponse, Response};
use uraeda_core::repositories;

use crate::shared::Shared;

/// The main checkout of the repository a route's `{name}` names: a handler's argument. A name the
/// list does not hold, or one whose folder is gone, answers 404, so the core never looks for a
/// repository above a missing folder.
// JOIN(wave 6): finding a listed repository by its name, which task 7's records own.
pub(super) struct Repository(pub PathBuf);

impl FromRequestParts<Shared> for Repository {
    type Rejection = Response;

    async fn from_request_parts(parts: &mut Parts, shared: &Shared) -> Result<Self, Response> {
        let not_found = |text: String| (StatusCode::NOT_FOUND, text).into_response();
        let params = Path::<Vec<(String, String)>>::from_request_parts(parts, shared).await;
        let params = params.map_err(IntoResponse::into_response)?;
        let name = params.0.into_iter().find(|(key, _)| key == "name");
        let name = name.map(|(_, name)| name).unwrap_or_default();
        let data_dir = shared.data_dir().to_owned();
        let listed = tokio::task::spawn_blocking(move || repositories::read(&data_dir)).await;
        let listed = listed.ok().and_then(Result::ok).unwrap_or_default();
        let Some(found) = listed.into_iter().find(|listed| listed.name == name) else {
            return Err(not_found(format!("No repository named “{name}”")));
        };
        if !found.path.is_dir() {
            let folder = found.path.display();
            return Err(not_found(format!("Folder not found: {folder}")));
        }
        Ok(Repository(found.path))
    }
}
