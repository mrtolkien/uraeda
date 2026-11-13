//! The states a phone meets beyond a page as it opens, each reached by touch: the `…` of places,
//! the sidebar's sheet, a pane's menu, a picker, a dialog, the keyboard up over the composer, a
//! note, and a round's comment, a toast, a long transcript, a spec's table and code, and a diff.
//! A step that finds nothing to tap is written in the report, and the pictures go on.

use std::time::Duration;

use super::super::cdp::Browser;
use super::{KEYBOARD, Phone, Shots, keyboard, open, seen, swipe, tap, tap_label, tap_selector};

/// Notes a step that did not happen in the report.
fn missed(shots: &mut Shots, done: bool, what: &str) {
    if !done {
        shots.report.push_str(&format!("!! {what}\n"));
        println!("!! {what}");
    }
}

/// Taps the field `selector` finds, then lays the keyboard over the page.
async fn type_in(browser: &mut Browser, selector: &str) -> bool {
    let tapped = tap_selector(browser, selector).await;
    keyboard(browser, KEYBOARD).await;
    tapped
}

/// Takes the keyboard away, and the focus.
async fn reset(browser: &mut Browser) {
    keyboard(browser, 0).await;
    browser.evaluate("document.activeElement?.blur()").await;
}

/// Scrolls the page by touch until the first element `selector` finds is in its middle.
async fn scroll_to(browser: &mut Browser, selector: &str) -> bool {
    let middle = format!(
        "(() => {{ const b = document.querySelector({})?.getBoundingClientRect(); \
         return b ? b.y + b.height / 2 : null; }})()",
        serde_json::json!(selector)
    );
    for _ in 0..80 {
        if let Some(y) = browser.evaluate(&middle).await.as_f64() {
            if (200.0..=600.0).contains(&y) {
                return true;
            }
            let by = (y - 420.0).clamp(-300.0, 300.0);
            swipe(browser, (195.0, 500.0), (195.0, 500.0 - by)).await;
        } else {
            swipe(browser, (195.0, 650.0), (195.0, 350.0)).await;
        }
        tokio::time::sleep(Duration::from_millis(150)).await;
    }
    false
}

pub async fn states(phone: &Phone, browser: &mut Browser, shots: &mut Shots) {
    places(phone, browser, shots).await;
    keyboards(phone, browser, shots).await;
    reading(phone, browser, shots).await;
}

/// The frame's own: the `…` of places, the sidebar, a pane's menu, a picker, a dialog.
async fn places(phone: &Phone, browser: &mut Browser, shots: &mut Shots) {
    if shots.wants("more-places") {
        open(phone, browser, "/r/sample/", "Due dates").await;
        let done = tap_label(browser, "More places").await && seen(browser, "Settings").await;
        missed(shots, done, "the … of places shows no Settings once tapped");
        shots.take(browser, "40-more-places").await;
    }
    if shots.wants("sidebar") {
        open(phone, browser, "/r/sample/", "Due dates").await;
        let done = tap_label(browser, "Open the sidebar").await;
        missed(shots, done, "no sidebar toggle");
        shots.take(browser, "41-sidebar").await;
    }
    if shots.wants("pane-menu") {
        let spec = "/r/sample/f/2026-10-17-due-dates/spec.md";
        open(phone, browser, spec, "Spec: Recurring tasks").await;
        let done = tap_label(browser, "Move the pane").await;
        missed(shots, done, "no pane menu");
        shots.take(browser, "42-pane-menu").await;
    }
    if shots.wants("selector") {
        open(
            phone,
            browser,
            "/r/realistic/decisions",
            "Above every decision",
        )
        .await;
        let done = tap(browser, "Latest change first").await;
        missed(shots, done, "no sort to choose");
        shots.take(browser, "43-selector").await;
    }
    if shots.wants("short-form") {
        let feature = "/r/sample/f/2026-10-17-redesign-clarifications";
        open(phone, browser, feature, "Follow the session").await;
        let done = tap(browser, "Rename").await;
        missed(shots, done, "no Rename to open its form");
        shots.take(browser, "43-short-form").await;
        keyboard(browser, KEYBOARD).await;
        shots.take(browser, "43-short-form-keyboard").await;
        reset(browser).await;
    }
    if shots.wants("dialog") {
        let feature = "/r/sample/f/2026-10-17-redesign-clarifications";
        open(phone, browser, feature, "Follow the session").await;
        let done = tap(browser, "Postpone the feature…").await;
        missed(shots, done, "no Postpone to open its question");
        shots.take(browser, "43-dialog").await;
    }
}

