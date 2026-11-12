//! The app in a browser: the web build, which `just web-build` makes of `app/`, served at `/`.
//!
//! - **Where it comes from.** A release's `ura` holds the build: `build.rs` embeds the folder
//!   `URAEDA_WEB_BUILD` names when `ura` is compiled, as `just package` and the release do. A
//!   server started with `URAEDA_WEB_BUILD` in its environment reads that folder instead, as a
//!   test's stand-in or a build just made. With neither, the page says how to build it.
//! - **Its files** are the only paths open without a session, with the sign-in routes: they hold
//!   nothing of the owner's. Each is sent in the smallest form the browser takes, brotli, gzip,
//!   or as it is, which the build made beforehand. A file whose name holds the hash of its
//!   content is cached for good; the page and the manifest are asked again at each load. Any
//!   origin may read them, as the frame an extension's page runs in has none
//!   (`app/extensions/host.web.tsx`): the app's page, and every route, are not concerned.
//! - **The page** answers every address of the app, so a reload or a shared address opens it:
//!   a `GET` a browser opens, `Accept: text/html`, that no route of the server takes. A path
//!   under one of the server's own, `/session`, `/mcp`, `/r/<repository>/raw`, answers its own
//!   404, and so does anything a page's code asks for, as a module of an older build.

mod policy;

use std::collections::HashMap;
use std::io::Read as _;
use std::path::Path;
use std::sync::Arc;

use axum::body::Bytes;
use axum::extract::{Request, State};
use axum::http::header::{
    ACCEPT, ACCEPT_ENCODING, ACCESS_CONTROL_ALLOW_ORIGIN, CACHE_CONTROL, CONTENT_ENCODING,
    CONTENT_SECURITY_POLICY, CONTENT_TYPE, ETAG, IF_NONE_MATCH, VARY,
};
use axum::http::{HeaderMap, HeaderValue, Method, StatusCode};
use axum::response::{IntoResponse, Response};
use sha2::{Digest, Sha256};

use crate::shared::Shared;

// `FILES`, the build `ura` was compiled with: each file's path and bytes, or none.
include!(concat!(env!("OUT_DIR"), "/web_build.rs"));

/// The folder of a web build to serve in place of the one `ura` holds.
const FOLDER: &str = "URAEDA_WEB_BUILD";

/// How long a file named by its hash is kept: a year, and never asked again.
const FOREVER: &str = "public, max-age=31536000, immutable";

/// The page an extension's page runs in, which the web build writes beside the app's.
pub(crate) const EXTENSION_PAGE: &str = "/extension.html";

/// The page of an `ura` that holds no web build.
const NOT_BUILT: &str = include_str!("web/not-built.html");

/// A file of the build, in each form it is held in.
#[derive(Default)]
struct File {
    plain: Option<Bytes>,
    brotli: Option<Bytes>,
    gzip: Option<Bytes>,
}

/// The web build the server serves, read once as it starts.
pub(crate) struct Web {
    files: HashMap<String, File>,
    /// The page, `index.html`, or the one that says there is no build.
    page: File,
    /// The page's tag, which a browser sends back to ask whether it changed.
    tag: HeaderValue,
    /// The paths that are the server's own: see [`Web::is_servers`].
    routes: Vec<&'static str>,
}

impl Web {
    /// The build to serve: the folder the server's environment names, else the one `ura` holds.
    /// `routes` are the paths the server's domains mounted.
    pub(crate) fn load(shared: &Shared, routes: Vec<&'static str>) -> Web {
        let files = match shared.environment().var(FOLDER) {
            Some(folder) => read(Path::new(folder)),
            None => FILES
                .iter()
                .map(|(path, bytes)| ((*path).to_owned(), Bytes::from_static(bytes)))
                .collect(),
        };
        Web::of(files, routes)
    }

