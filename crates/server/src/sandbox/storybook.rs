//! A fake Storybook: the preview command of the sandbox's stories feature, and of the tests of
//! the preview runner, its proxy, and the embeds. No sandbox and no test runs a real Storybook,
//! or a package manager.
//!
//!   <program> --port <port> [--mode <mode>] [--log <file>]
//!
//! `ura fake-storybook` is that program for the sandbox, and `fake-storybook`, built beside the
//! server's tests, for them.
//!
//! It appends its start to the log file, its folder created if missing, as one JSON line
//! `{ base, cwd, pid, port }`, then serves, from its working folder:
//!
//! - `/index.json`: one story entry per `export const X` of each `*.stories.*` file;
//! - `/`: Storybook's own interface, as its manager draws it: the stories' list, and the story
//!   of its `?path=/story/<id>`, or its first, in a frame titled "storybook-preview-iframe", as
//!   Storybook's is;
//! - `/iframe.html?id=<id>`: a story's page, with a `Content-Security-Policy` that forbids
//!   framing it, which the proxy replaces: see [`pages`];
//! - WebSockets at `/storybook-server-channel`, refused when their `Origin` is `null`, and
//!   under `URAEDA_PREVIEW_BASE` for the `vite-hmr` protocol, which each send one message:
//!   what `/__echo` answers;
//! - `/__echo`: the path, the query's values by name, `Host`, `Origin`, and headers it got, as
//!   JSON;
//! - `/__headers`: an answer with a cookie, `Clear-Site-Data`, and `x-custom`, which its
//!   `Connection` names;
//! - any other file under its working folder, by its path (`/src/A.tsx`), as
//!   `text/javascript`;
//! - `/__requests`: the paths it served, in order, as a JSON array.
//!
//! Its modes: `ok`; `fail`, which prints `Error: Cannot find module 'storybook'` framed as
//! Storybook frames its output, then Storybook's last line, and exits 1; `hang`, which never
//! answers `/index.json`; `child`, which starts a child that keeps its output open, and
//! outlives it. A taken port prints `Port <port> is not available` and exits 1.

mod pages;

use std::fs;
use std::io::{ErrorKind, Write};
use std::path::{Component, Path, PathBuf};
use std::process::{Command, ExitCode, Stdio};
use std::sync::{Arc, Mutex};

use axum::Router;
use axum::extract::ws::{Message, WebSocketUpgrade};
use axum::extract::{FromRequestParts, Request, State};
use axum::http::request::Parts;
use axum::http::{HeaderMap, HeaderValue, StatusCode, header};
use axum::response::{IntoResponse, Response};
use serde_json::{Map, Value, json};

/// What the program was started with.
struct Asked {
    port: u16,
    mode: String,
    log: Option<PathBuf>,
}

/// One running fake.
struct Fake {
    mode: String,
    /// The base the proxy serves it under, which Vite's socket keeps in its path.
    base: String,
    /// Its working folder: the stories' files, and the source files it serves.
    folder: PathBuf,
    /// The paths it served, in order.
    served: Mutex<Vec<String>>,
}

/// Runs the fake with a command line's arguments, without the program's name, until it is
/// killed.
pub fn run(args: impl IntoIterator<Item = String>) -> ExitCode {
    let asked = match asked(args) {
        Ok(asked) => asked,
        Err(problem) => {
            eprintln!("fake-storybook: {problem}");
            return ExitCode::from(2);
        }
    };
    let base = std::env::var("URAEDA_PREVIEW_BASE").unwrap_or_else(|_| "/".to_owned());
    let folder = std::env::current_dir().unwrap_or_default();
    if let Some(log) = &asked.log {
        let start = json!({
            "base": base, "cwd": folder, "pid": std::process::id(), "port": asked.port,
        });
        if let Err(error) = logged(log, &start) {
            eprintln!("fake-storybook: {}: {error}", log.display());
            return ExitCode::FAILURE;
        }
    }
    if asked.mode == "fail" {
        eprint!(
            "│\n▲  Failed to load preset: \".storybook/main.ts\"\n│\n\
             ■  \u{1b}[31mError: Cannot find module 'storybook'\u{1b}[39m\n│\n\
             └  Storybook exited with an error\n"
        );
        return ExitCode::FAILURE;
    }
    if asked.mode == "child" {
        // In the process's group, holding its output, and outliving it.
        let mut child = Command::new("sleep");
        if let Err(error) = child.arg("1000000").stdin(Stdio::null()).spawn() {
            eprintln!("fake-storybook: sleep: {error}");
            return ExitCode::FAILURE;
        }
    }
    let fake = Arc::new(Fake {
        mode: asked.mode,
        base,
        folder,
        served: Mutex::new(Vec::new()),
    });
    let runtime = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build();
    match runtime.map(|runtime| runtime.block_on(serve(fake, asked.port))) {
        Ok(Ok(())) => ExitCode::SUCCESS,
        Ok(Err(error)) if error.kind() == ErrorKind::AddrInUse => {
            eprintln!("Port {} is not available", asked.port);
            ExitCode::FAILURE
        }
        Ok(Err(error)) | Err(error) => {
            eprintln!("fake-storybook: {error}");
            ExitCode::FAILURE
        }
    }
}

