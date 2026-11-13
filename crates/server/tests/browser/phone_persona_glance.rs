//! 7: a glance at the rest, by touch: the priorities, a feature, git's changes and a diff, the
//! sessions, the jobs (one paused, one run now, which asks), the settings, an extension's page,
//! the `…` of places, a pane's menu, a sheet closed by a tap outside and by its handle, a dialog.

use std::time::Duration;

use super::super::cdp::Browser;
use super::persona::{bring, missed, tap_id, tap_whole, went};
use super::{Phone, Shots, open, seen, swipe, tap, tap_label};

pub async fn glance(phone: &Phone, browser: &mut Browser, shots: &mut Shots) {
    open(
        phone,
        browser,
        "/r/sample/priorities",
        "Git listener process",
    )
    .await;
    shots.take(browser, "07-01-priorities").await;
    let feature = "/r/sample/f/2026-10-17-redesign-clarifications";
    open(phone, browser, feature, "Follow the session").await;
    shots.take(browser, "07-02-feature").await;
    swipe(browser, (195.0, 650.0), (195.0, 200.0)).await;
    shots.take(browser, "07-03-feature-scrolled").await;
    git(phone, browser, shots).await;
    open(phone, browser, "/r/sample/sessions", "Add a dark theme").await;
    shots.take(browser, "07-06-sessions").await;
    jobs(phone, browser, shots).await;
    settings(phone, browser, shots).await;
    open(phone, browser, "/r/sample/e/hello/hello", "Hello").await;
    shots.take(browser, "07-12-extension").await;
    open(phone, browser, "/r/sample/", "Due dates").await;
    let done = tap_label(browser, "More places").await && seen(browser, "Settings").await;
    missed(shots, done, "the … of places shows no menu");
    shots.take(browser, "07-13-more-places").await;
    browser.tap_at((195.0, 700.0)).await;
    layers(phone, browser, shots).await;
}

/// Git's page, a file's diff, and its way back.
async fn git(phone: &Phone, browser: &mut Browser, shots: &mut Shots) {
    open(phone, browser, "/r/sample/git", "README.md").await;
    shots.take(browser, "07-04-git").await;
    let done = tap(browser, "README.md").await;
    missed(shots, done, "no file to open its diff");
    tokio::time::sleep(Duration::from_millis(800)).await;
    shots.take(browser, "07-05-diff").await;
}

/// The jobs: one paused by its switch, one run now, which asks first.
async fn jobs(phone: &Phone, browser: &mut Browser, shots: &mut Shots) {
    open(phone, browser, "/r/sample/jobs", "Weekly report").await;
    shots.take(browser, "07-07-jobs").await;
    let done = tap_whole(browser, "[aria-label=\"Runs at its times\"]").await;
    missed(shots, done, "no job's switch to pause it");
    tokio::time::sleep(Duration::from_millis(600)).await;
    shots.take(browser, "07-08-job-paused").await;
    let done = tap(browser, "Weekly report").await && went(browser, "/r/sample/jobs/").await;
    missed(shots, done, "a job's card does not open the job");
    seen(browser, "Run now").await;
    let done = tap(browser, "Run now…").await || tap_label(browser, "Run now…").await;
    missed(shots, done, "no Run now on the job's page");
    tokio::time::sleep(Duration::from_millis(600)).await;
    let asked = seen(browser, "Run it now").await;
    missed(shots, asked, "Run now ran without asking");
    shots.take(browser, "07-09-run-now-asks").await;
}

/// The settings: the theme, then the notifications.
async fn settings(phone: &Phone, browser: &mut Browser, shots: &mut Shots) {
    open(phone, browser, "/r/sample/settings", "Appearance").await;
    shots.take(browser, "07-10-settings").await;
    let done = tap(browser, "Appearance").await;
    missed(shots, done, "Settings' Appearance cannot be tapped");
    seen(browser, "Catppuccin Mocha").await;
    shots.take(browser, "07-11-appearance").await;
    for _ in 0..4 {
        swipe(browser, (195.0, 650.0), (195.0, 250.0)).await;
    }
    shots.take(browser, "07-11-notifications").await;
}

/// A pane's menu, a sheet closed two ways, and a dialog.
async fn layers(phone: &Phone, browser: &mut Browser, shots: &mut Shots) {
    let spec = "/r/sample/f/2026-10-17-due-dates/spec.md";
    open(phone, browser, spec, "Spec: Recurring tasks").await;
    let done = tap_label(browser, "Move the pane").await;
    missed(shots, done, "no pane menu");
    shots.take(browser, "07-14-pane-menu").await;
    browser.tap_at((195.0, 800.0)).await;
    tokio::time::sleep(Duration::from_millis(400)).await;
    // A short form is a sheet on a phone: a tap above it closes it, and so does its handle.
    let feature = "/r/sample/f/2026-10-17-redesign-clarifications";
    open(phone, browser, feature, "Follow the session").await;
    let done = tap(browser, "Rename").await;
    missed(shots, done, "no Rename to open its sheet");
    shots.take(browser, "07-15-sheet").await;
    browser.tap_at((195.0, 140.0)).await;
    tokio::time::sleep(Duration::from_millis(800)).await;
    let closed = !seen_now(browser, "Rename the feature").await;
    missed(shots, closed, "a tap above the sheet left it open");
    shots.take(browser, "07-16-sheet-tapped-outside").await;
    tap(browser, "Rename").await;
    tokio::time::sleep(Duration::from_millis(900)).await;
    match sheet_top(browser).await {
        Some(top) => swipe(browser, (195.0, top + 14.0), (195.0, top + 420.0)).await,
        None => missed(shots, false, "no sheet to swipe down"),
    }
    tokio::time::sleep(Duration::from_millis(800)).await;
    missed(
        shots,
        !seen_now(browser, "Rename the feature").await,
        "a swipe down on the sheet's handle left it open",
    );
    shots.take(browser, "07-17-sheet-swiped").await;
    let feature = "/r/sample/f/2026-10-17-redesign-clarifications";
    open(phone, browser, feature, "Follow the session").await;
    let done = bring(browser, "[data-testid=\"postpone\"]").await
        && tap_id(browser, "postpone").await
        || tap(browser, "Postpone the feature…").await;
    missed(shots, done, "no Postpone to open its question");
    tokio::time::sleep(Duration::from_millis(600)).await;
    shots.take(browser, "07-18-dialog").await;
}

/// The top of the sheet on the screen, its handle's row: the highest glass across the screen's
/// width under the tabs.
async fn sheet_top(browser: &mut Browser) -> Option<f64> {
    let script = "(() => { const tops = [...document.querySelectorAll('body *')]\
        .filter((el) => getComputedStyle(el).backdropFilter !== 'none')\
        .map((el) => el.getBoundingClientRect())\
        .filter((b) => b.width > innerWidth * 0.8 && b.y > 120 && b.bottom < innerHeight - 20)\
        .map((b) => b.y); return tops.length ? Math.min(...tops) : null; })()";
    browser.evaluate(script).await.as_f64()
}

/// Whether the page shows `words` now, without waiting.
async fn seen_now(browser: &mut Browser, words: &str) -> bool {
    let asked = format!(
        "document.body.innerText.includes({})",
        serde_json::json!(words)
    );
    browser.evaluate(&asked).await == true
}
