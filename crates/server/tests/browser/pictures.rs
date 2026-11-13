//! Pictures of the app's main pages in a browser, for the eye, beside GTK's in `target/shots/app/`:
//! the same app? Each page at a desktop's and a phone's size, in both themes. One thing is
//! checked, which only a browser shows: a spec's diagram is drawn, by the server.

use super::app::Served;
use super::cdp::{Browser, DESKTOP, PHONE};
use super::shots;

/// A page, its address, and words it shows once its records came.
const PAGES: [(&str, &str, &str); 5] = [
    ("home", "/r/sample/", "Due dates"),
    (
        "session",
        "/r/sample/f/2026-10-19-dark-mode/session",
        "Dark mode",
    ),
    (
        "spec",
        "/r/sample/f/2026-10-17-due-dates/spec.md",
        "Spec: Recurring tasks",
    ),
    (
        "preview",
        "/r/sample/f/2026-10-20-sidebar-resize/mockups/handle.html",
        "handle.html",
    ),
    ("settings", "/r/sample/settings/appearance", "Notifications"),
];

/// Scrolls the spec's reader down to its diagram, and waits for its picture.
async fn to_the_diagram(browser: &mut Browser) {
    let diagram =
        "document.querySelector('[aria-label=\"A diagram\"], [data-testid=\"diagram-picture\"]')";
    let drawn = format!("{diagram} !== null");
    let middle = browser.middle_of("Spec: Recurring tasks").await;
    for _ in 0..80 {
        if browser.evaluate(&drawn).await == true {
            let middle = format!("{diagram}.scrollIntoView({{ block: 'center' }})");
            browser.evaluate(&middle).await;
            // Its source shows only when the server's picture did not come.
            let failed = "document.body.innerText.includes('could not be drawn')";
            assert_eq!(browser.evaluate(failed).await, false, "{}", browser.said());
            return;
        }
        browser.wheel(middle, 120.0).await;
        tokio::time::sleep(std::time::Duration::from_millis(100)).await;
    }
    let text = browser.evaluate("document.body.innerText").await;
    panic!("the spec's diagram was never drawn: the page shows {text}");
}

/// Takes the picture of one page, at the size and mode the browser shows.
async fn picture(served: &mut Served, (name, path, words): (&str, &str, &str), file: &str) {
    let address = served.address(path);
    served.browser.open(&address).await;
    served.browser.shows(words).await;
    if name == "spec" {
        to_the_diagram(&mut served.browser).await;
    }
    // The records' first values, and the pictures and fonts they bring, are in.
    tokio::time::sleep(std::time::Duration::from_millis(800)).await;
    served.browser.picture(&shots().join(file)).await;
}

#[tokio::test]
#[ignore = "needs the real web build and a browser: `just web-test` runs it"]
async fn pictures_of_the_main_pages() {
    for mode in ["dark", "light"] {
        let mut served = Served::start(DESKTOP, mode).await;
        for size in [DESKTOP, PHONE] {
            served.browser.show(size, mode).await;
            for page in PAGES {
                let file = format!("{}-{mode}-{}.png", page.0, size.width);
                picture(&mut served, page, &file).await;
            }
        }
        served.stop().await;
    }
}
