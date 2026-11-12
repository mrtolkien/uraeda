//! The owner away from the desk, on their phone, in a browser (`specs/ui/personas.md`), walked
//! slowly, flow by flow, as that person: signed in from nothing, a check-in, a round answered, a
//! session read and replied to, a spec approved, a note dropped, a glance at the rest. Each step
//! is a numbered picture in `target/shots/polish-6/`, measured as `just web-shots` measures its
//! own, and what a thumb could not do, or the keyboard covered, is written in the report. The
//! phone turned, other phones, and a slow link are in `phone_persona_sizes.rs`.
//!
//! A tool, `just web-walk [word]`, never a check.

use std::time::Duration;

use serde_json::json;

use super::super::cdp::{Browser, PHONE};
use super::{
    KEYBOARD, Phone, Shots, box_of, hold_at, keyboard, open, seen, swipe, tap, tap_label,
    tap_selector,
};

/// Notes a step that did not happen.
pub fn missed(shots: &mut Shots, done: bool, what: &str) {
    if !done {
        shots.report.push_str(&format!("!! persona: {what}\n"));
        println!("!! persona: {what}");
    }
}

/// Taps the last element of a test id on the screen.
pub async fn tap_id(browser: &mut Browser, id: &str) -> bool {
    tap_selector(browser, &format!("[data-testid={}]", json!(id))).await
}

/// Taps the first element `selector` finds whole between the tabs and the bottom bar, where a
/// thumb would: a tap on one the bar half hides lands on the bar.
pub async fn tap_whole(browser: &mut Browser, selector: &str) -> bool {
    let script = format!(
        "(() => {{ const b = [...document.querySelectorAll({})].map((el) => el.getBoundingClientRect())\
         .find((b) => b.width > 0 && b.top >= 110 && b.bottom <= innerHeight - 96); \
         return b ? [b.x + b.width / 2, b.y + b.height / 2] : null; }})()",
        json!(selector)
    );
    for _ in 0..30 {
        if let Some(at) = browser.evaluate(&script).await.as_array() {
            let number = |index: usize| at[index].as_f64().unwrap_or_default();
            browser.tap_at((number(0), number(1))).await;
            return true;
        }
        tokio::time::sleep(Duration::from_millis(100)).await;
    }
    false
}

/// Scrolls by touch until the first element `selector` finds is in the screen's middle part.
pub async fn bring(browser: &mut Browser, selector: &str) -> bool {
    let middle = format!(
        "(() => {{ const b = [...document.querySelectorAll({})].map((el) => el.getBoundingClientRect())\
         .find((b) => b.width > 0); return b ? b.y + b.height / 2 : null; }})()",
        json!(selector)
    );
    for _ in 0..60 {
        let Some(y) = browser.evaluate(&middle).await.as_f64() else {
            return false;
        };
        let height = browser
            .evaluate("innerHeight")
            .await
            .as_f64()
            .unwrap_or(844.0);
        if (height * 0.2..=height * 0.75).contains(&y) {
            return true;
        }
        let by = (y - height / 2.0).clamp(-height / 3.0, height / 3.0);
        let x = browser
            .evaluate("innerWidth / 2")
            .await
            .as_f64()
            .unwrap_or(195.0);
        swipe(browser, (x, height / 2.0), (x, height / 2.0 - by)).await;
        tokio::time::sleep(Duration::from_millis(200)).await;
    }
    false
}

/// Notes in the report when what `selector` finds is under the phone's keyboard, or above the
/// screen: what is typed, or the button needed next, hidden.
pub async fn above_keyboard(browser: &mut Browser, shots: &mut Shots, selector: &str, what: &str) {
    let top = f64::from(PHONE.height - KEYBOARD);
    match box_of(browser, selector).await {
        Some(at) if at[1] >= 0.0 && at[1] + at[3] <= top + 0.5 => {}
        Some(at) => missed(
            shots,
            false,
            &format!("{what} is hidden by the keyboard: its box {at:?}, the keyboard's top {top}"),
        ),
        None => missed(shots, false, &format!("{what} is not on the screen")),
    }
}

