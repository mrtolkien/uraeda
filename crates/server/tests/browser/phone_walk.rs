//! The owner on the phone, away from the desk (`specs/ui/personas.md`), by touch in a browser: the
//! five journeys of the walk through the app (`app/tools/walk.test.tsx`, `p1` to `p5`), now with a
//! phone's keyboard and its safe area. Each step is a picture, `w<journey>-<step>`, and a step that
//! finds nothing to tap is written in the report: what touch needs and the pointer did not.

use std::time::Duration;

use super::super::cdp::Browser;
use super::{
    KEYBOARD, Phone, Shots, hold_at, keyboard, open, seen, swipe, tap, tap_label, tap_selector,
};

/// Notes a step that did not happen.
fn missed(shots: &mut Shots, done: bool, what: &str) {
    if !done {
        shots.report.push_str(&format!("!! walk: {what}\n"));
        println!("!! walk: {what}");
    }
}

/// Taps `selector`, the last one on the screen.
async fn tap_id(browser: &mut Browser, id: &str) -> bool {
    tap_selector(browser, &format!("[data-testid={}]", serde_json::json!(id))).await
}

/// Scrolls by touch until `selector` is in the screen's middle part.
async fn bring(browser: &mut Browser, selector: &str) -> bool {
    let middle = format!(
        "(() => {{ const b = [...document.querySelectorAll({})].map((el) => el.getBoundingClientRect())\
         .find((b) => b.width > 0); return b ? b.y + b.height / 2 : null; }})()",
        serde_json::json!(selector)
    );
    for _ in 0..60 {
        let Some(y) = browser.evaluate(&middle).await.as_f64() else {
            return false;
        };
        if (180.0..=620.0).contains(&y) {
            return true;
        }
        let by = (y - 400.0).clamp(-300.0, 300.0);
        swipe(browser, (195.0, 450.0), (195.0, 450.0 - by)).await;
        tokio::time::sleep(Duration::from_millis(200)).await;
    }
    false
}

pub async fn walk(phone: &Phone, browser: &mut Browser, shots: &mut Shots) {
    if shots.wants("w1") {
        home(phone, browser, shots).await;
    }
    if shots.wants("w2") {
        round(phone, browser, shots).await;
    }
    if shots.wants("w3") {
        session(phone, browser, shots).await;
    }
    if shots.wants("w4") {
        spec(phone, browser, shots).await;
    }
    if shots.wants("w5") {
        inbox(phone, browser, shots).await;
    }
}

/// p1: checking in from the train: Home, scrolled, a note dropped with the keyboard up.
async fn home(phone: &Phone, browser: &mut Browser, shots: &mut Shots) {
    open(phone, browser, "/r/sample/", "Due dates").await;
    shots.take(browser, "w1-01-home").await;
    swipe(browser, (195.0, 650.0), (195.0, 250.0)).await;
    shots.take(browser, "w1-02-home-scrolled").await;
    let done = tap_selector(
        browser,
        "[data-testid=\"bottom-bar\"] [aria-label=\"Inbox\"]",
    )
    .await;
    missed(shots, done, "Home's bottom bar has no Inbox tile");
    shots.take(browser, "w1-03-inbox-pane").await;
    let done = tap_selector(browser, ".nsh-field").await;
    missed(shots, done, "Home's Inbox pane has no note field");
    keyboard(browser, KEYBOARD).await;
    browser.types("Call the bank about the card").await;
    shots.take(browser, "w1-04-note-typed").await;
    browser.enter().await;
    keyboard(browser, 0).await;
    let done = seen(browser, "Call the bank about the card").await;
    missed(shots, done, "the note typed on Home never showed");
    shots.take(browser, "w1-05-note-added").await;
}

