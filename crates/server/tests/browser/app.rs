//! The app as a browser runs it: its addresses, the tab's history, a reload, and a phone's touch.
//! Each test serves a sandbox of its own, with sign-in, to a browser of its own.

use tempfile::TempDir;
use uraeda_server::Server;
use uraeda_server::sandbox::Sandbox;

use super::cdp::{Browser, DESKTOP, PHONE, Size};
use super::signed_sandbox;

/// A sandbox served with the web build, and a browser signed in to it.
pub struct Served {
    pub browser: Browser,
    pub server: Server,
    pub folder: TempDir,
}

impl Served {
    /// Serves a fresh sandbox, and signs a browser of `size`, in `mode`, in at the home page.
    pub async fn start(size: Size, mode: &str) -> Served {
        Served::with(size, mode, |_| ()).await
    }

    /// As [`Served::start`], with `before` adding to the sandbox before its server starts.
    pub async fn with(size: Size, mode: &str, before: impl FnOnce(&Sandbox)) -> Served {
        let (folder, server, key) = signed_sandbox(before).await;
        let mut browser = Browser::start().await;
        browser.show(size, mode).await;
        browser
            .open(&format!("{}/r/sample/", server.address()))
            .await;
        browser.shows("Sign in to Uraeda").await;
        let field = browser.field().await;
        browser.click_at(field).await;
        browser.types(&key).await;
        browser.enter().await;
        browser.shows("Due dates").await;
        Served {
            browser,
            server,
            folder,
        }
    }

    /// The whole address of a path of the server.
    pub fn address(&self, path: &str) -> String {
        format!("{}{path}", self.server.address())
    }

    pub async fn stop(self) {
        drop(self.browser);
        self.server.stop().await;
    }
}

/// The feature the tests open: one that stopped, which no other test changes.
const FEATURE: &str = "/r/sample/f/2026-10-17-due-dates";

#[tokio::test]
#[ignore = "needs the real web build and a browser: `just web-test` runs it"]
async fn a_features_address_opens_it_and_back_returns() {
    let mut served = Served::start(DESKTOP, "dark").await;
    let browser = &mut served.browser;
    browser.at("/r/sample/").await;

    // A press in the app opens the feature, and the address follows.
    browser.click("Due dates").await;
    browser.at(FEATURE).await;
    browser.shows("Steps").await;
    // The browser's Back returns to the page before, and Forward goes to the feature again.
    browser.evaluate("history.back()").await;
    browser.at("/r/sample/").await;
    browser.shows("Needs you").await;
    browser.evaluate("history.forward()").await;
    browser.at(FEATURE).await;
    browser.shows("Steps").await;

    // A pasted address opens its page, and an old one is written as the page's address now.
    let address = served.address(FEATURE);
    served.browser.open(&address).await;
    served.browser.shows("Steps").await;
    served.browser.at(FEATURE).await;
    let old = served.address("/r/sample/commit");
    served.browser.open(&old).await;
    served.browser.at("/r/sample/git").await;
    served.stop().await;
}

/// A spec long enough to scroll, with a diagram and code.
const SPEC: &str = "/r/sample/f/2026-10-17-due-dates/spec.md";

#[tokio::test]
#[ignore = "needs the real web build and a browser: `just web-test` runs it"]
async fn a_reload_keeps_the_page_and_its_scroll() {
    let mut served = Served::start(DESKTOP, "dark").await;
    let address = served.address(SPEC);
    let browser = &mut served.browser;
    browser.open(&address).await;
    browser.shows("Spec: Recurring tasks").await;
    // The reader scrolls, and comes to rest.
    let middle = browser.middle_of("Spec: Recurring tasks").await;
    for _ in 0..6 {
        browser.wheel(middle, 200.0).await;
    }
    let scrolled = wait_for_rest(browser).await;
    assert!(scrolled > 300.0, "the reader scrolled: {scrolled}");

    browser.reload().await;
    // Its title is above where it opens: the pane's tab names the file.
    browser.shows("spec.md").await;
    browser.at(SPEC).await;
    // NSH's list places the offset over the rows' estimated heights, before the rows above it are
    // measured: a fresh load lands within a few lines of it (ruling R455).
    let kept = wait_for_rest(browser).await;
    assert!(
        (kept - scrolled).abs() < 200.0,
        "the reader opens where it was left: {kept}, not {scrolled}"
    );
    served.stop().await;
}

/// The furthest any of the page's scrollers is scrolled, once it stopped moving.
async fn wait_for_rest(browser: &mut Browser) -> f64 {
    let furthest = "Math.max(0, ...[...document.querySelectorAll('.nsh-scroll')]\
        .map((el) => el.scrollTop))";
    let mut last = -1.0;
    for _ in 0..100 {
        tokio::time::sleep(std::time::Duration::from_millis(150)).await;
        let now = browser
            .evaluate(furthest)
            .await
            .as_f64()
            .unwrap_or_default();
        if now > 0.0 && (now - last).abs() < 0.5 {
            return now;
        }
        last = now;
    }
    last
}

#[tokio::test]
#[ignore = "needs the real web build and a browser: `just web-test` runs it"]
async fn a_touch_in_a_field_keeps_the_focus() {
    let mut served = Served::start(PHONE, "light").await;
    let address = served.address("/r/sample/inbox");
    let browser = &mut served.browser;
    browser.open(&address).await;
    browser.shows("We need a home icon").await;
    // The inbox's field, where a note is written: a tap there opens the phone's keyboard.
    let field = browser.field().await;
    browser.tap_at(field).await;
    let focused = "document.activeElement?.closest('.nsh-field') !== null";
    for _ in 0..10 {
        tokio::time::sleep(std::time::Duration::from_millis(50)).await;
        assert_eq!(
            browser.evaluate(focused).await,
            true,
            "the field keeps the focus: it is on {}",
            browser.evaluate("document.activeElement?.tagName").await
        );
    }
    served.stop().await;
}