/// Whether the address starts with `path` within 5 s.
pub async fn went(browser: &mut Browser, path: &str) -> bool {
    for _ in 0..100 {
        if browser.path().await.starts_with(path) {
            return true;
        }
        tokio::time::sleep(Duration::from_millis(50)).await;
    }
    false
}

/// Every flow in both modes, then the phones and the slow link: the report.
pub async fn all() -> String {
    let mut report = String::new();
    for mode in ["dark", "light"] {
        let mut shots = Shots::new(mode);
        walk(mode, &mut shots).await;
        if shots.wants("08-") {
            super::persona_sizes::sizes(mode, &mut shots).await;
        }
        if mode == "dark" && shots.wants("09-") {
            super::persona_sizes::slow(mode, &mut shots).await;
        }
        report.push_str(&shots.report);
        report.push_str(&format!("{mode}: {} small targets\n", shots.small));
    }
    report
}

/// Every flow, in order, on one phone in `mode`.
pub async fn walk(mode: &str, shots: &mut Shots) {
    let phone = Phone::serve(false).await;
    let mut browser = phone.browser(mode).await;
    let b = &mut browser;
    sign_in(&phone, b, shots).await;
    if shots.wants("02-") {
        check_in(&phone, b, shots).await;
    }
    if shots.wants("03-") {
        round(&phone, b, shots).await;
    }
    if shots.wants("04-") {
        session(&phone, b, shots).await;
    }
    if shots.wants("05-") {
        spec(&phone, b, shots).await;
    }
    if shots.wants("06-") {
        note(&phone, b, shots).await;
    }
    if shots.wants("07-") {
        super::persona_glance::glance(&phone, b, shots).await;
    }
    drop(browser);
    phone.stop().await;
}

/// 1: signed in from nothing: the page, its key's origin, the key pasted with the keyboard up.
async fn sign_in(phone: &Phone, browser: &mut Browser, shots: &mut Shots) {
    shots.take(browser, "01-01-sign-in").await;
    missed(
        shots,
        seen(browser, "ura key").await,
        "the sign-in page does not say the key comes from `ura key`",
    );
    let field = browser.field().await;
    browser.tap_at(field).await;
    keyboard(browser, KEYBOARD).await;
    browser.types(&phone.key).await;
    shots.take(browser, "01-02-key-typed").await;
    above_keyboard(browser, shots, ".nsh-field", "the key's field").await;
    browser.enter().await;
    keyboard(browser, 0).await;
    missed(
        shots,
        seen(browser, "Due dates").await,
        "the key never signed in",
    );
    shots.take(browser, "01-03-signed-in").await;
}

/// 2: Home: what needs me, then the card that needs me most.
async fn check_in(phone: &Phone, browser: &mut Browser, shots: &mut Shots) {
    open(phone, browser, "/r/sample/", "Due dates").await;
    shots.take(browser, "02-01-home").await;
    let done = tap_whole(browser, "[data-testid^=\"card-\"]").await;
    missed(shots, done, "Home shows no card to tap");
    tokio::time::sleep(Duration::from_millis(800)).await;
    shots.take(browser, "02-02-what-needs-me").await;
}

/// 3: a round: every question, one comment with the keyboard up, submitted.
async fn round(phone: &Phone, browser: &mut Browser, shots: &mut Shots) {
    let round = "/r/sample/f/2026-10-17-round-mockup/clarifications-01.md";
    open(phone, browser, round, "Questions").await;
    shots.take(browser, "03-01-round").await;
    for question in 1..=8 {
        let done = tap_id(browser, "bottom-bar-action").await;
        if !done || seen_now(browser, "Submit").await || seen_now(browser, "Commit").await {
            break;
        }
        tokio::time::sleep(Duration::from_millis(400)).await;
        let options = "[data-testid^=\"option-\"]";
        let picked = bring(browser, options).await && tap_whole(browser, options).await;
        missed(
            shots,
            picked,
            &format!("question {question} has no option to tap"),
        );
        shots
            .take(browser, &format!("03-02-question-{question}"))
            .await;
        if question == 1 {
            comment(browser, shots).await;
        }
    }
    let done = bring(browser, "[data-testid=\"round-submit\"]").await;
    shots.take(browser, "03-04-end").await;
    missed(
        shots,
        done && tap_id(browser, "round-submit").await,
        "no Submit to tap",
    );
    tokio::time::sleep(Duration::from_millis(1500)).await;
    shots.take(browser, "03-05-submitted").await;
}

