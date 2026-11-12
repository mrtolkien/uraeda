//! Extension pages in a browser: the four tests of the Linux view (`crates/app/tests/extensions.rs`)
//! on the web build, over a sandbox with the fixture pages `counter`, `crashes`, `loops`, and
//! `forges` beside its own. Each page runs in a frame of its own (`app/extensions/host.web.tsx`),
//! which the test cannot read: what a page did is read from the app's page, and from the server.
//!
//! The plan named `app/web/extensions.test.ts`: a test of the page `ura` serves belongs here, in the
//! Rust harness, as task 56 found, since `nsh test --target web` runs on NSH's own page.

use std::path::Path;
use std::time::{Duration, Instant};

use serde_json::Value;
use tempfile::TempDir;
use uraeda_server::Server;
use uraeda_server::sandbox::{self, Sandbox};

use super::app::Served;
use super::cdp::{Browser, DESKTOP, PHONE};
use super::shots;

/// The fixture pages these tests add to the sandbox's own extensions.
const FIXTURES: [&str; 4] = ["counter", "crashes", "loops", "forges"];

/// A signed-in browser on a sandbox with the fixture pages.
struct Opened {
    _folder: TempDir,
    server: Server,
    browser: Browser,
    /// The sandbox's extensions folder, where the owner saves a page.
    extensions: std::path::PathBuf,
}

impl Opened {
    async fn new() -> Opened {
        Opened::in_mode("dark").await
    }

    /// A browser that shows the app in a theme's mode, `dark` or `light`.
    async fn in_mode(mode: &str) -> Opened {
        let mut extensions = std::path::PathBuf::new();
        let served = Served::with(DESKTOP, mode, |built: &Sandbox| {
            extensions = built.config_dir.join("extensions");
            for name in FIXTURES {
                let from = sandbox::checkout().join("fixtures/extensions").join(name);
                copy(&from, &extensions.join(name));
            }
        })
        .await;
        Opened {
            _folder: served.folder,
            server: served.server,
            browser: served.browser,
            extensions,
        }
    }

    /// Opens an address of the sample repository, as a link does.
    async fn open(&mut self, path: &str) {
        let address = format!("{}/r/sample{path}", self.server.address());
        self.browser.open(&address).await;
    }

    /// What the counter's page got, as its action `done` was told: waits for it.
    async fn counted(&mut self) -> Value {
        let asked = "fetch('/x/counter/done').then((answer) => answer.json())";
        let started = Instant::now();
        loop {
            let done = self.browser.evaluate(asked).await;
            if !done.is_null() {
                return done;
            }
            assert!(
                started.elapsed() < Duration::from_secs(60),
                "the counter's page never said what it got: {}",
                self.browser.said()
            );
            tokio::time::sleep(Duration::from_millis(100)).await;
        }
    }

    /// The app answers keys: `g i` opens the inbox.
    async fn goes_on(&mut self) {
        self.browser.press("g").await;
        self.browser.press("i").await;
        self.browser.shows("We need a home icon").await;
    }
}

/// Copies a folder, as the owner puts an extension in their extensions folder.
fn copy(from: &Path, to: &Path) {
    std::fs::create_dir_all(to).expect("a folder");
    for entry in std::fs::read_dir(from).expect("a fixture").flatten() {
        let path = entry.path();
        if path.is_dir() {
            copy(&path, &to.join(entry.file_name()));
        } else {
            std::fs::copy(&path, to.join(entry.file_name())).expect("a file");
        }
    }
}

// The spec's US3: a saved page shows without a restart.
#[tokio::test]
#[ignore = "needs the real web build and a browser: `just web-test` runs it"]
async fn a_saved_page_shows_without_a_restart() {
    let mut app = Opened::new().await;
    app.open("/e/counter/counter").await;
    assert_eq!(app.counted().await["got"], 4);
    app.browser.shows("Counter").await;
    app.browser
        .picture(&shots().join("extension-counter-dark-1400.png"))
        .await;

    // The owner saves the page: the server builds it again, a new version, which the app's
    // record says, and the place loads it in a new frame.
    let page = app.extensions.join("counter/page.tsx");
    let text = std::fs::read_to_string(&page).expect("the page");
    let saved = text.replace("title: \"Counter\"", "title: \"Counter, saved\"");
    std::fs::write(&page, saved).expect("the saved page");
    app.browser.shows("Counter, saved").await;
    drop(app.browser);
    app.server.stop().await;
}