/// p2: answering a round one-handed: an option tapped, a comment typed, the next question.
async fn round(phone: &Phone, browser: &mut Browser, shots: &mut Shots) {
    let feature = "/r/sample/f/2026-10-17-round-mockup";
    open(phone, browser, feature, "Round mockup").await;
    shots.take(browser, "w2-01-feature").await;
    let done = tap_id(browser, "feature-next").await || tap_id(browser, "bottom-bar-action").await;
    missed(shots, done, "the feature offers no next step by tap");
    seen(browser, "Questions").await;
    shots.take(browser, "w2-02-round").await;
    let done = tap_id(browser, "bottom-bar-action").await;
    missed(shots, done, "the round's bottom bar has no Next");
    shots.take(browser, "w2-03-question").await;
    let done = bring(browser, "[data-testid^=\"option-\"]").await
        && tap_selector(browser, "[data-testid^=\"option-\"]").await;
    missed(shots, done, "no option to tap");
    shots.take(browser, "w2-04-option").await;
    let done = bring(browser, "[data-testid=\"round-comment\"]").await
        && tap_selector(browser, "[data-testid=\"round-comment\"]").await;
    missed(shots, done, "no comment field under the question");
    keyboard(browser, KEYBOARD).await;
    browser.types("Only on the desktop for now.").await;
    shots.take(browser, "w2-05-comment-keyboard").await;
    keyboard(browser, 0).await;
    browser.evaluate("document.activeElement?.blur()").await;
    let done = tap_id(browser, "bottom-bar-action").await;
    missed(shots, done, "no Next after the comment");
    shots.take(browser, "w2-06-next-question").await;
}

/// p3: reading a session, back up its transcript, then a message sent while it replies.
async fn session(phone: &Phone, browser: &mut Browser, shots: &mut Shots) {
    let session = "/r/sample/f/2026-10-19-dark-mode/session";
    open(phone, browser, session, "Dark mode").await;
    shots.take(browser, "w3-01-session").await;
    swipe(browser, (195.0, 300.0), (195.0, 700.0)).await;
    swipe(browser, (195.0, 300.0), (195.0, 700.0)).await;
    shots.take(browser, "w3-02-read-back").await;
    let done = tap_selector(browser, "[data-testid=\"composer\"]").await;
    missed(shots, done, "no composer to tap");
    keyboard(browser, KEYBOARD).await;
    browser
        .types("Keep the toggle in the header, please.")
        .await;
    shots.take(browser, "w3-03-typed").await;
    let done = tap_label(browser, "Send").await;
    missed(shots, done, "no Send above the keyboard");
    keyboard(browser, 0).await;
    let done = seen(browser, "Keep the toggle in the header, please.").await;
    missed(shots, done, "the message sent never showed");
    shots.take(browser, "w3-04-sent").await;
}

/// p4: approving a spec: read, a part commented by a press, the verdict given.
async fn spec(phone: &Phone, browser: &mut Browser, shots: &mut Shots) {
    let spec = "/r/sample/f/2026-10-17-recurring-reminders/spec.md";
    open(phone, browser, spec, "Spec: Recurring reminders").await;
    shots.take(browser, "w4-01-spec").await;
    swipe(browser, (195.0, 650.0), (195.0, 250.0)).await;
    shots.take(browser, "w4-02-scrolled").await;
    // A part in the screen's middle: a press there is the comment's way on a phone.
    browser.tap_at((195.0, 420.0)).await;
    shots.take(browser, "w4-03-part-tapped").await;
    let commented = seen(browser, "Save the comment").await;
    missed(shots, commented, "a tapped part offers no comment");
    let done = tap_id(browser, "bottom-bar-action").await;
    missed(shots, done, "the spec's bottom bar has no Verdict");
    shots.take(browser, "w4-04-verdict").await;
    let done = bring(browser, "[data-testid=\"review-approve\"]").await
        && tap_id(browser, "review-approve").await;
    missed(shots, done, "no Approve to tap");
    shots.take(browser, "w4-05-approved").await;
}

/// p5: the inbox: a long press on a note, then the note, then the `…` of places.
async fn inbox(phone: &Phone, browser: &mut Browser, shots: &mut Shots) {
    open(phone, browser, "/r/sample/inbox", "We need a home icon").await;
    let at = browser.middle_of("We need a home icon").await;
    hold_at(browser, at, Duration::from_millis(700)).await;
    shots.take(browser, "w5-01-long-press").await;
    let done = tap(browser, "We need a home icon").await;
    missed(shots, done, "the note cannot be tapped");
    shots.take(browser, "w5-02-note").await;
    let done = tap_label(browser, "More places").await && seen(browser, "Settings").await;
    missed(shots, done, "the … of places shows no menu");
    shots.take(browser, "w5-03-more").await;
}