/// Reads the arguments: `--port`, which it needs, `--mode`, and `--log`.
fn asked(args: impl IntoIterator<Item = String>) -> Result<Asked, String> {
    let mut args = args.into_iter();
    let (mut port, mut mode, mut log) = (None, "ok".to_owned(), None);
    while let Some(name) = args.next() {
        let value = args.next().ok_or(format!("{name} needs a value"))?;
        match name.as_str() {
            "--port" => port = Some(value.parse().map_err(|_| format!("{value} is no port"))?),
            "--mode" => mode = value,
            "--log" => log = Some(PathBuf::from(value)),
            _ => return Err(format!("unknown argument {name}")),
        }
    }
    let port = port.ok_or("--port is needed")?;
    Ok(Asked { port, mode, log })
}

/// Appends a start to the log, a line. A copy of a cached fixture may name the log of the
/// start that built it, long removed: its folder is made again.
fn logged(log: &Path, start: &Value) -> std::io::Result<()> {
    if let Some(folder) = log.parent() {
        fs::create_dir_all(folder)?;
    }
    let mut file = fs::OpenOptions::new().create(true).append(true).open(log)?;
    writeln!(file, "{start}")
}

/// Listens on loopback, says so as Storybook does, and answers until the process is killed.
async fn serve(fake: Arc<Fake>, port: u16) -> std::io::Result<()> {
    let listener = tokio::net::TcpListener::bind(("127.0.0.1", port)).await?;
    println!("Storybook ready on http://127.0.0.1:{port}/");
    axum::serve(listener, Router::new().fallback(answer).with_state(fake)).await
}

/// Answers one request.
async fn answer(State(fake): State<Arc<Fake>>, request: Request) -> Response {
    let (mut parts, _) = request.into_parts();
    let path = parts.uri.path().to_owned();
    if parts.headers.contains_key(header::UPGRADE) {
        return socket(&fake, &mut parts).await;
    }
    if path != "/__requests" {
        fake.served.lock().expect("the list").push(path.clone());
    }
    let query = |name: &str| {
        let pairs = url::form_urlencoded::parse(parts.uri.query().unwrap_or("").as_bytes());
        let found = pairs.into_iter().find(|(key, _)| key == name);
        found.map(|(_, value)| value.into_owned())
    };
    let html = "text/html; charset=utf-8";
    match path.as_str() {
        "/index.json" => {
            if fake.mode == "hang" {
                std::future::pending::<()>().await;
            }
            typed("application/json", pages::index(&fake.folder).to_string())
        }
        "/" | "/index.html" => typed(html, pages::manager(&fake.folder, query("path").as_deref())),
        "/iframe.html" => match pages::story(&fake.folder, &query("id").unwrap_or_default()) {
            Some(page) => {
                let policy = HeaderValue::from_static("frame-ancestors 'none'");
                (
                    [(header::CONTENT_SECURITY_POLICY, policy)],
                    typed(html, page),
                )
                    .into_response()
            }
            None => (StatusCode::NOT_FOUND, "No such story").into_response(),
        },
        "/story.js" => typed("text/javascript", pages::STORY_JS.to_owned()),
        "/uraeda-pick.js" => typed("text/javascript", pages::PICK.to_owned()),
        "/__echo" => typed("application/json", echo(&parts).to_string()),
        "/__headers" => {
            let headers = [
                ("clear-site-data", "\"cookies\", \"storage\""),
                ("connection", "x-custom"),
                ("set-cookie", "session=storybook; Path=/"),
                ("x-custom", "1"),
            ];
            (headers, "headers").into_response()
        }
        "/__requests" => {
            let served = fake.served.lock().expect("the list").clone();
            typed("application/json", json!(served).to_string())
        }
        _ => match source(&fake.folder, &path).and_then(|file| fs::read(file).ok()) {
            Some(text) => ([(header::CONTENT_TYPE, "text/javascript")], text).into_response(),
            None => (StatusCode::NOT_FOUND, "Not found").into_response(),
        },
    }
}

