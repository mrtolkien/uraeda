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
use crate::http::{Routes, foreign};
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
    let state = previews.runner.state(&base);
    let Some(Preview::Ready { port }) = state else {
        // Only a page shown again starts a preview that stopped: what an open frame asks for
        // by itself, a script, a ping, a page fetched ahead, leaves it stopped.
        let woken = state.is_none() && shows_a_page(&request, rest) && wake(shared, &base).await;
        return not_running(woken);
    };
    // A page that asks for what it shows is looked at: the preview runs on.
    previews.runner.seen(shared, &base);
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

/// Whether a request shows a preview's page to somebody: the navigation of a frame's or a web
/// view's document, as the fetch metadata says where a browser sends it, and not one made ahead
/// of a visit. A client that sends none is believed on the path: the base itself, or a page.
fn shows_a_page(request: &Request, rest: &str) -> bool {
    let headers = request.headers();
    let said = |name: &str| {
        let value = headers.get(name).and_then(|value| value.to_str().ok());
        value.map(str::to_ascii_lowercase)
    };
    let ahead = ["sec-purpose", "purpose"]
        .iter()
        .filter_map(|name| said(name))
        .any(|purpose| purpose.contains("prefetch") || purpose.contains("prerender"));
    if request.method() != Method::GET || headers.contains_key(header::UPGRADE) || ahead {
        return false;
    }
    match said("sec-fetch-mode") {
        Some(mode) => mode == "navigate",
        None => rest == "/" || rest.ends_with(".html"),
    }
}

/// Wakes the preview under `base`, if it may be: see [`Previews::wake`]. It reads the checkout's
/// files, off the async threads.
async fn wake(shared: &Shared, base: &str) -> bool {
    let (shared, base) = (shared.clone(), base.to_owned());
    let woken = tokio::task::spawn_blocking(move || shared.get::<Previews>().wake(&shared, &base));
    woken.await.unwrap_or(false)
}

/// How long a frame whose request woke its preview waits before it asks again, in seconds.
const RETRY_AFTER: &str = "5";

/// What a preview that does not run answers: with `Retry-After` when the request woke it, so
/// the page is worth asking for again.
fn not_running(woken: bool) -> Response {
    let mut response = (StatusCode::SERVICE_UNAVAILABLE, NOT_RUNNING).into_response();
    if woken {
        let after = HeaderValue::from_static(RETRY_AFTER);
        response.headers_mut().insert(header::RETRY_AFTER, after);
    }
    response
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
            && !foreign::credential(name)
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
        Err(_) => not_running(false),
    }
}

/// A preview's answer, without the headers that are not passed on, or would reach Uraeda's own
/// origin.
fn relayed(response: hyper::Response<Incoming>) -> Response {
    let (mut parts, body) = response.into_parts();
    let all = parts.headers.keys();
    let left_out =
        all.filter(|&name| not_passed(&parts.headers, name) || foreign::reaches_origin(name));
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
        return not_running(false);
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

    /// A request for `rest` under a preview's base, with these headers.
    fn asked(method: Method, rest: &str, headers: &[(&'static str, &'static str)]) -> bool {
        let mut request = Request::new(Body::empty());
        *request.method_mut() = method;
        for (name, value) in headers {
            let name = HeaderName::from_static(name);
            request
                .headers_mut()
                .insert(name, HeaderValue::from_static(value));
        }
        shows_a_page(&request, rest)
    }

    // A preview that stopped starts again for a page somebody is shown, and for nothing an open
    // frame asks by itself: each of these, taken for a view, kept a Storybook running all night.
    #[test]
    fn only_a_navigation_shows_a_page() {
        const NAVIGATE: (&str, &str) = ("sec-fetch-mode", "navigate");
        let get = |rest: &str, headers: &[(&'static str, &'static str)]| {
            asked(Method::GET, rest, headers)
        };

        // A frame's document, and a web view's.
        assert!(get(
            "/iframe.html",
            &[NAVIGATE, ("sec-fetch-dest", "iframe")]
        ));
        assert!(get("/", &[("sec-fetch-mode", "Navigate")]));
        assert!(
            get("/story.js", &[NAVIGATE]),
            "a navigation, whatever its path"
        );
        // What a page loads, and its hot reload's ping.
        assert!(!get("/iframe.html", &[("sec-fetch-mode", "no-cors")]));
        assert!(!get("/", &[("sec-fetch-mode", "cors")]));
        assert!(!get(
            "/",
            &[("sec-fetch-mode", "websocket"), ("upgrade", "websocket")]
        ));
        // A page fetched ahead of a visit that may never come.
        assert!(!get(
            "/",
            &[NAVIGATE, ("sec-purpose", "prefetch;prerender")]
        ));
        assert!(!get("/", &[NAVIGATE, ("purpose", "prefetch")]));
        assert!(!asked(Method::HEAD, "/", &[NAVIGATE]));
        // A client without fetch metadata: the base, or a page, never what a page loads.
        assert!(get("/", &[]) && get("/iframe.html", &[]));
        assert!(!get("/story.js", &[]) && !get("/__events", &[]));
        assert!(!get("/", &[("upgrade", "websocket")]));
    }
}
