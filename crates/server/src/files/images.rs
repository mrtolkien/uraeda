//! Images, as bytes: `/images/<path>`, an image under a repository's `specs/`, and
//! `/chat-images/<id>`, a chat's image of the data folder. Both are served with their detected
//! type and nothing a browser could run or load.

use axum::Json;
use axum::extract::{Path, State};
use axum::http::header::{CACHE_CONTROL, CONTENT_SECURITY_POLICY, CONTENT_TYPE};
use axum::http::header::{HeaderName, X_CONTENT_TYPE_OPTIONS};
use axum::http::{HeaderValue, StatusCode};
use axum::response::{IntoResponse, Response};
use serde_json::json;
use uraeda_core::api;

use super::chat_images::{self, ChatImages};
use super::repository::Repository;
use crate::shared::Shared;

/// `GET /r/<name>/images/<path>`: a PNG, JPEG, GIF, WebP, or SVG file under `specs/`, by its
/// path from the top level. Anything else is 404: the type is the one of its first bytes. Never
/// cached: a path may get another image later.
pub(super) async fn committed(
    repository: Repository,
    Path((_, path)): Path<(String, String)>,
) -> Response {
    let read = tokio::task::spawn_blocking(move || api::read_image(&repository.0, &path)).await;
    match read {
        Ok(Ok((bytes, kind))) => image(kind, bytes),
        _ => not_found(),
    }
}

/// `GET /r/<name>/chat-images/<id>`: a chat's image. An id is never given to another image, so
/// its bytes never change, and its answer is cached, by its owner's browser only.
pub(super) async fn chat(
    State(shared): State<Shared>,
    _: Repository,
    Path((_, id)): Path<(String, String)>,
) -> Response {
    let read = tokio::task::spawn_blocking(move || {
        let path = ChatImages::of(&shared).path(&id)?;
        Some((chat_images::kind(&id), std::fs::read(path).ok()?))
    });
    let Ok(Some((kind, bytes))) = read.await else {
        return not_found();
    };
    let mut response = image(kind, bytes);
    let forever = HeaderValue::from_static("private, max-age=31536000, immutable");
    response.headers_mut().insert(CACHE_CONTROL, forever);
    response
}

/// `DELETE /r/<name>/chat-images/<id>`: deletes a chat's image no message holds, as a composer
/// takes one back before sending. 204, 404 for an id that names no image, or 400 with
/// `{ error }` for an image a sent message holds.
pub(super) async fn remove(
    State(shared): State<Shared>,
    _: Repository,
    Path((_, id)): Path<(String, String)>,
) -> Response {
    let removed = tokio::task::spawn_blocking(move || {
        let images = ChatImages::of(&shared);
        if images.path(&id).is_none() {
            return not_found();
        }
        if in_a_message(&shared, &id) {
            let error = format!("refused: {id} is in a sent message.");
            return (StatusCode::BAD_REQUEST, Json(json!({ "error": error }))).into_response();
        }
        match images.remove(&id) {
            Ok(()) => StatusCode::NO_CONTENT.into_response(),
            Err(error) => {
                eprintln!("uraeda: the server could not delete the chat image {id}: {error}");
                StatusCode::INTERNAL_SERVER_ERROR.into_response()
            }
        }
    });
    removed
        .await
        .unwrap_or_else(|_| StatusCode::INTERNAL_SERVER_ERROR.into_response())
}

/// Whether a message of any session holds a chat image, taken back or not: one that does is
/// never deleted.
// JOIN(wave 6): the session store's answer (task 11). Until the sessions exist no message does.
fn in_a_message(_: &Shared, _: &str) -> bool {
    false
}

/// An image's answer: its detected type, never sniffed, nothing it could load or run, and no
/// page of another site may embed it. An SVG opened alone is a page: its own styles draw it, in
/// a sandbox where no script runs.
fn image(kind: &'static str, bytes: Vec<u8>) -> Response {
    let policy = match kind {
        "image/svg+xml" => "default-src 'none'; style-src 'unsafe-inline'; sandbox",
        _ => "default-src 'none'",
    };
    let headers = [
        (CONTENT_SECURITY_POLICY, policy),
        (CONTENT_TYPE, kind),
        (
            HeaderName::from_static("cross-origin-resource-policy"),
            "same-origin",
        ),
        (X_CONTENT_TYPE_OPTIONS, "nosniff"),
    ];
    (headers, bytes).into_response()
}

/// The answer for what is no image.
fn not_found() -> Response {
    (StatusCode::NOT_FOUND, "Not found").into_response()
}
