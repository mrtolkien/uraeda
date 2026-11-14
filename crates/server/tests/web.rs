//! The app's web build, as `ura serve-app` serves it: its files compressed and cached by their hash,
//! its page at every address of the app and at none of the server's, and what a first load
//! weighs. The server's tests read a small stand-in build, a folder `URAEDA_WEB_BUILD` names; the
//! last test measures the real one, and `just web-build` runs it.

use crate::support;

use std::fs;
use std::io::Write as _;
use std::path::{Path, PathBuf};

use flate2::Compression;
use flate2::write::GzEncoder;
use support::{TestResponse, TestServer};
use tempfile::TempDir;

/// What a browser asks a page with, as it opens an address.
const NAVIGATION: &str = "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8";

/// The stand-in's page: an inline script, as the real page has, and a module.
const PAGE: &str = "<!doctype html><title>Uraeda</title><script>start()</script>\
    <script type=\"module\" src=\"app.0123456789.js\"></script>";

const MODULE: &str = "console.log('the app')";

/// `text`, compressed as gzip.
fn gzip(text: &str) -> Vec<u8> {
    let mut encoder = GzEncoder::new(Vec::new(), Compression::default());
    encoder.write_all(text.as_bytes()).unwrap();
    encoder.finish().unwrap()
}

/// A stand-in build: a page, a module named by its hash with its two compressed forms, a module
/// held compressed alone, as the build `ura` embeds holds them, a font with no compressed form,
/// and the manifest, which has no hash.
fn stand_in() -> TempDir {
    let build = TempDir::new().unwrap();
    let write = |path: &str, bytes: &[u8]| {
        let file = build.path().join(path);
        fs::create_dir_all(file.parent().unwrap()).unwrap();
        fs::write(file, bytes).unwrap();
    };
    write("index.html", PAGE.as_bytes());
    write("app.0123456789.js", MODULE.as_bytes());
    write("app.0123456789.js.br", b"the module, as brotli");
    write("app.0123456789.js.gz", &gzip(MODULE));
    write("held.abcdef0123.js.br", b"held, as brotli");
    write("held.abcdef0123.js.gz", &gzip("held()"));
    write("assets/fonts/neon.89abcdef01.woff2", b"a font");
    write("manifest.webmanifest", b"{}");
    build
}

/// A server over the stand-in build.
async fn serving(build: &TempDir) -> TestServer {
    let folder = build.path().to_str().unwrap();
    support::setup()
        .env("URAEDA_WEB_BUILD", folder)
        .start()
        .await
}

/// A file of the build, asked as a browser that takes `encodings` asks it.
async fn file(server: &TestServer, path: &str, encodings: Option<&str>) -> TestResponse {
    let request = server.get(path).header("accept", "*/*");
    let request = match encodings {
        Some(encodings) => request.header("accept-encoding", encodings),
        None => request,
    };
    request.send().await
}

/// An address opened in a browser.
async fn opened(server: &TestServer, path: &str) -> TestResponse {
    server.get(path).header("accept", NAVIGATION).send().await
}

#[tokio::test]
async fn the_apps_files_are_served_compressed_and_cached_by_their_hash() {
    let build = stand_in();
    let server = serving(&build).await;
    let forever = Some("public, max-age=31536000, immutable");

    // The smallest form the browser takes, and the name's hash caches it for good.
    let brotli = file(&server, "/app.0123456789.js", Some("gzip, deflate, br")).await;
    assert_eq!(brotli.status, 200);
    assert_eq!(brotli.header("content-encoding"), Some("br"));
    assert_eq!(brotli.body, b"the module, as brotli");
    assert_eq!(brotli.header("cache-control"), forever);
    assert_eq!(brotli.header("vary"), Some("Accept-Encoding"));
    let kind = brotli.header("content-type").unwrap();
    assert!(kind.starts_with("text/javascript"), "{kind}");

    let gzipped = file(&server, "/app.0123456789.js", Some("gzip, deflate")).await;
    assert_eq!(gzipped.header("content-encoding"), Some("gzip"));
    assert_eq!(gzipped.body, gzip(MODULE));
    // An encoding the browser refuses is not sent.
    let refused = file(&server, "/app.0123456789.js", Some("br;q=0, gzip")).await;
    assert_eq!(refused.header("content-encoding"), Some("gzip"));
    let plain = file(&server, "/app.0123456789.js", None).await;
    assert_eq!(plain.header("content-encoding"), None);
    assert_eq!(plain.text(), MODULE);

    // A file held compressed alone still reaches a client that takes no encoding.
    let held = file(&server, "/held.abcdef0123.js", None).await;
    assert_eq!((held.status, held.text().as_str()), (200, "held()"));
    assert_eq!(held.header("content-encoding"), None);

    // A file with no compressed form is sent as it is.
    let font = file(&server, "/assets/fonts/neon.89abcdef01.woff2", Some("br")).await;
    assert_eq!(font.body, b"a font");
    assert_eq!(font.header("content-encoding"), None);
    assert_eq!(font.header("content-type"), Some("font/woff2"));
    assert_eq!(font.header("cache-control"), forever);

    // The page and the manifest have no hash: each load asks whether they changed.
    let page = opened(&server, "/").await;
    assert_eq!(page.header("cache-control"), Some("no-cache"));
    let tag = page.header("etag").expect("the page has a tag").to_owned();
    let again = server.get("/").header("accept", NAVIGATION);
    let again = again.header("if-none-match", &tag).send().await;
    assert_eq!((again.status, again.body.len()), (304, 0));
    let manifest = file(&server, "/manifest.webmanifest", None).await;
    assert_eq!(manifest.header("cache-control"), Some("no-cache"));
    // So does every other unhashed file, as the frame an extension's page loads in each time.
    let tag = manifest.header("etag").expect("the manifest has a tag");
    let again = server
        .get("/manifest.webmanifest")
        .header("if-none-match", tag);
    let again = again.send().await;
    assert_eq!((again.status, again.body.len()), (304, 0));
    assert_eq!(again.header("access-control-allow-origin"), Some("*"));
    let changed = server
        .get("/manifest.webmanifest")
        .header("if-none-match", "\"other\"");
    assert_eq!(changed.send().await.body, b"{}");
}