/// Whether the page shows `words` now, without waiting.
async fn seen_now(browser: &mut Browser, words: &str) -> bool {
    let asked = format!(
        "[...document.querySelectorAll('[data-testid=\"round-submit\"]')].some((el) => \
         el.getBoundingClientRect().width > 0 && el.innerText.includes({}))",
        json!(words)
    );
    browser.evaluate(&asked).await == true
}

/// A question's comment typed with the keyboard up: the field and its Save stay above it.
async fn comment(browser: &mut Browser, shots: &mut Shots) {
    let field = "[data-testid=\"round-comment\"] .nsh-field";
    let done = bring(browser, "[data-testid=\"round-comment\"]").await
        && tap_selector(browser, field).await;
    missed(shots, done, "no comment field under the question");
    keyboard(browser, KEYBOARD).await;
    browser
        .types("Only on the desktop for now, the phone can wait until the round after this one.")
        .await;
    shots.take(browser, "03-03-comment-keyboard").await;
    above_keyboard(browser, shots, field, "the round's comment").await;
    keyboard(browser, 0).await;
    browser.evaluate("document.activeElement?.blur()").await;
}

/// 4: a running session: read back, a message typed and sent, its reply streamed, then stopped.
async fn session(phone: &Phone, browser: &mut Browser, shots: &mut Shots) {
    let session = "/r/sample/f/2026-10-19-dark-mode/session";
    open(phone, browser, session, "Dark mode").await;
    shots.take(browser, "04-01-session").await;
    swipe(browser, (195.0, 250.0), (195.0, 700.0)).await;
    swipe(browser, (195.0, 250.0), (195.0, 700.0)).await;
    shots.take(browser, "04-02-read-back").await;
    let done = tap_selector(browser, "[data-testid=\"composer\"] .nsh-field").await;
    missed(shots, done, "no composer to tap");
    keyboard(browser, KEYBOARD).await;
    browser
        .types("Keep the toggle in the header, and say which pages you touched.")
        .await;
    shots.take(browser, "04-03-typed").await;
    above_keyboard(
        browser,
        shots,
        "[aria-label=\"Send\"]",
        "the composer's Send",
    )
    .await;
    let done = tap_label(browser, "Send").await;
    missed(shots, done, "no Send above the keyboard");
    keyboard(browser, 0).await;
    browser.evaluate("document.activeElement?.blur()").await;
    for at in 1..=3 {
        tokio::time::sleep(Duration::from_millis(500)).await;
        shots.take(browser, &format!("04-04-streaming-{at}")).await;
    }
    let done = tap_id(browser, "stop").await;
    missed(shots, done, "no Stop to tap while it replies");
    tokio::time::sleep(Duration::from_millis(800)).await;
    shots.take(browser, "04-05-stopped").await;
}