/// An answer of a type.
fn typed(kind: &'static str, body: String) -> Response {
    ([(header::CONTENT_TYPE, kind)], body).into_response()
}

/// The file under the working folder at a request's path, when there is one.
fn source(folder: &Path, path: &str) -> Option<PathBuf> {
    let path = percent_encoding::percent_decode_str(path)
        .decode_utf8()
        .ok()?;
    let inside = Path::new(path.trim_start_matches('/'));
    let plain = inside
        .components()
        .all(|part| matches!(part, Component::Normal(_)));
    let file = folder.join(inside);
    (plain && file.is_file()).then_some(file)
}

/// What a request got: its path, its query's values by name, `Host`, `Origin`, and headers.
fn echo(parts: &Parts) -> Value {
    let mut query = Map::new();
    for (name, value) in url::form_urlencoded::parse(parts.uri.query().unwrap_or("").as_bytes()) {
        let values = query.entry(name.into_owned()).or_insert_with(|| json!([]));
        if let Some(values) = values.as_array_mut() {
            values.push(json!(value));
        }
    }
    let path = parts.uri.path_and_query().map_or("/", |path| path.as_str());
    json!({
        "headers": named(&parts.headers),
        "host": one(&parts.headers, "host"),
        "origin": one(&parts.headers, "origin"),
        "path": path,
        "query": query,
    })
}

/// A request's headers by name, a name sent twice joined by a comma.
fn named(headers: &HeaderMap) -> Value {
    let mut named: Map<String, Value> = Map::new();
    for (name, value) in headers {
        let value = String::from_utf8_lossy(value.as_bytes()).into_owned();
        let held = named.get(name.as_str()).and_then(Value::as_str);
        let both = held.map_or(value.clone(), |held| format!("{held}, {value}"));
        named.insert(name.to_string(), json!(both));
    }
    Value::Object(named)
}

/// A header's value, or null.
fn one(headers: &HeaderMap, name: &str) -> Value {
    let value = headers.get(name).and_then(|value| value.to_str().ok());
    value.map_or(Value::Null, |value| json!(value))
}

/// A WebSocket's upgrade: Storybook's channel, refused to a page of no origin, and Vite's
/// socket under the base. Each sends what the upgrade got, then stays open.
async fn socket(fake: &Fake, parts: &mut Parts) -> Response {
    let path = parts.uri.path();
    let protocol = one(&parts.headers, "sec-websocket-protocol");
    let channel = path == "/storybook-server-channel";
    let hmr = path.starts_with(&fake.base) && protocol == "vite-hmr";
    if channel && one(&parts.headers, "origin") == "null" {
        return StatusCode::FORBIDDEN.into_response();
    }
    if !channel && !hmr {
        return StatusCode::NOT_FOUND.into_response();
    }
    let echo = echo(parts).to_string();
    let upgrade = match WebSocketUpgrade::from_request_parts(parts, &()).await {
        Ok(upgrade) if hmr => upgrade.protocols(["vite-hmr"]),
        Ok(upgrade) => upgrade,
        Err(refused) => return refused.into_response(),
    };
    upgrade.on_upgrade(|mut socket| async move {
        if socket.send(Message::Text(echo.into())).await.is_ok() {
            while socket.recv().await.is_some() {}
        }
    })
}