#[tokio::test]
async fn an_extensions_frame_reaches_no_other_site_and_opens_no_popup() {
    let build = stand_in();
    fs::write(build.path().join("extension.html"), "<!doctype html>").unwrap();
    let server = serving(&build).await;
    let frame = file(&server, "/extension.html", None).await;
    let policy = frame.header("content-security-policy").expect("a policy");
    for rule in [
        "connect-src 'self'",
        "form-action 'none'",
        "sandbox allow-scripts allow-same-origin",
    ] {
        assert!(policy.contains(rule), "{rule} in {policy}");
    }
    assert!(!policy.contains("allow-popups"), "{policy}");
}

#[tokio::test]
async fn an_unknown_path_answers_the_app_and_a_server_path_does_not() {
    let build = stand_in();
    let server = serving(&build).await;

    // A reload, or a shared address, of any page of the app: the page, with no session.
    for address in [
        "/",
        "/r/sample/inbox",
        "/r/sample/f/2026-10-19-dark-mode/spec.md?version=2",
        "/settings/fonts",
        "/r/sample/e/usage",
    ] {
        let page = opened(&server, address).await;
        assert_eq!(
            (page.status, page.text().as_str()),
            (200, PAGE),
            "{address}"
        );
        let kind = page.header("content-type").unwrap();
        assert!(kind.starts_with("text/html"), "{address}: {kind}");
    }
    // Only Uraeda's own pages frame it, and it loads and reaches nothing but its own origin.
    let page = opened(&server, "/r/sample/inbox").await;
    assert_eq!(page.header("x-frame-options"), Some("SAMEORIGIN"));
    let policy = page.header("content-security-policy").expect("a policy");
    for rule in [
        "default-src 'self'",
        "connect-src 'self'",
        "frame-ancestors 'self'",
        "object-src 'none'",
    ] {
        assert!(policy.contains(rule), "{rule} in {policy}");
    }

    // A path under one of the server's own answers its own 404, in a browser too.
    for path in [
        "/session/a/b",
        "/live/again",
        "/pair/code/more",
        "/mcp/tools",
        "/open/it",
        "/extensions/none/missing",
        "/x/none",
        "/r/sample/raw",
        "/r/sample/preview",
        "/r/sample/mockups",
    ] {
        let answer = opened(&server, path).await;
        assert_ne!(answer.text(), PAGE, "{path}");
        assert!(
            matches!(answer.status, 401 | 404),
            "{path}: {}",
            answer.status
        );
    }
    // What is not a page opened in a browser gets no page: a module of an older build, a write.
    let module = file(&server, "/app.aaaaaaaaaa.js", Some("br")).await;
    assert_eq!((module.status, module.text().as_str()), (404, "Not found"));
    let write = server.post("/r/sample/inbox").header("accept", NAVIGATION);
    assert_eq!(write.send().await.status, 404);

    // Nothing but the build's files became open, and the guard still comes first.
    let closed = server.request("DELETE", "/sessions").send().await;
    assert_eq!(closed.status, 401);
    let rebound = opened(&server, "/").await;
    assert_eq!(rebound.status, 200);
    let rebound = server.get("/").header("accept", NAVIGATION);
    let rebound = rebound.header("host", "evil.example").send().await;
    assert_eq!(rebound.status, 403);
}

#[tokio::test]
async fn a_server_built_without_the_app_says_how_to_build_it() {
    // No test's `ura` holds a web build: only `just package` and a release embed one.
    let server = support::server().await;

    let page = opened(&server, "/r/sample/inbox").await;

    assert_eq!(page.status, 200);
    assert!(page.text().contains("just web-build"), "{}", page.text());
    assert_eq!(page.header("cache-control"), Some("no-cache"));
    let module = file(&server, "/app.0123456789.js", None).await;
    assert_eq!(module.status, 404);
}