    fn of(held: Vec<(String, Bytes)>, routes: Vec<&'static str>) -> Web {
        let mut files: HashMap<String, File> = HashMap::new();
        for (path, bytes) in held {
            let (name, form) = match path.rsplit_once('.') {
                Some((name, "br")) => (name.to_owned(), Form::Brotli),
                Some((name, "gz")) => (name.to_owned(), Form::Gzip),
                _ => (path, Form::Plain),
            };
            let file = files.entry(name).or_default();
            match form {
                Form::Plain => file.plain = Some(bytes),
                Form::Brotli => file.brotli = Some(bytes),
                Form::Gzip => file.gzip = Some(bytes),
            }
        }
        let page = files.remove("index.html").unwrap_or_else(|| File {
            plain: Some(Bytes::from_static(NOT_BUILT.as_bytes())),
            ..File::default()
        });
        let html = page.inflated().unwrap_or_default();
        let digest = Sha256::digest(&html);
        let tag: String = digest.iter().take(8).map(|b| format!("{b:02x}")).collect();
        Web {
            files,
            tag: HeaderValue::from_str(&format!("\"{tag}\"")).expect("a tag is ASCII"),
            page,
            routes,
        }
    }

    /// Whether a path is the server's own, which never answers the page: it starts as a route
    /// of the server does, up to that route's first part that is not a name. `/r/<repository>`
    /// is the app's too, so there it is what follows that tells: `/r/sample/raw` is the
    /// server's, `/r/sample/inbox` the app's, though the server has `/r/sample/inbox/note-image`.
    fn is_servers(&self, path: &str) -> bool {
        let asked: Vec<&str> = path.split('/').skip(1).collect();
        self.routes.iter().any(|route| {
            let named: Vec<&str> = route.split('/').skip(1).collect();
            let repository = if named.first() == Some(&"r") { 2 } else { 0 };
            let names = named.iter().skip(repository);
            let fixed = repository + names.take_while(|part| !part.starts_with('{')).count();
            fixed > repository
                && asked.len() >= fixed
                && (0..fixed).all(|at| named[at].starts_with('{') || named[at] == asked[at])
        })
    }
}

/// How a file is held.
enum Form {
    Plain,
    Brotli,
    Gzip,
}

impl File {
    /// The form to send to a browser that takes `encodings`, and its `Content-Encoding`: the
    /// smallest it takes. One held compressed alone is inflated for a client that takes neither.
    fn sent(&self, encodings: &str) -> Option<(Bytes, Option<&'static str>)> {
        if let Some(brotli) = self.brotli.as_ref().filter(|_| takes(encodings, "br")) {
            return Some((brotli.clone(), Some("br")));
        }
        if let Some(gzip) = self.gzip.as_ref().filter(|_| takes(encodings, "gzip")) {
            return Some((gzip.clone(), Some("gzip")));
        }
        self.inflated().map(|plain| (plain, None))
    }

    /// The file as it is: from its gzip form, when that is all that is held.
    fn inflated(&self) -> Option<Bytes> {
        if let Some(plain) = &self.plain {
            return Some(plain.clone());
        }
        let mut plain = Vec::new();
        let mut decoder = flate2::read::GzDecoder::new(self.gzip.as_deref()?);
        decoder.read_to_end(&mut plain).ok()?;
        Some(plain.into())
    }
}

/// Whether an `Accept-Encoding` header takes an encoding: named, and not with `q=0`.
fn takes(encodings: &str, encoding: &str) -> bool {
    encodings.split(',').any(|entry| {
        let mut parts = entry.split(';').map(str::trim);
        let named = parts
            .next()
            .is_some_and(|name| name.eq_ignore_ascii_case(encoding));
        let refused = parts.any(|part| matches!(part, "q=0" | "q=0.0" | "q=0.00" | "q=0.000"));
        named && !refused
    })
}

/// Every file under a build's folder, by its path from it: none when there is no such folder.
fn read(folder: &Path) -> Vec<(String, Bytes)> {
    fn walk(folder: &Path, under: &str, files: &mut Vec<(String, Bytes)>) {
        let Ok(entries) = std::fs::read_dir(folder) else {
            return;
        };
        for entry in entries.flatten() {
            let Ok(name) = entry.file_name().into_string() else {
                continue;
            };
            let path = entry.path();
            if path.is_dir() {
                walk(&path, &format!("{under}{name}/"), files);
            } else if let Ok(bytes) = std::fs::read(&path) {
                files.push((format!("{under}{name}"), bytes.into()));
            }
        }
    }
    let mut files = Vec::new();
    walk(folder, "", &mut files);
    files
}

/// Whether a file's name holds the hash of its content, ten hexadecimal digits between dots, as
/// the build names every file but the page and the manifest: `nsh.67fad66ef9.wasm`, or a file of
/// `browser.bddb1349e4/`.
fn hashed(path: &str) -> bool {
    path.split(['/', '.']).any(|part| {
        part.len() == 10
            && part
                .bytes()
                .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
    })
}

