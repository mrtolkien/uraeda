//! The app on a phone, in a browser: a phone's size, 390 by 844, its touch screen, an iPhone's
//! safe area, and its keyboard, which a browser on a phone lays over the page.
//!
//! One check runs with the others (`just web-test`): the composer stays above the keyboard. The
//! rest is a tool, `just web-shots [word]`, which skips itself in any other run: a picture of every
//! page and of the states a phone meets, in both themes, in `target/shots/phone/`, each with what
//! the page measures under a thumb, in `report.txt`: what is pressed and smaller than 44 points,
//! text cut at the screen's edge, a page that scrolls sideways, and text smaller than 12 points.

use std::time::Duration;

use serde_json::json;
use tempfile::TempDir;
use uraeda_server::Server;
use uraeda_server::sandbox::Prepare;

use super::cdp::{Browser, PHONE};
use shots::Shots;

#[path = "phone_shots.rs"]
mod shots;
#[path = "phone_states.rs"]
mod states;
#[path = "phone_walk.rs"]
mod walk;
use super::signed_sandbox;

/// An iPhone's insets, in points: its status bar and its home indicator.
const SAFE_TOP: u32 = 59;
const SAFE_BOTTOM: u32 = 34;
/// A phone's keyboard held upright, its suggestions' line included, in points.
pub const KEYBOARD: u32 = 336;

/// A sandbox served with the web build, and the access key a browser signs in with.
pub struct Phone {
    pub server: Server,
    pub key: String,
    _folder: TempDir,
}

impl Phone {
    /// Serves a fresh sandbox, with sign-in, its long chat when `long_chat`.
    pub async fn serve(long_chat: bool) -> Phone {
        let prepare = Prepare {
            long_chat,
            ..Prepare::default()
        };
        let (folder, server, key) = signed_sandbox(prepare, |_| ()).await;
        Phone {
            server,
            key,
            _folder: folder,
        }
    }

    /// The whole address of a path of the server.
    pub fn address(&self, path: &str) -> String {
        format!("{}{path}", self.server.address())
    }

    /// A phone's browser in `mode`, at the sign-in page: its safe area, then the page.
    pub async fn browser(&self, mode: &str) -> Browser {
        let mut browser = Browser::start().await;
        browser.show(PHONE, mode).await;
        safe_area(&mut browser).await;
        browser.open(&self.address("/r/sample/")).await;
        browser.shows("Sign in to Uraeda").await;
        browser
    }

    /// Signs a browser at the sign-in page in, by touch, and waits for the home page's records.
    pub async fn sign_in(&self, browser: &mut Browser) {
        let field = browser.field().await;
        browser.tap_at(field).await;
        browser.types(&self.key).await;
        browser.enter().await;
        browser.shows("Due dates").await;
    }

    pub async fn stop(self) {
        self.server.stop().await;
    }
}

/// Gives the page an iPhone's safe area, as a home-screen app has it.
async fn safe_area(browser: &mut Browser) {
    let insets =
        json!({ "insets": { "top": SAFE_TOP, "bottom": SAFE_BOTTOM, "left": 0, "right": 0 } });
    browser
        .command("Emulation.setSafeAreaInsetsOverride", insets)
        .await;
}

/// Lays a phone's keyboard of `height` points over the page, as a phone's browser does: the visual
/// viewport shrinks and the layout does not. `0` takes it away.
pub async fn keyboard(browser: &mut Browser, height: u32) {
    let script = format!(
        "(() => {{
            const vv = window.visualViewport;
            const full = window.innerHeight;
            Object.defineProperty(vv, 'height', {{ configurable: true, get: () => full - {height} }});
            vv.dispatchEvent(new Event('resize'));
        }})()"
    );
    browser.evaluate(&script).await;
    tokio::time::sleep(Duration::from_millis(400)).await;
}

/// Presses a point with a finger for `held`, as a long press does.
pub async fn hold_at(browser: &mut Browser, (x, y): (f64, f64), held: Duration) {
    let point = json!([{ "x": x, "y": y }]);
    browser
        .command(
            "Input.dispatchTouchEvent",
            json!({ "type": "touchStart", "touchPoints": point }),
        )
        .await;
    tokio::time::sleep(held).await;
    browser
        .command(
            "Input.dispatchTouchEvent",
            json!({ "type": "touchEnd", "touchPoints": [] }),
        )
        .await;
}