/// The real build's folder: `URAEDA_WEB_BUILD`, or `target/web` of the checkout.
fn real_build() -> PathBuf {
    std::env::var_os("URAEDA_WEB_BUILD").map_or_else(
        || Path::new(env!("CARGO_MANIFEST_DIR")).join("../../target/web"),
        PathBuf::from,
    )
}

/// The most a first load may weigh, compressed: the plan's 3 MB. The build weighs 2.98 MB, of
/// which Native Shell's engine and the app's Rust are 2.48 MB, the verification of extension pages
/// 86 KB of them, and the one font face before the first frame 0.2 MB; the others come with the
/// chunks that register them (rulings R471, R475). A limit of 2.95 MB failed the release of 2.0.0
/// on its version alone, which moved the WebAssembly by 41 KB: the limit is the plan's, not the
/// last build's.
const FIRST_LOAD: u64 = 3_000_000;

/// What a first load never fetches: the syntaxes and the formulas' fonts, which come with the
/// first code block and the first formula, the icons a browser picks one of, the licences, an
/// extension page's frame, which comes with the first extension page, and what the page fetches
/// with a chunk the app imports later, `later`: its script and its fonts.
fn comes_later(path: &str, later: &[String]) -> bool {
    let name = path.rsplit('/').next().unwrap_or(path);
    later.iter().any(|chunk| *chunk == unhashed(path))
        || name.starts_with("nsh-syntaxes.")
        || name.starts_with("nsh-math.")
        || name.starts_with("nsh-emoji.")
        || name.starts_with("LICENSE")
        || path.starts_with("icons/")
        || name == "manifest.webmanifest"
        || path == "extension.html"
        || path == "notify-worker.js"
}

/// A file's path without the digest of its content Native Shell names it with:
/// `assets/a.0123456789.woff2` is `assets/a.woff2`.
fn unhashed(path: &str) -> String {
    let parts: Vec<&str> = path.split('.').collect();
    let digest = |part: &&str| part.len() == 10 && part.bytes().all(|b| b.is_ascii_hexdigit());
    match parts.iter().rposition(digest) {
        Some(at) if at > 0 => [&parts[..at], &parts[at + 1..]].concat().join("."),
        _ => path.to_owned(),
    }
}

/// What the page fetches with its chunks, as it names them: each chunk's script, and the fonts
/// that come with it (`assets/<path>`), without their digests.
fn chunked(build: &Path) -> Vec<String> {
    let page = fs::read_to_string(build.join("index.html")).unwrap();
    let value = |key: &str| {
        let at = page
            .find(&format!("\"{key}\":"))
            .map(|at| at + key.len() + 3);
        let rest = at.map_or("{}", |at| &page[at..]);
        let mut values = serde_json::Deserializer::from_str(rest).into_iter::<serde_json::Value>();
        values.next().and_then(Result::ok).unwrap_or_default()
    };
    let mut later = Vec::new();
    for script in value("chunks")
        .as_object()
        .into_iter()
        .flat_map(|chunks| chunks.values())
    {
        let url = script.as_str().unwrap_or_default();
        later.push(unhashed(url.trim_start_matches("./")));
    }
    for fonts in value("chunkFonts")
        .as_object()
        .into_iter()
        .flat_map(|fonts| fonts.values())
    {
        for font in fonts.as_array().into_iter().flatten() {
            later.push(format!("assets/{}", font.as_str().unwrap_or_default()));
        }
    }
    later
}

/// Every file under `folder`, by its path from it.
fn files(folder: &Path, under: &str, found: &mut Vec<(String, u64)>) {
    for entry in fs::read_dir(folder).unwrap().flatten() {
        let name = entry.file_name().into_string().unwrap();
        let path = format!("{under}{name}");
        if entry.path().is_dir() {
            files(&entry.path(), &format!("{path}/"), found);
        } else {
            found.push((path, entry.metadata().unwrap().len()));
        }
    }
}

#[test]
#[ignore = "measures the real web build: `just web-build` runs it"]
fn the_first_load_is_within_its_limit() {
    let build = real_build();
    assert!(
        build.join("index.html").exists(),
        "no web build in {}: run `just web-build`",
        build.display()
    );
    let mut found = Vec::new();
    files(&build, "", &mut found);
    let later = chunked(&build);
    let size = |path: &str| {
        found
            .iter()
            .find(|(name, _)| name == path)
            .map(|file| file.1)
    };
    // Each file as a browser that takes brotli gets it.
    let mut loaded: Vec<(u64, &str)> = found
        .iter()
        .filter(|(path, _)| !path.ends_with(".br") && !path.ends_with(".gz"))
        .filter(|(path, _)| !comes_later(path, &later))
        .map(|(path, raw)| (size(&format!("{path}.br")).unwrap_or(*raw), path.as_str()))
        .collect();
    loaded.sort_unstable_by(|a, b| b.cmp(a));
    let total: u64 = loaded.iter().map(|file| file.0).sum();
    println!("the first load: {total} bytes, compressed");
    for (bytes, path) in loaded.iter().take(12) {
        println!("{bytes:>9}  {path}");
    }
    assert!(
        total <= FIRST_LOAD,
        "the first load is {total} bytes, over {FIRST_LOAD}: see rulings R445 and R471"
    );
}
