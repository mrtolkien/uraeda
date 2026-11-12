//! The web build in a real browser, over a sandbox that keeps sign-in: `just web-test` runs it,
//! after `just web-build`. No other run does: it needs the real build, `URAEDA_WEB_BUILD`, and
//! the dev shell's headless Chromium, which `browser/cdp.rs` drives over the DevTools protocol.
//!
//! It is the one check of what only a browser shows: the page loads under its own policy, the
//! access key signs a browser in, the home page draws, and what the first load weighed on the
//! wire. Its pictures, in `URAEDA_SHOTS`, are for the eye: the same page as on GTK?

#[path = "browser/app.rs"]
mod app;
#[path = "browser/bench.rs"]
mod bench;
#[path = "browser/cdp.rs"]
mod cdp;
#[path = "browser/extensions.rs"]
mod extensions;
#[path = "browser/frames.rs"]
mod frames;
#[path = "browser/pictures.rs"]
mod pictures;
#[path = "browser/protocol.rs"]
mod protocol;

use std::path::{Path, PathBuf};

use cdp::{Browser, DESKTOP, PHONE};
use tempfile::TempDir;
use uraeda_server::sandbox::{self, Mode, Prepare, Sandbox};
use uraeda_server::{Server, sign_in};

/// The folder of the web build to serve.
pub fn web_build() -> String {
    let build = std::env::var("URAEDA_WEB_BUILD").unwrap_or_else(|_| {
        let checkout = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../target/web");
        checkout.to_string_lossy().into_owned()
    });
    assert!(
        Path::new(&build).join("index.html").exists(),
        "no web build in {build}: run `just web-build`"
    );
    build
}

/// Where the pictures go.
pub fn shots() -> PathBuf {
    let folder = std::env::var("URAEDA_SHOTS").map_or_else(
        |_| Path::new(env!("CARGO_MANIFEST_DIR")).join("../../target/shots/web"),
        PathBuf::from,
    );
    std::fs::create_dir_all(&folder).expect("the pictures' folder");
    folder
}

/// A sandbox of `prepare` that keeps sign-in, serving the web build, in a temporary folder: the
/// server, and its access key. `before` adds to the sandbox before the server starts.
async fn signed_sandbox(
    prepare: Prepare,
    before: impl FnOnce(&Sandbox),
) -> (TempDir, Server, String) {
    let folder = TempDir::new().unwrap();
    let built = sandbox::prepare(&folder.path().join("sandbox"), prepare).unwrap();
    before(&built);
    // The process's environment, as `ura sandbox` gives it, with the build to serve.
    let mut environment: Vec<(String, String)> = std::env::vars()
        .filter(|(name, _)| name != "URAEDA_WEB_BUILD")
        .collect();
    environment.push(("URAEDA_WEB_BUILD".to_owned(), web_build()));
    let options = sandbox::options(&built, 0, Mode { sign_in: true }, environment);
    let server = Server::start(options).await.expect("the sandbox starts");
    let key = sign_in::key_at_start(server.shared())
        .expect("its file is written")
        .expect("a start with sign-in shows its key");
    (folder, server, key)
}

#[tokio::test]
#[ignore = "needs the real web build and a browser: `just web-test` runs it"]
async fn a_browser_signs_in_with_the_access_key_and_sees_the_home_page() {
    let (_folder, server, key) = signed_sandbox(Prepare::default(), |_| ()).await;
    let home = format!("{}/r/sample/", server.address());
    let shots = shots();

    // A first visit, with nothing cached: the page, its sign-in, then the home page.
    let mut browser = Browser::start().await;
    browser.show(DESKTOP, "dark").await;
    browser.open(&home).await;
    browser.shows("Sign in to Uraeda").await;
    browser.picture(&shots.join("sign-in-dark-1400.png")).await;
    let requests = browser.transferred().await;
    let bytes: u64 = requests.iter().map(|request| request.0).sum();
    println!(
        "the first load: {bytes} bytes on the wire, in {} requests",
        requests.len()
    );
    for (bytes, encoding, url) in requests.iter().take(10) {
        println!("{bytes:>9}  {encoding:<5} {url}");
    }
    // The page asks whether the browser is signed in, and the browser's console notes the 401
    // that says it is not: nothing else may complain, a script its policy refused least of all.
    let complaints = browser.said();
    let complaints: Vec<&str> = complaints
        .lines()
        .filter(|line| !line.ends_with("/session)"))
        .collect();
    assert!(
        complaints.is_empty(),
        "the page complained: {complaints:#?}"
    );

    // A key that is not the server's is refused in the server's words, under the field.
    browser.types("ura_not-the-key").await;
    browser.enter().await;
    browser.shows("This is not Uraeda's access key.").await;
    browser.evaluate("document.execCommand('selectAll')").await;
    browser.types(&key).await;
    browser.enter().await;
    browser.shows("Needs you").await;
    // Its records came, after the page drew: a feature that stopped.
    browser.shows("Due dates").await;
    browser.picture(&shots.join("home-dark-1400.png")).await;

    // The browser keeps the session: a reload opens the page, at a phone's size too.
    browser.show(PHONE, "dark").await;
    browser.open(&home).await;
    browser.shows("Due dates").await;
    browser.picture(&shots.join("home-dark-390.png")).await;
    // The app keeps the theme a device showed last: the light pictures are another browser's.
    let mut light = Browser::start().await;
    for (size, name) in [
        (DESKTOP, "home-light-1400.png"),
        (PHONE, "home-light-390.png"),
    ] {
        light.show(size, "light").await;
        light.open(&home).await;
        if size.width == DESKTOP.width {
            light.shows("Sign in to Uraeda").await;
            light.picture(&shots.join("sign-in-light-1400.png")).await;
            light.types(&key).await;
            light.enter().await;
        }
        light.shows("Due dates").await;
        light.picture(&shots.join(name)).await;
    }
    drop(light);
    // A shared address of another page opens that page.
    browser.show(DESKTOP, "dark").await;
    browser
        .open(&format!("{}/r/sample/inbox", server.address()))
        .await;
    browser.shows("We need a home icon").await;
    browser.picture(&shots.join("inbox-dark-1400.png")).await;
    let complaints = browser.said();
    println!("what the pages said:\n{complaints}");

    drop(browser);
    server.stop().await;
}