/// Drags a finger from one point to another, in steps, as a swipe or a scroll by touch does.
pub async fn swipe(browser: &mut Browser, from: (f64, f64), to: (f64, f64)) {
    let at =
        |t: f64| json!([{ "x": from.0 + (to.0 - from.0) * t, "y": from.1 + (to.1 - from.1) * t }]);
    browser
        .command(
            "Input.dispatchTouchEvent",
            json!({ "type": "touchStart", "touchPoints": at(0.0) }),
        )
        .await;
    for step in 1..=8 {
        let points = at(f64::from(step) / 8.0);
        browser
            .command(
                "Input.dispatchTouchEvent",
                json!({ "type": "touchMove", "touchPoints": points }),
            )
            .await;
        tokio::time::sleep(Duration::from_millis(16)).await;
    }
    browser
        .command(
            "Input.dispatchTouchEvent",
            json!({ "type": "touchEnd", "touchPoints": [] }),
        )
        .await;
}

/// Taps the innermost element whose own text is `words`, whole on the screen: whether one was.
pub async fn tap(browser: &mut Browser, words: &str) -> bool {
    let found = format!(
        "(() => {{
            const words = {};
            const box = [...document.querySelectorAll('body *')]
                .filter((el) => el.childElementCount === 0 && el.textContent.trim() === words)
                .map((el) => el.getBoundingClientRect())
                .find((b) => b.width > 0 && b.y >= 0 && b.bottom <= innerHeight);
            return box ? [box.x, box.y, box.width, box.height] : null;
        }})()",
        json!(words)
    );
    tap_found(browser, &found).await
}

/// Taps what a screen reader names `label`, its last one on the screen: whether one was.
pub async fn tap_label(browser: &mut Browser, label: &str) -> bool {
    tap_selector(browser, &format!("[aria-label={}]", json!(label))).await
}

/// Taps the last element `selector` finds on the screen: whether one was.
pub async fn tap_selector(browser: &mut Browser, selector: &str) -> bool {
    match box_of(browser, selector).await {
        Some(at) => {
            browser
                .tap_at((at[0] + at[2] / 2.0, at[1] + at[3] / 2.0))
                .await;
            true
        }
        None => false,
    }
}

/// Taps the middle of the box a script finds, waiting up to 5 s for it.
async fn tap_found(browser: &mut Browser, script: &str) -> bool {
    for _ in 0..50 {
        if let Some(at) = browser.evaluate(script).await.as_array() {
            let number = |index: usize| at[index].as_f64().unwrap_or_default();
            let middle = (number(0) + number(2) / 2.0, number(1) + number(3) / 2.0);
            browser.tap_at(middle).await;
            return true;
        }
        tokio::time::sleep(Duration::from_millis(100)).await;
    }
    false
}

/// The box of the last element `selector` finds on the screen: x, y, width, height.
pub async fn box_of(browser: &mut Browser, selector: &str) -> Option<[f64; 4]> {
    let script = format!(
        "(() => {{
            const shown = [...document.querySelectorAll({})].map((el) => el.getBoundingClientRect())
                .filter((b) => b.width > 0 && b.height > 0 && b.bottom > 0 && b.top < innerHeight);
            const b = shown[shown.length - 1];
            return b ? [b.x, b.y, b.width, b.height] : null;
        }})()",
        json!(selector)
    );
    for _ in 0..50 {
        if let Some(found) = browser.evaluate(&script).await.as_array() {
            let number = |at: usize| found[at].as_f64().unwrap_or_default();
            return Some([number(0), number(1), number(2), number(3)]);
        }
        tokio::time::sleep(Duration::from_millis(50)).await;
    }
    None
}

