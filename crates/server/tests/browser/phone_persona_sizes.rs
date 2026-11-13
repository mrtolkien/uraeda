//! 8 and 9: the phone turned, a small and a large phone, then a slow phone on a slow link: what
//! the first load shows while its 2.9 MB arrive, and what each page shows while its records do.

use std::time::{Duration, Instant};

use serde_json::json;

use super::super::cdp::{Browser, Size};
use super::{Phone, Shots, keyboard, open, safe_area, seen, tap_selector};

/// The phones and the way they are held: a name, its width, and its height.
const SIZES: &[(&str, u32, u32)] = &[
    ("landscape", 844, 390),
    ("small", 360, 640),
    ("large", 430, 932),
];

/// The pages each size is looked at on: a name, an address, and words it shows.
const PAGES: &[(&str, &str, &str)] = &[
    ("home", "/r/sample/", "Due dates"),
    (
        "round",
        "/r/sample/f/2026-10-17-round-mockup/clarifications-01.md",
        "Questions",
    ),
    (
        "session",
        "/r/sample/f/2026-10-19-dark-mode/session",
        "Dark mode",
    ),
    (
        "spec",
        "/r/sample/f/2026-10-17-recurring-reminders/spec.md",
        "Spec to review",
    ),
    ("inbox", "/r/sample/inbox", "We need a home icon"),
    ("jobs", "/r/sample/jobs", "Weekly report"),
];

/// A phone's browser of `size`, signed in.
async fn signed_in(phone: &Phone, size: Size, mode: &str) -> Browser {
    let mut browser = Browser::start().await;
    browser.show(size, mode).await;
    safe_area(&mut browser).await;
    browser.open(&phone.address("/r/sample/")).await;
    browser.shows("Sign in to Uraeda").await;
    phone.sign_in(&mut browser).await;
    browser
}

/// 8: each page at each size, and the composer with the keyboard up.
pub async fn sizes(mode: &str, shots: &mut Shots) {
    let phone = Phone::serve(false).await;
    for (at, (name, width, height)) in SIZES.iter().enumerate() {
        let size = Size {
            width: *width,
            height: *height,
            phone: true,
        };
        let mut browser = signed_in(&phone, size, mode).await;
        for (page, path, words) in PAGES {
            let picture = format!("08-{}-{name}-{page}", at + 1);
            if shots.wants(&picture) {
                open(&phone, &mut browser, path, words).await;
                shots.take(&mut browser, &picture).await;
            }
        }
        let picture = format!("08-{}-{name}-composer-keyboard", at + 1);
        if shots.wants(&picture) {
            let (path, words) = (PAGES[2].1, PAGES[2].2);
            open(&phone, &mut browser, path, words).await;
            tap_selector(&mut browser, "[data-testid=\"composer\"] .nsh-field").await;
            // A keyboard takes about 40% of a phone's height, upright or turned.
            keyboard(&mut browser, height * 2 / 5).await;
            browser.types("Keep the toggle in the header.").await;
            shots.take(&mut browser, &picture).await;
            keyboard(&mut browser, 0).await;
        }
        drop(browser);
    }
    phone.stop().await;
}

/// 9: a phone four times slower, on a link of about 50 KB/s: the first load as it arrives, then
/// each page a moment after it is asked for, and once its words show.
pub async fn slow(mode: &str, shots: &mut Shots) {
    let phone = Phone::serve(false).await;
    let mut browser = Browser::start().await;
    browser.show(super::super::cdp::PHONE, mode).await;
    safe_area(&mut browser).await;
    browser.slow(4).await;
    browser.command("Network.enable", json!({})).await;
    let link = json!({
        "offline": false,
        "latency": 150,
        "downloadThroughput": 50_000,
        "uploadThroughput": 20_000,
    });
    browser
        .command("Network.emulateNetworkConditions", link.clone())
        .await;
    browser.open(&phone.address("/r/sample/")).await;
    let started = Instant::now();
    let mut taken = 0;
    // The first load: a picture every few seconds until the sign-in page shows, at most 3 min.
    while started.elapsed() < Duration::from_secs(180) {
        let elapsed = started.elapsed().as_secs_f64();
        shots
            .take(
                &mut browser,
                &format!("09-01-first-load-{taken:02}-{elapsed:.0}s"),
            )
            .await;
        taken += 1;
        let signed = browser
            .evaluate("document.body.innerText.includes('Sign in to Uraeda')")
            .await;
        if signed == true {
            break;
        }
        tokio::time::sleep(Duration::from_millis(if taken < 4 { 300 } else { 4000 })).await;
    }
    shots.report.push_str(&format!(
        "## the first load took {:.1} s\n",
        started.elapsed().as_secs_f64()
    ));
    // Signed in by hand: what Home shows while its records come over the slow link.
    let field = browser.field().await;
    browser.tap_at(field).await;
    browser.types(&phone.key).await;
    browser.enter().await;
    for at in 0..4 {
        shots
            .take(&mut browser, &format!("09-02-signed-in-{at}"))
            .await;
    }
    seen(&mut browser, "Due dates").await;
    for (page, path, words) in PAGES {
        // Within the app, as a tap does: the page's records come over its socket, not a reload.
        let go = format!(
            "history.pushState(null, '', {}); dispatchEvent(new PopStateEvent('popstate'))",
            json!(path)
        );
        browser.evaluate(&go).await;
        shots
            .take(&mut browser, &format!("09-03-{page}-asked"))
            .await;
        let shown = seen(&mut browser, words).await;
        shots
            .take(&mut browser, &format!("09-04-{page}-arrived"))
            .await;
        if !shown {
            shots
                .report
                .push_str(&format!("!! slow: {page} never showed {words:?}\n"));
        }
    }
    drop(browser);
    phone.stop().await;
}
