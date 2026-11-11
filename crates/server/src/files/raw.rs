//! A repository's files as text: `/raw/<path>`, for links to code, and
//! `/mockups/<secret>/<path>`, a page of a `mockups/` folder with what it loads, for a sandboxed
//! frame.

use std::path::PathBuf;

use axum::extract::{Path, State};
use axum::http::header::{CONTENT_SECURITY_POLICY, CONTENT_TYPE, REFERRER_POLICY};
use axum::http::{HeaderValue, StatusCode, Uri};
use axum::response::{IntoResponse, Redirect, Response};
use uraeda_core::api;

use super::repository::Repository;
use crate::http::segment;
use crate::shared::Shared;
use crate::{preview, secret};

/// The type a raw file is served with: never a page.
const TEXT: &str = "text/plain; charset=utf-8";

/// `GET /r/<name>/raw/<path>`: a tracked file of the repository, as plain text. Anything the core
/// does not serve, a path outside the repository, hidden, untracked, or behind a symlink, is 404.
pub(super) async fn raw(
    repository: Repository,
    Path((_, path)): Path<(String, String)>,
) -> Response {
    match read(repository.path, path).await {
        Ok(text) => ([(CONTENT_TYPE, TEXT)], text).into_response(),
        Err(status) => failed(status),
    }
}

/// `GET /r/<name>/mockups/<secret>/<path>`: a file in a `mockups/` folder, with its own type,
/// sandboxed so that its scripts run outside Uraeda's origin. The frame secret comes first: a
/// sandboxed frame sends no cookie, so the secret is what opens the path to it. Any other
/// mockup path, which only a signed-in page reaches, is sent with 303 to its path under the
/// current secret. Any path but a file of a `mockups/` folder is 404, the secret alone too. No
/// answer sends a referrer on: a mockup's address holds the secret.
pub(super) async fn mockup(
    State(shared): State<Shared>,
    repository: Repository,
    Path((_, path)): Path<(String, String)>,
    uri: Uri,
) -> Response {
    let (first, file) = path.split_once('/').unwrap_or((&path, ""));
    let secret = preview::frame_secret(&shared);
    let mut response = if secret::same(first, &secret) {
        let read = match in_mockups(file) {
            true => read(repository.path, file.to_owned()).await,
            false => Err(StatusCode::NOT_FOUND),
        };
        match read {
            Ok(text) => {
                let sandbox = (CONTENT_SECURITY_POLICY, "sandbox allow-scripts");
                ([sandbox, (CONTENT_TYPE, kind(file))], text).into_response()
            }
            Err(status) => failed(status),
        }
    } else {
        // The path as it was asked, encoded as it came, under the secret.
        let asked = uri.path();
        let rest = asked.splitn(5, '/').nth(4).unwrap_or_default();
        let name = segment(&repository.name);
        let query = uri.query().map(|query| format!("?{query}"));
        let query = query.unwrap_or_default();
        Redirect::to(&format!("/r/{name}/mockups/{secret}/{rest}{query}")).into_response()
    };
    let no_referrer = HeaderValue::from_static("no-referrer");
    response.headers_mut().insert(REFERRER_POLICY, no_referrer);
    response
}

/// The file's text, or the status of why it was not read: 404 when the core finds no such file,
/// which is also its answer for one it does not serve, else 500, logged.
async fn read(repo: PathBuf, path: String) -> Result<String, StatusCode> {
    let asked = path.clone();
    let read = tokio::task::spawn_blocking(move || api::read_raw(&repo, &path)).await;
    let problem = match read {
        Ok(Ok(text)) => return Ok(text),
        Ok(Err(error)) if error.code == "refused" && error.message.ends_with(": no such file") => {
            return Err(StatusCode::NOT_FOUND);
        }
        Ok(Err(error)) => error.to_string(),
        Err(panicked) => panicked.to_string(),
    };
    eprintln!("uraeda: the server could not read {asked}: {problem}");
    Err(StatusCode::INTERNAL_SERVER_ERROR)
}

/// The answer for a file that was not read.
fn failed(status: StatusCode) -> Response {
    let text = match status {
        StatusCode::NOT_FOUND => "Not found",
        _ => "The file could not be read",
    };
    (status, text).into_response()
}

/// Whether `path` names a file in a `mockups` folder, at any depth below it, with no empty, `.`,
/// or `..` segment: the only files the mockup route serves.
pub(crate) fn in_mockups(path: &str) -> bool {
    let segments: Vec<&str> = path.split('/').collect();
    let plain = |segment: &&str| !matches!(*segment, "" | "." | "..");
    let folders = &segments[..segments.len() - 1];
    segments.iter().all(plain) && folders.contains(&"mockups")
}

/// The type a mockup's file is served with, by its extension: a page, and what a page loads.
fn kind(path: &str) -> &'static str {
    match path.rsplit('.').next().unwrap_or_default() {
        "css" => "text/css; charset=utf-8",
        "html" => "text/html; charset=utf-8",
        "js" => "text/javascript; charset=utf-8",
        "json" => "application/json",
        "svg" => "image/svg+xml",
        _ => TEXT,
    }
}