/// A page of the app, by its address, and words it shows once its records came: every page of
/// the route parity list (`app/screens/parity.toml`), at the addresses
/// `app/screens/shell/places.test.tsx` opens, a round, and the gone ones' real neighbours.
const PAGES: &[(&str, &str, &str)] = &[
    ("home", "/r/sample/", "Due dates"),
    ("priorities", "/r/sample/priorities", "Git listener process"),
    (
        "proposal",
        "/r/sample/priorities/git-listener",
        "Git listener",
    ),
    (
        "proposal-gone",
        "/r/sample/priorities/gone",
        "That proposal is gone",
    ),
    ("inbox", "/r/sample/inbox", "We need a home icon"),
    ("triage", "/r/realistic/inbox/triage", "Triage"),
    (
        "feature",
        "/r/sample/f/2026-10-17-redesign-clarifications",
        "Follow the session",
    ),
    (
        "feature-stopped",
        "/r/sample/f/2026-10-17-due-dates",
        "Steps",
    ),
    (
        "round",
        "/r/sample/f/2026-10-19-date-format/clarifications-01.md",
        "Questions, round 1",
    ),
    (
        "spec",
        "/r/sample/f/2026-10-17-due-dates/spec.md",
        "Spec: Recurring tasks",
    ),
    (
        "file",
        "/r/realistic/f/2026-10-19-leader-key/spec.md",
        "Leader key/shortcut map",
    ),
    ("decisions", "/r/realistic/decisions", "Decisions check"),
    (
        "decision",
        "/r/realistic/decisions/git",
        "Rust tools MUST read git with the gix library",
    ),
    (
        "branch-decision",
        "/r/realistic/f/2026-10-18-due-reminders/decisions/notifications",
        "As the branch of Due date reminders has it",
    ),
    (
        "constitution",
        "/r/realistic/decisions/constitution",
        "Core Principles",
    ),
    (
        "decisions-check",
        "/r/realistic/decisions/check",
        "Decisions check",
    ),
    ("git", "/r/sample/git", "README.md"),
    (
        "buffer",
        "/r/realistic/buffer/specs/CONSTITUTION.md",
        "Core Principles",
    ),
    (
        "edit",
        "/r/realistic/edit/specs/CONSTITUTION.md",
        "Core Principles",
    ),
    ("settings", "/r/sample/settings", "Appearance"),
    (
        "settings-appearance",
        "/r/sample/settings/appearance",
        "Catppuccin Mocha",
    ),
    ("new", "/r/sample/new?kind=feature", "Git listener process"),
    ("new-session", "/r/sample/new?kind=session", "New"),
    ("sessions", "/r/sample/sessions", "Add a dark theme"),
    ("session-gone", "/r/sample/sessions/gone", "No such session"),
    (
        "session",
        "/r/sample/f/2026-10-19-dark-mode/session",
        "Dark mode",
    ),
    ("jobs", "/r/sample/jobs", "Weekly report"),
    (
        "job",
        "/r/sample/jobs/Dependencies",
        "Upgrade the dependencies",
    ),
    ("job-new", "/r/sample/jobs/new", "Add the job"),
    ("missing", "/r/sample/nowhere", "nowhere"),
    ("extension", "/r/sample/e/hello/hello", "Hello"),
    (
        "storybook",
        "/r/sample/f/2026-10-20-sidebar-resize/storybook?story=packages%2Fweb%2Fsrc%2FSidebarHandle.stories.tsx%23Dragging",
        "The stories its files link",
    ),
    (
        "mockup",
        "/r/sample/f/2026-10-20-sidebar-resize/mockups/handle.html",
        "handle.html",
    ),
];

/// Opens a page, and waits for its words: whether it showed them within 20 s.
async fn open(phone: &Phone, browser: &mut Browser, path: &str, words: &str) -> bool {
    browser.open(&phone.address(path)).await;
    seen(browser, words).await
}

/// Waits up to 20 s for the page to show `words`, wherever its lines break them.
pub async fn seen(browser: &mut Browser, words: &str) -> bool {
    let asked = format!(
        "document.body.innerText.replace(/\\s+/g, ' ').includes({})",
        json!(words.split_whitespace().collect::<Vec<_>>().join(" "))
    );
    for _ in 0..200 {
        if browser.evaluate(&asked).await == true {
            return true;
        }
        tokio::time::sleep(Duration::from_millis(100)).await;
    }
    false
}