/// The keyboard up: over the composer, a note, a round's comment; then a toast.
async fn keyboards(phone: &Phone, browser: &mut Browser, shots: &mut Shots) {
    if shots.wants("composer") {
        open(
            phone,
            browser,
            "/r/sample/f/2026-10-19-dark-mode/session",
            "Dark mode",
        )
        .await;
        shots.take(browser, "44-composer").await;
        let done = type_in(browser, "[data-testid=\"composer\"] .nsh-field").await;
        missed(shots, done, "no composer's field");
        browser
            .types("Keep the toggle in the header, please.")
            .await;
        shots.take(browser, "44-keyboard-composer").await;
        reset(browser).await;
    }
    if shots.wants("note") {
        open(phone, browser, "/r/sample/inbox", "We need a home icon").await;
        let done = type_in(browser, ".nsh-field").await;
        missed(shots, done, "no note's field");
        browser.types("Call the bank about the card").await;
        shots.take(browser, "45-keyboard-note").await;
        browser.enter().await;
        reset(browser).await;
        shots.take(browser, "46-toast").await;
    }
    if shots.wants("round") {
        let round = "/r/sample/f/2026-10-17-round-mockup/clarifications-01.md";
        open(phone, browser, round, "Questions").await;
        shots.take(browser, "47-round").await;
        let done = tap_selector(browser, "[data-testid=\"bottom-bar-action\"]").await;
        missed(shots, done, "no Next in the round's bottom bar");
        shots.take(browser, "47-round-question").await;
        let done = scroll_to(browser, "[data-testid=\"round-comment\"]").await
            && type_in(browser, "[data-testid=\"round-comment\"] .nsh-field").await;
        missed(shots, done, "no question's comment field");
        browser.types("Only on the desktop for now.").await;
        shots.take(browser, "47-keyboard-round").await;
        reset(browser).await;
    }
}

/// What is read: a long transcript, a spec's table and code, a diff.
async fn reading(phone: &Phone, browser: &mut Browser, shots: &mut Shots) {
    if shots.wants("long-transcript") {
        open(phone, browser, "/r/sample/sessions", "Add a dark theme").await;
        let searched = type_in(browser, ".nsh-field").await;
        browser.types("long").await;
        reset(browser).await;
        let done = searched
            && seen(browser, "A very long chat").await
            && tap(browser, "A very long chat").await
            && seen(browser, "Reply 9999").await;
        missed(shots, done, "the long chat did not open at its end");
        shots.take(browser, "48-long-transcript").await;
    }
    if shots.wants("spec-code") {
        let spec = "/r/sample/f/2026-10-17-due-dates/spec.md";
        open(phone, browser, spec, "Spec: Recurring tasks").await;
        let done = scroll_to(browser, "[data-testid=\"code\"], [data-testid^=\"table-\"]").await;
        missed(shots, done, "the spec shows no table or code");
        shots.take(browser, "49-spec-code").await;
    }
    if shots.wants("diff") {
        open(phone, browser, "/r/sample/git", "README.md").await;
        let done = tap(browser, "README.md").await;
        missed(shots, done, "no file to open its diff");
        shots.take(browser, "50-diff").await;
    }
}