#[tokio::test]
#[ignore = "needs the real web build and a browser: `just web-test` runs it"]
async fn a_page_that_throws_at_load_is_named_and_the_app_goes_on() {
    let mut app = Opened::new().await;
    app.open("/e/crashes/crashes").await;
    app.browser
        .shows("The page of Crashes failed as it loaded")
        .await;
    app.browser.shows("Error: broken at load").await;
    app.browser
        .picture(&shots().join("extension-crashes-dark-1400.png"))
        .await;
    app.goes_on().await;
    drop(app.browser);
    app.server.stop().await;
}

// A browser cuts off no call: the page's frame holds its own thread, answers no ping, and is taken
// away after 5 s. The app's thread never waits for it: each look at the page below is answered.
#[tokio::test]
#[ignore = "needs the real web build and a browser: `just web-test` runs it"]
async fn a_page_that_never_stops_is_cut_off_and_named() {
    let mut app = Opened::new().await;
    app.open("/e/loops/loops").await;
    let started = Instant::now();
    app.browser.shows("The page of Loops stopped").await;
    println!("loops was named after {:?}", started.elapsed());
    app.browser
        .picture(&shots().join("extension-loops-dark-1400.png"))
        .await;
    app.goes_on().await;
    drop(app.browser);
    app.server.stop().await;
}

// A page reaches the app only through its frame's channel: its own extension's records and
// actions, never another's, nothing of the machine, and no answer another page forged.
#[tokio::test]
#[ignore = "needs the real web build and a browser: `just web-test` runs it"]
async fn a_page_reads_a_record_and_calls_an_action_of_its_extension() {
    let mut app = Opened::new().await;
    // Every page's declarations are read once: `forges` then runs in the status line, posting
    // forged answers into every frame of the app's page.
    app.browser.shows("Counter").await;
    app.open("/e/counter/counter").await;
    let got = app.counted().await;
    // The record read 3, and the action answered 4: no forged answer, 99, reached the page.
    assert_eq!(got["got"], 4, "{got}");
    assert_eq!(got["outside"], "ERR_ACCESS_DENIED", "{got}");
    assert_eq!(got["token"], "ERR_ACCESS_DENIED", "{got}");
    assert_ne!(got["fetched"], "allowed", "{got}");
    assert_eq!(got["stolen"], false, "a page read echo's record: {got}");
    let forged = app
        .browser
        .evaluate("document.body.innerText.includes('forged')")
        .await;
    assert_eq!(
        forged, false,
        "a page's problem forged by another page was shown"
    );
    drop(app.browser);
    app.server.stop().await;
}

// For the eye, not a check: the documentation's Wiki and the sandbox's Hello, each in its pane, in
// both themes, at a desktop's width and a phone's, beside the GTK pictures of `just app-shots`.
#[tokio::test]
#[ignore = "needs the real web build and a browser: `just web-test` runs it"]
async fn pictures_of_extension_pages() {
    for mode in ["dark", "light"] {
        let mut app = Opened::in_mode(mode).await;
        for (name, words) in [("wiki", "Wiki"), ("hello", "Hello")] {
            for (size, width) in [(DESKTOP, 1400), (PHONE, 390)] {
                app.browser.show(size, mode).await;
                app.open(&format!("/e/{name}/{name}")).await;
                app.browser.shows(words).await;
                // The frame draws after the app's page: its player starts, then the page.
                tokio::time::sleep(Duration::from_secs(3)).await;
                let file = format!("extension-{name}-{mode}-{width}.png");
                app.browser.picture(&shots().join(file)).await;
            }
        }
        drop(app.browser);
        app.server.stop().await;
    }
}