/// The pictures of every page, then of each state a phone meets, in one mode.
async fn pictures_in(mode: &str) -> (String, usize) {
    let mut shots = Shots::new(mode);
    let phone = Phone::serve(true).await;
    let mut browser = phone.browser(mode).await;
    if shots.wants("sign-in") {
        shots.take(&mut browser, "00-sign-in").await;
    }
    phone.sign_in(&mut browser).await;
    for (at, (name, path, words)) in PAGES.iter().enumerate() {
        let name = format!("{:02}-{name}", at + 1);
        if shots.wants(&name) {
            println!("{name}");
            if !open(&phone, &mut browser, path, words).await {
                shots
                    .report
                    .push_str(&format!("## {name}: never showed {words:?}\n"));
            }
            shots.take(&mut browser, &name).await;
        }
    }
    states::states(&phone, &mut browser, &mut shots).await;
    if mode == "dark" {
        walk::walk(&phone, &mut browser, &mut shots).await;
    }
    drop(browser);
    phone.stop().await;
    (shots.report, shots.small)
}

#[tokio::test]
#[ignore = "a tool: `just web-shots [word]` runs it"]
async fn phone_pictures() {
    if std::env::var("URAEDA_PHONE_SHOTS").is_err() {
        println!("skipped: `just web-shots` takes the phone's pictures");
        return;
    }
    let mut report = String::new();
    let mut counts = Vec::new();
    for mode in ["dark", "light"] {
        let (text, small) = pictures_in(mode).await;
        report.push_str(&text);
        counts.push(format!("{mode}: {small} small targets"));
    }
    let summary = counts.join(", ");
    std::fs::write(super::shots().join("summary.txt"), format!("{summary}\n"))
        .expect("the summary is written");
    println!("{report}");
}

#[tokio::test]
#[ignore = "needs the real web build and a browser: `just web-test` runs it"]
async fn the_composer_stays_above_the_phones_keyboard() {
    let phone = Phone::serve(false).await;
    let mut browser = phone.browser("dark").await;
    phone.sign_in(&mut browser).await;
    let session = "/r/sample/f/2026-10-19-dark-mode/session";
    assert!(
        open(&phone, &mut browser, session, "Dark mode").await,
        "the session opens"
    );
    let field = box_of(&mut browser, ".nsh-field")
        .await
        .expect("the composer's field");
    browser
        .tap_at((field[0] + field[2] / 2.0, field[1] + field[3] / 2.0))
        .await;
    keyboard(&mut browser, KEYBOARD).await;
    let top_of_keyboard = f64::from(PHONE.height - KEYBOARD);
    let send = box_of(&mut browser, "[aria-label=\"Send\"]").await;
    let field = box_of(&mut browser, ".nsh-field")
        .await
        .expect("the composer's field");
    let send = send.expect("the composer's Send");
    for (what, at) in [("its field", field), ("its Send", send)] {
        assert!(
            at[1] + at[3] <= top_of_keyboard + 0.5 && at[1] >= 0.0,
            "the composer's {what} is hidden by the keyboard: its box is {at:?}, the keyboard's top {top_of_keyboard}"
        );
    }
    let focused = "document.activeElement?.closest('.nsh-field') !== null";
    assert_eq!(
        browser.evaluate(focused).await,
        true,
        "the field keeps the focus"
    );
    drop(browser);
    phone.stop().await;
}

#[tokio::test]
#[ignore = "needs the real web build and a browser: `just web-test` runs it"]
async fn a_tap_on_the_phones_more_places_opens_its_menu() {
    // The phone's way to Decisions and Settings. In a browser, a layer's content ran outside the
    // layer's key scope, its Space clashed with the leader's, and every menu drew nothing.
    let phone = Phone::serve(false).await;
    let mut browser = phone.browser("light").await;
    phone.sign_in(&mut browser).await;
    assert!(
        tap_label(&mut browser, "More places").await,
        "the tabs show their …"
    );
    assert!(
        seen(&mut browser, "Settings").await,
        "the … shows its menu once tapped"
    );
    tap(&mut browser, "Settings").await;
    let mut path = String::new();
    for _ in 0..100 {
        path = browser.path().await;
        if path.starts_with("/r/sample/settings") {
            break;
        }
        tokio::time::sleep(Duration::from_millis(50)).await;
    }
    assert!(
        path.starts_with("/r/sample/settings"),
        "Settings opens: the page is {path}"
    );
    drop(browser);
    phone.stop().await;
}
