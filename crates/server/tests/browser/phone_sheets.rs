//! A phone's sheet in a real browser, whose Back lands on a later tick: a sheet's action that
//! opens a page shows that page, and one Back returns from it.

use std::time::Duration;

use super::{Phone, open, tap_selector};
use crate::browser::cdp::Browser;

/// Waits up to 10 s for the address to be one `wanted` accepts, then 1 s more for a Back still on
/// its way: the address it rests on.
async fn rests_on(browser: &mut Browser, wanted: impl Fn(&str) -> bool) -> String {
    for _ in 0..100 {
        if wanted(&browser.path().await) {
            break;
        }
        tokio::time::sleep(Duration::from_millis(100)).await;
    }
    tokio::time::sleep(Duration::from_secs(1)).await;
    browser.path().await
}

#[tokio::test]
#[ignore = "needs the real web build and a browser: `just web-test` runs it"]
async fn the_continue_sheet_lands_on_its_session_and_one_back_returns() {
    let phone = Phone::serve(false).await;
    let mut browser = phone.browser("light").await;
    phone.sign_in(&mut browser).await;
    let feature = "/r/sample/f/2026-10-12-cli-tuis";
    assert!(
        open(&phone, &mut browser, feature, "Continue, write the plan").await,
        "the feature waits for its Continue"
    );
    assert!(
        tap_selector(&mut browser, "[data-testid=\"bottom-bar-action\"]").await,
        "the bottom bar holds the Continue"
    );
    assert!(
        tap_selector(&mut browser, "[data-testid=\"continue-start\"]").await,
        "the continue sheet opens"
    );
    let session = rests_on(&mut browser, |path| path.starts_with("/r/sample/sessions/")).await;
    assert!(
        session.starts_with("/r/sample/sessions/"),
        "the run's session is shown: the page is {session}"
    );
    browser.evaluate("history.back()").await;
    let back = rests_on(&mut browser, |path| path == feature).await;
    assert_eq!(back, feature, "one Back returns to the feature");
    drop(browser);
    phone.stop().await;
}