/// A file's `Content-Type`, by its extension. A browser compiles a module as it downloads only
/// when it is sent as `application/wasm`.
fn kind(path: &str) -> &'static str {
    let name = path.rsplit('/').next().unwrap_or(path);
    // A name's hash is not its extension: `LICENSE.474a034e99` is text.
    let extension = name.rsplit('.').next().filter(|_| name.contains('.'));
    match extension.unwrap_or_default() {
        "html" => "text/html; charset=utf-8",
        "js" | "mjs" => "text/javascript; charset=utf-8",
        "css" => "text/css; charset=utf-8",
        "wasm" => "application/wasm",
        "json" | "map" => "application/json",
        "webmanifest" => "application/manifest+json",
        "woff2" => "font/woff2",
        "woff" => "font/woff",
        "otf" => "font/otf",
        "ttf" => "font/ttf",
        "png" => "image/png",
        "svg" => "image/svg+xml",
        "ico" => "image/x-icon",
        "bin" => "application/octet-stream",
        _ => "text/plain; charset=utf-8",
    }
}

/// A header's text, or none.
fn text<'a>(headers: &'a HeaderMap, name: &axum::http::HeaderName) -> &'a str {
    headers
        .get(name)
        .and_then(|value| value.to_str().ok())
        .unwrap_or_default()
}

/// What no route of the server takes: a file of the build, the page for an address of the app
/// opened in a browser, or 404.
pub(crate) async fn answer(State(shared): State<Shared>, request: Request) -> Response {
    let not_found = || (StatusCode::NOT_FOUND, "Not found").into_response();
    if !matches!(*request.method(), Method::GET | Method::HEAD) {
        return not_found();
    }
    let web = shared.get::<Arc<Web>>();
    let headers = request.headers();
    let encodings = text(headers, &ACCEPT_ENCODING);
    let path = request.uri().path();
    if let Some(file) = web.files.get(path.trim_start_matches('/')) {
        let cached = if hashed(path) { FOREVER } else { "no-cache" };
        let Some(sent) = file.sent(encodings) else {
            return not_found();
        };
        let mut response = respond(sent, kind(path), cached);
        // An extension's page runs in a frame without an origin (`extension.html`), whose
        // player loads these same files: to it they are another origin's. They hold nothing of
        // the owner's, and are open without a session already.
        let headers = response.headers_mut();
        headers.insert(ACCESS_CONTROL_ALLOW_ORIGIN, HeaderValue::from_static("*"));
        if path == EXTENSION_PAGE {
            let policy = HeaderValue::from_static(policy::EXTENSION_POLICY);
            headers.insert(CONTENT_SECURITY_POLICY, policy);
        }
        return response;
    }
    let opened = text(headers, &ACCEPT).contains("text/html");
    if !opened || web.is_servers(path) {
        return not_found();
    }
    if text(headers, &IF_NONE_MATCH) == web.tag {
        return (StatusCode::NOT_MODIFIED, [(ETAG, web.tag.clone())]).into_response();
    }
    let Some(sent) = web.page.sent(encodings) else {
        return not_found();
    };
    let mut response = respond(sent, kind("index.html"), "no-cache");
    let headers = response.headers_mut();
    headers.insert(ETAG, web.tag.clone());
    let policy = HeaderValue::from_static(policy::POLICY);
    headers.insert(CONTENT_SECURITY_POLICY, policy);
    response
}

/// Whether `path` is a file of the web build the server serves: open to any origin.
pub(crate) fn is_file(shared: &Shared, path: &str) -> bool {
    shared
        .get::<Arc<Web>>()
        .files
        .contains_key(path.trim_start_matches('/'))
}

/// A file's answer: its bytes, with what they are, how they are encoded, and how long they keep.
fn respond(
    (body, encoding): (Bytes, Option<&'static str>),
    kind: &'static str,
    cached: &'static str,
) -> Response {
    let mut response = body.into_response();
    let headers = response.headers_mut();
    headers.insert(CONTENT_TYPE, HeaderValue::from_static(kind));
    headers.insert(CACHE_CONTROL, HeaderValue::from_static(cached));
    headers.insert(VARY, HeaderValue::from_static("Accept-Encoding"));
    if let Some(encoding) = encoding {
        headers.insert(CONTENT_ENCODING, HeaderValue::from_static(encoding));
    }
    response
}