/// 5: a spec in review: prose, a table, code, a diagram, a comment by a press, the verdict.
async fn spec(phone: &Phone, browser: &mut Browser, shots: &mut Shots) {
    let read = "/r/sample/f/2026-10-17-due-dates/spec.md";
    open(phone, browser, read, "Spec: Recurring tasks").await;
    for (name, selector) in [
        ("table", "[data-testid^=\"table-\"]"),
        ("code", "[data-testid=\"code\"]"),
        ("diagram", "[data-testid=\"diagram-picture\"]"),
    ] {
        let done = bring(browser, selector).await;
        missed(shots, done, &format!("the spec shows no {name}"));
        shots.take(browser, &format!("05-02-{name}")).await;
    }
    let code = box_of(browser, "[data-testid=\"code\"]").await;
    if let Some(at) = code {
        let from = (at[0] + at[2] - 20.0, at[1] + at[3] / 2.0);
        swipe(browser, from, (at[0] + 20.0, from.1)).await;
        shots.take(browser, "05-03-code-scrolled").await;
    }
    let spec = "/r/sample/f/2026-10-17-recurring-reminders/spec.md";
    open(phone, browser, spec, "Spec to review").await;
    shots.take(browser, "05-01-spec").await;
    swipe(browser, (195.0, 650.0), (195.0, 250.0)).await;
    browser.tap_at((195.0, 420.0)).await;
    tokio::time::sleep(Duration::from_millis(500)).await;
    shots.take(browser, "05-04-block-tapped").await;
    hold_at(browser, (195.0, 420.0), Duration::from_millis(700)).await;
    shots.take(browser, "05-05-block-held").await;
    if seen(browser, "Save the comment").await {
        let field = ".nsh-sheet .nsh-field, [data-testid=\"review-comment\"] .nsh-field";
        tap_selector(browser, field).await;
        keyboard(browser, KEYBOARD).await;
        browser
            .types("Say what happens on the 31st of a short month.")
            .await;
        shots.take(browser, "05-06-comment-keyboard").await;
        above_keyboard(browser, shots, field, "the block's comment").await;
        let saved = tap(browser, "Save the comment").await;
        missed(
            shots,
            saved,
            "Save the comment is not on the screen with the keyboard up",
        );
        keyboard(browser, 0).await;
    } else {
        missed(shots, false, "a pressed block offers no comment");
    }
    let done = tap_id(browser, "bottom-bar-action").await;
    missed(shots, done, "the spec's bottom bar has no Verdict");
    shots.take(browser, "05-07-verdict").await;
    let done = bring(browser, "[data-testid=\"review-approve\"]").await
        && tap_id(browser, "review-approve").await;
    missed(shots, done, "no Approve to tap");
    tokio::time::sleep(Duration::from_millis(1000)).await;
    shots.take(browser, "05-08-approved").await;
}

/// 6: a note in the inbox in two taps, a picture attached from the picker, then added.
async fn note(phone: &Phone, browser: &mut Browser, shots: &mut Shots) {
    open(phone, browser, "/r/sample/inbox", "We need a home icon").await;
    shots.take(browser, "06-01-inbox").await;
    let done = tap_id(browser, "bottom-bar-action").await;
    missed(shots, done, "the inbox's bottom bar has no Add");
    keyboard(browser, KEYBOARD).await;
    let focused = browser
        .evaluate("document.activeElement?.closest('.nsh-field') !== null")
        .await;
    missed(
        shots,
        focused == true,
        "Add did not put the focus in the note's field",
    );
    browser.types("Call the bank about the card").await;
    shots.take(browser, "06-02-note-typed").await;
    above_keyboard(browser, shots, ".nsh-field", "the note's field").await;
    attach(browser, shots).await;
    tap_selector(browser, ".nsh-field").await;
    browser.enter().await;
    keyboard(browser, 0).await;
    let done = seen(browser, "Call the bank about the card").await;
    missed(shots, done, "the note never showed");
    shots.take(browser, "06-04-note-added").await;
}

/// A picture held for the new note, from the browser's file picker.
async fn attach(browser: &mut Browser, shots: &mut Shots) {
    browser
        .command(
            "Page.setInterceptFileChooserDialog",
            json!({ "enabled": true }),
        )
        .await;
    browser.heard().await;
    let tapped = tap_label(browser, "Add images to the new note").await;
    missed(shots, tapped, "the inbox offers no Add images to tap");
    tokio::time::sleep(Duration::from_millis(800)).await;
    let opened = browser
        .heard()
        .await
        .into_iter()
        .find(|(method, _)| method == "Page.fileChooserOpened");
    match opened {
        Some((_, chooser)) => {
            let picture = super::super::shots().join("06-picked.png");
            browser.picture(&picture).await;
            let files = json!({
                "files": [picture.to_string_lossy()],
                "backendNodeId": chooser["backendNodeId"],
            });
            browser.command("DOM.setFileInputFiles", files).await;
            tokio::time::sleep(Duration::from_millis(1500)).await;
            shots.take(browser, "06-03-picture-held").await;
        }
        None => missed(shots, false, "the picker never opened a file chooser"),
    }
    browser
        .command(
            "Page.setInterceptFileChooserDialog",
            json!({ "enabled": false }),
        )
        .await;
}
