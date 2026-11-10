//! The preview proxy: forwards the reads and the WebSockets of
//! `/r/<name>/preview/<secret>/<folder>/`, with the current frame secret, to the preview the
//! runner has ready for that path, and nothing else, without Uraeda's credentials. Every answer,
//! forwarded or its own, is sandboxed, readable from a sandboxed frame, and sends no referrer.

use axum::body::Body;
use axum::extract::{Request, State};
use axum::http::header::{self, HeaderMap, HeaderName, HeaderValue};
use axum::http::{Method, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::routing::any;
use http_body_util::Empty;
use hyper::body::Incoming;
use hyper_util::rt::TokioIo;
use percent_encoding::percent_decode_str;

use super::runner::{NOT_RUNNING, State as Preview};
use super::{Previews, upstream};
use crate::http::Routes;
use crate::shared::Shared;

/// The proxy's routes, as mounted: a preview's base without its slash, with it, and what is
/// under it. Each is open to a request without a session only with the current frame secret.
pub(crate) const PATHS: [&str; 3] = [
    "/r/{name}/preview/{secret}/{folder}",
    "/r/{name}/preview/{secret}/{folder}/",
    "/r/{name}/preview/{secret}/{folder}/{*rest}",
];

/// The `Content-Security-Policy` of every answer, replacing the preview's own.
const SANDBOX: &str = "sandbox allow-scripts allow-popups";

/// Headers of one connection, which a proxy does not pass on.
const HOP_BY_HOP: [&str; 9] = [
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "proxy-connection",
    "te",
    "trailer",
    "transfer-encoding",
    "upgrade",
];

/// The preview's headers that would reach Uraeda's own origin: its cookies, and site data
/// clearing.
const OWN_ORIGIN: [&str; 3] = ["clear-site-data", "set-cookie", "set-cookie2"];

/// Uraeda's credentials, never sent to a preview: every cookie on Uraeda's origin is Uraeda's,
/// as the preview's own `Set-Cookie` never reaches it.
const CREDENTIALS: [&str; 2] = ["authorization", "cookie"];

/// Storybook's channel, at the root of its own address.
const CHANNEL: &str = "/storybook-server-channel";

/// Mounts the proxy's routes, for every method: it answers the ones it refuses itself.
pub(super) fn mount(routes: &mut Routes) {
    for path in PATHS {
        routes.route(path, any(preview));
    }
}

/// A preview's request, answered sandboxed: open to any origin, and with its address, which
/// holds the frame secret, kept out of the `Referer` of what it loads or links.
async fn preview(State(shared): State<Shared>, request: Request) -> Response {
    let mut response = answer(&shared, request).await;
    let headers = response.headers_mut();
    let sandboxed = [
        (header::ACCESS_CONTROL_ALLOW_ORIGIN, "*"),
        (header::CONTENT_SECURITY_POLICY, SANDBOX),
        (header::REFERRER_POLICY, "no-referrer"),
    ];
    for (name, value) in sandboxed {
        headers.insert(name, HeaderValue::from_static(value));
    }
    response
}

/// A preview's request: without the current frame secret, 404; the path alone is sent to its
/// slash; reads and WebSockets go to the preview the runner has ready for the base, without the
/// base; other methods and other upgrades are refused.
async fn answer(shared: &Shared, request: Request) -> Response {
    let previews = shared.get::<Previews>();
    let path = request.uri().path().to_owned();
    let Some((base, rest)) = split(&path).filter(|_| previews.frames.allows(&path)) else {
        return (StatusCode::NOT_FOUND, "Not found").into_response();
    };
    let query = request.uri().query();
    let query = query.map(|query| format!("?{query}")).unwrap_or_default();
    let Some(rest) = rest else {
        let slash = format!("{base}{query}");
        return (StatusCode::MOVED_PERMANENTLY, [(header::LOCATION, slash)]).into_response();
    };
    let upgrade = request.headers().contains_key(header::UPGRADE);
    if upgrade && !web_socket(&request) {
        return (StatusCode::NOT_FOUND, "Not found").into_response();
    }
    if !upgrade && ![Method::GET, Method::HEAD].contains(request.method()) {
        let allow = [(header::ALLOW, "GET, HEAD")];
        return (StatusCode::METHOD_NOT_ALLOWED, allow, "Method not allowed").into_response();
    }
    let Some(Preview::Ready { port }) = previews.runner.state(&base) else {
        return not_running();
    };
    if upgrade {
        let protocols = request.headers().get_all(header::SEC_WEBSOCKET_PROTOCOL);
        let hmr = protocols
            .iter()
            .any(|asked| names(asked).any(|name| name == "vite-hmr"));
        // Vite's own socket keeps the whole path, which Vite serves under its base.
        let target = if hmr {
            format!("{path}{query}")
        } else {
            format!("{rest}{}", as_preview(rest, &query))
        };
        socket(shared, port, &target, request).await
    } else {
        let read = for_preview(port, &format!("{rest}{query}"), &request, &[]);
        forward(port, read).await
    }
}

/// The base and the rest of a preview's path, as sent: `/r/<name>/preview/<secret>/<folder>/`,
/// and what follows the folder, from its slash on, if anything does. None outside a preview.
fn split(path: &str) -> Option<(String, Option<&str>)> {
    let mut parts = path.strip_prefix("/r/")?.splitn(5, '/');
    let (name, kind, secret, folder) = (parts.next()?, parts.next()?, parts.next()?, parts.next()?);
    if kind != "preview" || [name, secret, folder].iter().any(|part| part.is_empty()) {
        return None;
    }
    let base = format!("/r/{name}/preview/{secret}/{folder}/");
    let rest = parts.next().map(|_| &path[base.len() - 1..]);
    Some((base, rest))
}

/// What a preview that does not run answers.
fn not_running() -> Response {
    (StatusCode::SERVICE_UNAVAILABLE, NOT_RUNNING).into_response()
}

/// The names a header's value lists, in lower case.
fn names(value: &HeaderValue) -> impl Iterator<Item = String> {
    let listed = value.to_str().unwrap_or_default().split(',');
    listed.map(|name| name.trim().to_ascii_lowercase())
}

/// Whether a proxy does not pass a header on: a hop-by-hop one, or one `Connection` names.
fn not_passed(headers: &HeaderMap, name: &HeaderName) -> bool {
    let mut named = headers.get_all(header::CONNECTION).iter().flat_map(names);
    HOP_BY_HOP.contains(&name.as_str()) || named.any(|named| named == name.as_str())
}

/// A request for the preview on `port`: the asked request's headers, with the preview's own
/// `Host`, and without those not passed on, Uraeda's credentials, or the ones `leave_out` names.
fn for_preview(port: u16, target: &str, asked: &Request, leave_out: &[&str]) -> ForPreview {
    let mut request = hyper::Request::new(Empty::new());
    *request.method_mut() = asked.method().clone();
    *request.uri_mut() = target.parse().ok()?;
    for (name, value) in asked.headers() {
        let kept = !not_passed(asked.headers(), name)
            && !CREDENTIALS.contains(&name.as_str())
            && !leave_out.contains(&name.as_str())
            && name != header::HOST;
        if kept {
            request.headers_mut().append(name, value.clone());
        }
    }
    let host = HeaderValue::from_str(&upstream::host(port)).ok()?;
    request.headers_mut().insert(header::HOST, host);
    Some(request)
}

/// A request for a preview, when the asked one could be made one.
type ForPreview = Option<hyper::Request<Empty<hyper::body::Bytes>>>;

/// Sends a read to the preview on `port`, and its answer back as it streams: 503 when nothing
/// answers.
async fn forward(port: u16, request: ForPreview) -> Response {
    let Some(request) = request else {
        return (StatusCode::BAD_REQUEST, "Bad request").into_response();
    };
    match upstream::send(port, request).await {
        Ok(response) => relayed(response),
        Err(_) => not_running(),
    }
}

/// A preview's answer, without the headers that are not passed on, or would reach Uraeda's own
/// origin.
fn relayed(response: hyper::Response<Incoming>) -> Response {
    let (mut parts, body) = response.into_parts();
    let own = |name: &HeaderName| OWN_ORIGIN.contains(&name.as_str());
    let all = parts.headers.keys();
    let left_out = all.filter(|&name| not_passed(&parts.headers, name) || own(name));
    for name in left_out.cloned().collect::<Vec<_>>() {
        parts.headers.remove(&name);
    }
    Response::from_parts(parts, Body::new(body))
}

/// Whether an upgrade asks for a WebSocket, as a GET: the only upgrade forwarded.
fn web_socket(request: &Request) -> bool {
    let upgrade = request.headers().get(header::UPGRADE);
    let asked = upgrade.and_then(|upgrade| upgrade.to_str().ok());
    request.method() == Method::GET
        && asked.is_some_and(|asked| asked.eq_ignore_ascii_case("websocket"))
}

/// An upgrade's query for the preview. Storybook's channel is always opened as a preview's,
/// `page=preview`, whatever `page` was asked: Storybook gives a manager's channel, or one
/// without a page or an `Origin`, the right to write files in the worktree. Its token, and the
/// rest, go as asked.
fn as_preview(rest: &str, query: &str) -> String {
    if rest != CHANNEL {
        return query.to_owned();
    }
    let is_page = |pair: &&str| {
        let name = pair.split('=').next().unwrap_or_default().replace('+', " ");
        percent_decode_str(&name).decode_utf8_lossy() == "page"
    };
    let asked = query.trim_start_matches('?').split('&');
    let asked: Vec<&str> = asked.filter(|pair| !pair.is_empty()).collect();
    let at = asked.iter().position(&is_page).unwrap_or(asked.len());
    let mut pairs: Vec<&str> = asked
        .iter()
        .copied()
        .filter(|pair| !is_page(pair))
        .collect();
    pairs.insert(at.min(pairs.len()), "page=preview");
    format!("?{}", pairs.join("&"))
}

/// Pipes a WebSocket to the preview on `port` at `target`, with the preview's own `Host` and no
/// `Origin`: its answer, which switches when the preview does. When either side ends, or the
/// server stops, both go.
async fn socket(shared: &Shared, port: u16, target: &str, mut asked: Request) -> Response {
    let Some(mut request) = for_preview(port, target, &asked, &["origin"]) else {
        return (StatusCode::BAD_REQUEST, "Bad request").into_response();
    };
    // The upgrade's own headers are of one connection: they are set again for the preview's.
    let headers = request.headers_mut();
    headers.insert(header::CONNECTION, HeaderValue::from_static("Upgrade"));
    if let Some(upgrade) = asked.headers().get(header::UPGRADE) {
        headers.insert(header::UPGRADE, upgrade.clone());
    }
    let frame = hyper::upgrade::on(&mut asked);
    let Ok(mut response) = upstream::send(port, request).await else {
        return not_running();
    };
    if response.status() != StatusCode::SWITCHING_PROTOCOLS {
        return relayed(response);
    }
    let preview = hyper::upgrade::on(&mut response);
    let shared = shared.clone();
    tokio::spawn(async move {
        let (Ok(frame), Ok(preview)) = tokio::join!(frame, preview) else {
            return;
        };
        let (mut from_frame, mut to_frame) = tokio::io::split(TokioIo::new(frame));
        let (mut from_preview, mut to_preview) = tokio::io::split(TokioIo::new(preview));
        // A socket has no use half closed: when either side ends, both go.
        tokio::select! {
            _ = tokio::io::copy(&mut from_frame, &mut to_preview) => {}
            _ = tokio::io::copy(&mut from_preview, &mut to_frame) => {}
            () = shared.stopping() => {}
        }
    });
    let (parts, _) = response.into_parts();
    Response::from_parts(parts, Body::empty())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_previews_path_is_its_base_and_what_follows() {
        let base = "/r/repo/preview/s/main/".to_owned();
        assert_eq!(split("/r/repo/preview/s/main"), Some((base.clone(), None)));
        assert_eq!(
            split("/r/repo/preview/s/main/"),
            Some((base.clone(), Some("/")))
        );
        assert_eq!(
            split("/r/repo/preview/s/main/a/b.js"),
            Some((base, Some("/a/b.js")))
        );
        for other in [
            "/r/repo/preview/s",
            "/r/repo/preview//main/",
            "/r/repo/raw/s/main/",
            "/live",
        ] {
            assert_eq!(split(other), None, "{other}");
        }
    }

    // Storybook's channel is a manager's, which may write files, unless its page says preview.
    #[test]
    fn a_channel_is_asked_as_a_previews_whatever_page_it_names() {
        let rows = [
            ("", "?page=preview"),
            ("?token=abc", "?token=abc&page=preview"),
            ("?page=manager&token=abc", "?page=preview&token=abc"),
            (
                "?token=abc&page=manager&page=other",
                "?token=abc&page=preview",
            ),
            ("?p%61ge=manager", "?page=preview"),
        ];
        for (asked, sent) in rows {
            assert_eq!(as_preview(CHANNEL, asked), sent, "{asked}");
        }
        assert_eq!(as_preview("/other", "?page=manager"), "?page=manager");
    }
}
