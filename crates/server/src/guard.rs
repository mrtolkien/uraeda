//! The guard: what every request and every upgrade passes first. It refuses what a web page could
//! send to the local server: any `Host` but the server's own or an allowed host name, as in DNS
//! rebinding, any `Origin` but theirs and the allowed ones, and a write without an `Origin` that
//! the browser says another site sent. A request without either header, from the app, a test, or
//! `curl`, passes: the guard says where a request comes from, never who sends it.
//!
//! A sandboxed frame's `Origin: null` passes only for reads and upgrades, as GETs, on a preview's
//! or a mockup's path with the current frame secret.

use axum::extract::{Request, State};
use axum::http::{HeaderMap, StatusCode, header};
use axum::middleware::Next;
use axum::response::{IntoResponse, Response};

use crate::shared::Shared;

/// What a browser's `Sec-Fetch-Site` says of a request the server's own page, or its user, sent.
const OWN_SITES: [&str; 2] = ["same-origin", "none"];

/// Why the guard refuses a request.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Refusal {
    /// The `Host` is neither the server's own nor an allowed host name.
    Host,
    /// The `Origin` is neither the server's own nor an allowed one.
    Origin,
    /// A write without an `Origin`, which the browser says another site sent.
    Site,
    /// A frame's read on a path with the shape of a frame's, without the current secret: that
    /// address does not exist, as an old one after a sign-out.
    NotFound,
}

impl Refusal {
    /// The refusal's text, the answer's body.
    pub fn text(self) -> &'static str {
        match self {
            Refusal::Host => "Forbidden host",
            Refusal::Origin => "Forbidden origin",
            Refusal::Site => "Forbidden site",
            Refusal::NotFound => "Not found",
        }
    }

    /// The answer's status: 404 for an address that does not exist, else 403.
    pub fn status(self) -> u16 {
        match self {
            Refusal::NotFound => 404,
            _ => 403,
        }
    }
}

/// What the guard accepts, as of now: read at each request, so a change applies to the next.
pub struct Rules<'a> {
    /// The server's port.
    pub port: u16,
    /// The host names accepted besides 127.0.0.1 and localhost, like `mac.tail1234.ts.net`.
    pub hosts: &'a [String],
    /// The origins accepted besides the server's own and the allowed hosts', like a development
    /// server's.
    pub origins: &'a [String],
    /// Whether a path is a preview's or a mockup's with the current frame secret.
    pub frame: &'a dyn Fn(&str) -> bool,
}

/// A request, or an upgrade, as the guard reads it.
#[derive(Clone, Copy, Debug)]
pub struct Asked<'a> {
    /// The `Host` header.
    pub host: &'a str,
    pub method: &'a str,
    /// The `Origin` header.
    pub origin: Option<&'a str>,
    /// The path, without its query.
    pub path: &'a str,
    /// The `Sec-Fetch-Site` header.
    pub site: Option<&'a str>,
    /// Whether the request asks for an upgrade, as a WebSocket's.
    pub upgrade: bool,
}

impl Asked<'_> {
    /// Whether the request only reads: a GET or a HEAD, and an upgrade only as a GET.
    fn reads(&self) -> bool {
        self.method == "GET" || (self.method == "HEAD" && !self.upgrade)
    }
}

/// The guard's rule, for requests and upgrades alike: the refusal, or nothing when the request
/// passes.
pub fn refusal(rules: &Rules, asked: &Asked) -> Option<Refusal> {
    let port = rules.port;
    let own = [format!("127.0.0.1:{port}"), format!("localhost:{port}")];
    // `tailscale serve` passes the machine's name, without a port behind HTTPS.
    let listed = |host: &str| {
        rules.hosts.iter().any(|name| {
            host == name
                || host
                    .strip_prefix(name.as_str())
                    .is_some_and(|rest| rest == format!(":{port}"))
        })
    };
    if !own.iter().any(|host| host == asked.host) && !listed(asked.host) {
        return Some(Refusal::Host);
    }
    let framed = asked.origin == Some("null") && asked.reads();
    let frame = framed && (rules.frame)(asked.path);
    if framed && !frame && frame_secret(asked.path).is_some() {
        return Some(Refusal::NotFound);
    }
    match asked.origin {
        Some(origin) => {
            let accepted = own.iter().any(|host| origin == format!("http://{host}"))
                || rules
                    .hosts
                    .iter()
                    .any(|name| origin == format!("https://{name}"))
                || rules.origins.iter().any(|allowed| origin == allowed);
            (!accepted && !frame).then_some(Refusal::Origin)
        }
        None => {
            let foreign = asked.site.is_some_and(|site| !OWN_SITES.contains(&site));
            (foreign && !asked.reads()).then_some(Refusal::Site)
        }
    }
}

/// The frame secret a path carries, when it has the shape of a preview's,
/// `/r/<repository>/preview/<secret>/<folder>` and what follows, or of a mockup's,
/// `/r/<repository>/mockups/<secret>/<path>`. The guard, the frame secret, and the proxy read it
/// alike.
pub fn frame_secret(path: &str) -> Option<&str> {
    let mut parts = path.strip_prefix("/r/")?.splitn(4, '/');
    let (repository, kind, secret, rest) =
        (parts.next()?, parts.next()?, parts.next()?, parts.next()?);
    let shaped = match kind {
        "preview" => !rest.split('/').next().is_some_and(str::is_empty),
        "mockups" => !rest.is_empty(),
        _ => false,
    };
    (shaped && !repository.is_empty() && !secret.is_empty()).then_some(secret)
}

/// The guard, on every request the server answers.
pub(crate) async fn layer(State(shared): State<Shared>, request: Request, next: Next) -> Response {
    match check(&shared, &request) {
        Some(refused) => answer(refused),
        None => next.run(request).await,
    }
}

/// The guard's refusal of a request, by the rules in force now.
fn check(shared: &Shared, request: &Request) -> Option<Refusal> {
    let headers = request.headers();
    let hosts = shared.allowed_hosts();
    let host = text(headers, "host")
        .unwrap_or_default()
        .to_ascii_lowercase();
    let rules = Rules {
        port: shared.port(),
        hosts: &hosts,
        origins: shared.allow_origins(),
        // TEMPORARY: no path is a frame's until the previews bring the frame secret (task 18).
        frame: &|_| false,
    };
    let asked = Asked {
        host: &host,
        method: request.method().as_str(),
        origin: text(headers, "origin"),
        path: request.uri().path(),
        site: text(headers, "sec-fetch-site"),
        upgrade: headers.contains_key(header::UPGRADE),
    };
    refusal(&rules, &asked)
}

/// A header's value, or none when the request has none: one that is not text reads as empty,
/// which no rule accepts.
fn text<'a>(headers: &'a HeaderMap, name: &str) -> Option<&'a str> {
    let value = headers.get(name)?;
    Some(value.to_str().unwrap_or_default())
}

/// The answer to a refused request: the refusal's text, with its status.
fn answer(refused: Refusal) -> Response {
    let status = StatusCode::from_u16(refused.status()).expect("a refusal's status");
    (status, refused.text()).into_response()
}
