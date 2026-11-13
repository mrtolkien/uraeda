//! The repository a route under `/r/<name>` is for.

use std::path::PathBuf;

use axum::extract::{FromRequestParts, Path};
use axum::http::StatusCode;
use axum::http::request::Parts;
use axum::response::{IntoResponse, Response};

use crate::records::repositories;
use crate::shared::Shared;

/// The main checkout of the repository a route's `{name}` names: a handler's argument. A name the
/// list does not hold, or one whose folder is gone, answers 404 with the list's own refusal, so
/// the core never looks for a repository above a missing folder.
pub(super) struct Repository {
    /// Its name in the list, which a write to it and its records are told under.
    pub name: String,
    /// Its main checkout.
    pub path: PathBuf,
}

impl FromRequestParts<Shared> for Repository {
    type Rejection = Response;

    async fn from_request_parts(parts: &mut Parts, shared: &Shared) -> Result<Self, Response> {
        let not_found = |text: String| (StatusCode::NOT_FOUND, text).into_response();
        let params = Path::<Vec<(String, String)>>::from_request_parts(parts, shared).await;
        let params = params.map_err(IntoResponse::into_response)?;
        let name = params.0.into_iter().find(|(key, _)| key == "name");
        let name = name.map(|(_, name)| name).unwrap_or_default();
        let (listed, named) = (shared.clone(), name.clone());
        let found = tokio::task::spawn_blocking(move || repositories::path(&listed, &named));
        match found.await {
            Ok(Ok(path)) => Ok(Repository { name, path }),
            Ok(Err(fault)) => Err(not_found(fault.message().to_owned())),
            Err(panicked) => Err(not_found(panicked.to_string())),
        }
    }
}
