//! The extensions' HTTP routes: every one is under `/x/<extension>/`, at that path with no
//! repository, and under a repository's `/r/<name>`, where its extension is on. An extension
//! names its paths as it loads, so the server mounts the two prefixes, and the extension's VM
//! finds the route. Both are closed like every route of the server: the session check asks
//! for a sign-in, and the guard refuses a request another site sent.

use axum::body::{Body, to_bytes};
use axum::extract::{Path, Request, State};
use axum::http::{HeaderName, HeaderValue, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::routing::any;
use base64::Engine as _;
use base64::engine::general_purpose::STANDARD;
use serde_json::{Map, Value, json};

use super::vm::{CALL, CallError};
use super::{Extensions, runtime};
use crate::http::Routes;
use crate::records::repositories;
use crate::shared::Shared;

/// The largest body a route is given.
const MOST_BYTES: usize = 10 * 1024 * 1024;

/// Mounts the two prefixes every extension's routes are under.
pub(super) fn mount(routes: &mut Routes) {
    routes.route("/x/{extension}/{*path}", any(global));
    routes.route("/r/{name}/x/{extension}/{*path}", any(in_repository));
}

/// `/x/<extension>/<path>`: a route of the extension, with no repository.
async fn global(
    State(shared): State<Shared>,
    Path((extension, _)): Path<(String, String)>,
    request: Request,
) -> Response {
    let path = request.uri().path().to_owned();
    answer(shared, extension, None, path, request).await
}

/// `/r/<name>/x/<extension>/<path>`: a route of the extension, in a repository it is on in.
async fn in_repository(
    State(shared): State<Shared>,
    Path((name, extension, _)): Path<(String, String, String)>,
    request: Request,
) -> Response {
    let listed = shared.clone();
    let asked = name.clone();
    let found = tokio::task::spawn_blocking(move || repositories::find(&listed, &asked)).await;
    if !matches!(found, Ok(Ok(_))) {
        let message = format!("No repository named “{name}”");
        return (StatusCode::NOT_FOUND, message).into_response();
    }
    // The route's own path: what follows the repository's prefix, as the request sent it.
    let whole = request.uri().path();
    let path = whole
        .find("/x/")
        .map_or(whole, |at| &whole[at..])
        .to_owned();
    answer(shared, extension, Some(name), path, request).await
}

/// Asks the extension's VM for the request's answer.
async fn answer(
    shared: Shared,
    extension: String,
    repository: Option<String>,
    path: String,
    request: Request,
) -> Response {
    let text = |status: StatusCode, message: String| (status, message).into_response();
    let extensions = shared.get::<Extensions>();
    if let Some(repository) = &repository
        && !extensions.on_in(&extension, repository)
    {
        let message = format!("{extension} is off in {repository}");
        return text(StatusCode::NOT_FOUND, message);
    }
    let no_route = format!("{extension} has no route {path}");
    let Some(vm) = extensions.vm(&extension) else {
        return text(StatusCode::NOT_FOUND, no_route);
    };
    let (parts, body) = request.into_parts();
    let Ok(body) = to_bytes(body, MOST_BYTES).await else {
        let message = "The body is over 10 MB".to_owned();
        return text(StatusCode::PAYLOAD_TOO_LARGE, message);
    };
    let headers = parts.headers.iter().map(|(name, value)| {
        let value = String::from_utf8_lossy(value.as_bytes()).into_owned();
        json!([name.as_str(), value])
    });
    let request = json!({
        "method": parts.method.as_str(),
        "path": path,
        "query": query(parts.uri.query().unwrap_or_default()),
        "headers": headers.collect::<Vec<Value>>(),
        "body": STANDARD.encode(body),
    });
    let call = json!({ "what": "route", "repository": repository, "request": request });
    let called = tokio::task::spawn_blocking(move || vm.call(call, CALL)).await;
    let failed = |error: &CallError| format!("{extension}: {}", runtime::words(error));
    match called {
        Ok(Ok(Value::Null)) => text(StatusCode::NOT_FOUND, no_route),
        Ok(Ok(sent)) => response(&sent),
        Ok(Err(error @ CallError::NoAnswer)) => text(StatusCode::GATEWAY_TIMEOUT, failed(&error)),
        Ok(Err(error)) => text(StatusCode::INTERNAL_SERVER_ERROR, failed(&error)),
        Err(_) => text(
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("{extension} failed"),
        ),
    }
}

/// A query's names and values, the last of a name twice.
fn query(query: &str) -> Value {
    let decode = |text: &str| {
        let spaced = text.replace('+', " ");
        let decoded = percent_encoding::percent_decode_str(&spaced).decode_utf8_lossy();
        decoded.into_owned()
    };
    let pairs = query.split('&').filter(|pair| !pair.is_empty());
    let pairs = pairs.map(|pair| {
        let (name, value) = pair.split_once('=').unwrap_or((pair, ""));
        (decode(name), Value::String(decode(value)))
    });
    Value::Object(pairs.collect::<Map<String, Value>>())
}

/// The answer the extension gave: its status, its headers, and its body.
fn response(sent: &Value) -> Response {
    let status = sent["status"]
        .as_u64()
        .and_then(|status| u16::try_from(status).ok());
    let status = status.and_then(|status| StatusCode::from_u16(status).ok());
    let body = STANDARD.decode(sent["body"].as_str().unwrap_or_default());
    let mut response = Response::new(Body::from(body.unwrap_or_default()));
    *response.status_mut() = status.unwrap_or(StatusCode::OK);
    let headers = sent["headers"]
        .as_array()
        .map(Vec::as_slice)
        .unwrap_or_default();
    for header in headers {
        let name = header[0]
            .as_str()
            .and_then(|name| name.parse::<HeaderName>().ok());
        let value = header[1]
            .as_str()
            .and_then(|value| HeaderValue::from_str(value).ok());
        if let (Some(name), Some(value)) = (name, value) {
            response.headers_mut().insert(name, value);
        }
    }
    response
}
