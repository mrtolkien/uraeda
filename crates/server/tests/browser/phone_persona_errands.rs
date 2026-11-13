//! The owner away from the desk, again, on the errands the first walk (`phone_persona.rs`) covered
//! least: a feature waiting for their Continue, a reply sent with a picture and followed, the
//! blocked chat's offer, a note fast and its triage, a proposal added, Git's sync, a refused write
//! and its toast, the connection dropped and back, and the browser's Back. Each step is a
//! numbered picture in `target/shots/polish-18/`, measured as `just web-shots` measures its own.
//!
//! A tool, `just web-errands [word]`, never a check.

use std::time::Duration;

use serde_json::json;

use super::super::cdp::Browser;
use super::persona::{above_keyboard, bring, missed, tap_id, tap_whole};
use super::{KEYBOARD, Phone, Shots, keyboard, open, seen, swipe, tap, tap_label, tap_selector};

/// Every errand in both modes: the report.
pub async fn all() -> String {
    let mut report = String::new();
    for mode in ["dark", "light"] {
        let mut shots = Shots::new(mode);
        let phone = Phone::serve(false).await;
        let mut browser = phone.browser(mode).await;
        phone.sign_in(&mut browser).await;
        let b = &mut browser;
        let errands: [(&str, Errand); 9] = [
            ("10-", |p, b, s| Box::pin(waiting(p, b, s))),
            ("11-", |p, b, s| Box::pin(reply(p, b, s))),
            ("12-", |p, b, s| Box::pin(blocked(p, b, s))),
            ("13-", |p, b, s| Box::pin(note(p, b, s))),
            ("14-", |p, b, s| Box::pin(proposal(p, b, s))),
            ("15-", |p, b, s| Box::pin(git(p, b, s))),
            ("16-", |p, b, s| Box::pin(back(p, b, s))),
            ("17-", |p, b, s| Box::pin(offline(p, b, s))),
            ("18-", |p, b, s| Box::pin(turned(p, b, s))),
        ];
        for (word, errand) in errands {
            if shots.wants(word) {
                println!("{mode} {word}");
                errand(&phone, b, &mut shots).await;
            }
        }
        drop(browser);
        phone.stop().await;
        report.push_str(&shots.report);
        report.push_str(&format!("{mode}: {} small targets\n", shots.small));
    }
    report
}

type Errand = for<'a> fn(
    &'a Phone,
    &'a mut Browser,
    &'a mut Shots,
) -> std::pin::Pin<Box<dyn Future<Output = ()> + 'a>>;

/// 10: Home, the feature that waits for my Continue, and the Continue.
async fn waiting(phone: &Phone, browser: &mut Browser, shots: &mut Shots) {
    open(phone, browser, "/r/sample/", "Due dates").await;
    shots.take(browser, "10-01-home").await;
    let found = seen(browser, "Your Continue").await;
    missed(
        shots,
        found,
        "Home shows no feature waiting for the Continue",
    );
    let script = "(() => { const card = [...document.querySelectorAll('[data-testid^=\"card-\"]')]\
        .find((el) => el.innerText.includes('Your Continue')); \
        if (!card) return null; const b = card.getBoundingClientRect(); \
        return [b.x + b.width / 2, b.y + Math.min(b.height / 2, 30), b.top, b.bottom]; })()";
    if let Some(at) = browser.evaluate(script).await.as_array() {
        let number = |index: usize| at[index].as_f64().unwrap_or_default();
        shots.report.push_str(&format!(
            "## the waiting card spans {:.0} to {:.0}\n",
            number(2),
            number(3)
        ));
        browser.tap_at((number(0), number(1))).await;
        tokio::time::sleep(Duration::from_millis(900)).await;
        shots.take(browser, "10-02-waiting-feature").await;
        let path = browser.path().await;
        shots
            .report
            .push_str(&format!("## the card led to {path}\n"));
        let done = tap_id(browser, "bottom-bar-action").await;
        missed(shots, done, "the waiting feature's bottom bar has no step");
        tokio::time::sleep(Duration::from_millis(900)).await;
        shots.take(browser, "10-03-continue-tapped").await;
    }
}

/// Notes where the transcript is against its end, and whether it offers the jump to the latest.
async fn followed(browser: &mut Browser, shots: &mut Shots, when: &str) {
    let script = "(() => { const list = document.querySelector('[data-testid=\"transcript\"]'); \
        const scroller = list && [list, ...list.querySelectorAll('*')].find((el) => el.scrollHeight > el.clientHeight + 4 \
        && getComputedStyle(el).overflowY !== 'visible'); \
        const jump = !!document.querySelector('[data-testid=\"jump-to-latest\"]'); \
        return scroller ? [Math.round(scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop), \
        scroller.clientHeight, jump, scrollY] : ['no scroller', jump, scrollY]; })()";
    let state = browser.evaluate(script).await;
    shots.report.push_str(&format!(
        "## transcript {when}: [from its end, its height, jump, page scrolled] {state}\n"
    ));
}

/// 11: a reply with a picture, sent, followed while it streams, read back, and the jump down.
async fn reply(phone: &Phone, browser: &mut Browser, shots: &mut Shots) {
    let session = "/r/sample/f/2026-10-19-dark-mode/session";
    open(phone, browser, session, "Dark mode").await;
    tokio::time::sleep(Duration::from_millis(800)).await;
    followed(browser, shots, "opened").await;
    let done = tap_selector(browser, "[data-testid=\"composer\"] .nsh-field").await;
    tokio::time::sleep(Duration::from_millis(300)).await;
    followed(browser, shots, "composer tapped").await;
    missed(shots, done, "no composer to tap");
    keyboard(browser, KEYBOARD).await;
    followed(browser, shots, "keyboard up").await;
    shots.take(browser, "11-01-composer-open").await;
    super::persona::attach_to(browser, shots, "Attach images", "11-02-picture-held").await;
    tap_selector(browser, "[data-testid=\"composer\"] .nsh-field").await;
    browser
        .types("Here is how the header looks on my phone: make the toggle bigger.")
        .await;
    shots.take(browser, "11-03-typed-with-picture").await;
    above_keyboard(
        browser,
        shots,
        "[aria-label=\"Send\"]",
        "the composer's Send",
    )
    .await;
    let sent = tap_label(browser, "Send").await;
    missed(shots, sent, "no Send to tap");
    tokio::time::sleep(Duration::from_millis(300)).await;
    followed(browser, shots, "sent").await;
    keyboard(browser, 0).await;
    followed(browser, shots, "keyboard down").await;
    browser.evaluate("document.activeElement?.blur()").await;
    tokio::time::sleep(Duration::from_millis(600)).await;
    followed(browser, shots, "blurred").await;
    shots.take(browser, "11-04-streaming").await;
    // On the conversation, under the session's head, which wraps a long branch's name.
    swipe(browser, (195.0, 330.0), (195.0, 560.0)).await;
    swipe(browser, (195.0, 330.0), (195.0, 560.0)).await;
    tokio::time::sleep(Duration::from_millis(600)).await;
    shots.take(browser, "11-05-read-back").await;
    let jumped = tap_id(browser, "jump-to-latest").await;
    missed(
        shots,
        jumped,
        "no Jump to the latest to tap after scrolling up",
    );
    tokio::time::sleep(Duration::from_millis(800)).await;
    shots.take(browser, "11-06-jumped").await;
    let stopped = tap_id(browser, "stop").await;
    shots.report.push_str(&format!(
        "## Stop was {}\n",
        if stopped { "tapped" } else { "gone" }
    ));
    tokio::time::sleep(Duration::from_millis(800)).await;
    shots.take(browser, "11-07-after").await;
}

/// 12: the chat whose action auto mode blocked: its offer, read and taken by touch.
async fn blocked(phone: &Phone, browser: &mut Browser, shots: &mut Shots) {
    open(phone, browser, "/r/sample/sessions", "Run the tests").await;
    shots.take(browser, "12-01-sessions").await;
    let done = tap(browser, "Run the tests, then tidy the imports").await;
    missed(shots, done, "the blocked chat cannot be tapped");
    tokio::time::sleep(Duration::from_millis(1200)).await;
    shots.take(browser, "12-02-blocked-chat").await;
    let script = "(() => { const all = [...document.querySelectorAll('body *')]\
        .filter((el) => el.childElementCount === 0 && /change/i.test(el.textContent))\
        .map((el) => el.getBoundingClientRect()).filter((b) => b.width > 0); \
        return all.map((b) => [Math.round(b.y), Math.round(b.height)]); })()";
    let offers = browser.evaluate(script).await;
    let title = "(() => { const el = document.querySelector('[data-testid=\"session-title\"]'); \
        if (!el) return null; const b = el.getBoundingClientRect(); const p = el.parentElement.getBoundingClientRect(); \
        const s = getComputedStyle(el); return [b.x, b.width, el.scrollWidth, p.width, s.whiteSpace, s.width, \
        s.position, el.outerHTML.slice(0, 300)]; })()";
    let title = browser.evaluate(title).await;
    shots
        .report
        .push_str(&format!("## the session's title box {title}\n"));
    shots.report.push_str(&format!(
        "## the blocked chat's words of a change at {offers}\n"
    ));
}

/// 13: a note dropped fast, then its triage.
async fn note(phone: &Phone, browser: &mut Browser, shots: &mut Shots) {
    open(phone, browser, "/r/sample/inbox", "We need a home icon").await;
    let done = tap_id(browser, "bottom-bar-action").await;
    missed(shots, done, "the inbox's bottom bar has no Add");
    keyboard(browser, KEYBOARD).await;
    browser.types("Ask Mia about the spare key").await;
    shots.take(browser, "13-01-note-typed").await;
    above_keyboard(browser, shots, ".nsh-field", "the note's field").await;
    browser.enter().await;
    tokio::time::sleep(Duration::from_millis(600)).await;
    shots.take(browser, "13-02-note-entered").await;
    keyboard(browser, 0).await;
    browser.evaluate("document.activeElement?.blur()").await;
    let added = seen(browser, "Ask Mia about the spare key").await;
    missed(shots, added, "the note never showed");
    shots.take(browser, "13-03-note-added").await;
    let note = tap(browser, "Ask Mia about the spare key").await;
    missed(shots, note, "the new note cannot be tapped");
    tokio::time::sleep(Duration::from_millis(700)).await;
    shots.take(browser, "13-04-note-selected").await;
    open(phone, browser, "/r/realistic/inbox/triage", "Triage").await;
    shots.take(browser, "13-05-triage").await;
    swipe(browser, (195.0, 650.0), (195.0, 250.0)).await;
    shots.take(browser, "13-06-triage-scrolled").await;
}

/// 14: a proposal added to the priorities, from the bottom bar.
async fn proposal(phone: &Phone, browser: &mut Browser, shots: &mut Shots) {
    open(
        phone,
        browser,
        "/r/sample/priorities",
        "Git listener process",
    )
    .await;
    shots.take(browser, "14-01-priorities").await;
    let done = tap_id(browser, "bottom-bar-action").await;
    missed(shots, done, "the priorities' bottom bar has no Add");
    keyboard(browser, KEYBOARD).await;
    tokio::time::sleep(Duration::from_millis(500)).await;
    let focused = browser
        .evaluate("document.activeElement?.closest('.nsh-field') !== null")
        .await;
    missed(
        shots,
        focused == true,
        "Add did not focus a field in the priorities",
    );
    browser.types("Offline notes on the phone").await;
    shots.take(browser, "14-02-proposal-typed").await;
    above_keyboard(browser, shots, ".nsh-field", "the proposal's field").await;
    browser.enter().await;
    tokio::time::sleep(Duration::from_millis(800)).await;
    keyboard(browser, 0).await;
    shots.take(browser, "14-03-proposal-entered").await;
}

/// 15: Git's page, the sync's buttons, a pull, and a refusal.
async fn git(phone: &Phone, browser: &mut Browser, shots: &mut Shots) {
    open(phone, browser, "/r/sample/git", "README.md").await;
    shots.take(browser, "15-01-git").await;
    let synced = bring(browser, "[aria-label=\"Fetch\"]").await;
    shots.take(browser, "15-02-sync").await;
    let fetched = synced && tap_whole(browser, "[aria-label=\"Fetch\"]").await;
    missed(shots, fetched, "no Fetch to tap on Git");
    tokio::time::sleep(Duration::from_millis(1500)).await;
    shots.take(browser, "15-03-fetched").await;
    let pulled = tap(browser, "Pull").await;
    tokio::time::sleep(Duration::from_millis(1500)).await;
    shots
        .report
        .push_str(&format!("## Pull was tapped: {pulled}\n"));
    shots.take(browser, "15-04-pulled").await;
}

/// 16: the browser's Back from a sheet, a page, and the app's first page.
async fn back(phone: &Phone, browser: &mut Browser, shots: &mut Shots) {
    open(phone, browser, "/r/sample/", "Due dates").await;
    let feature = "/r/sample/f/2026-10-17-redesign-clarifications";
    let go = format!(
        "history.pushState(null, '', {}); dispatchEvent(new PopStateEvent('popstate'))",
        json!(feature)
    );
    browser.evaluate(&go).await;
    seen(browser, "Follow the session").await;
    let renamed = tap(browser, "Rename").await;
    missed(shots, renamed, "no Rename to open its sheet");
    tokio::time::sleep(Duration::from_millis(700)).await;
    shots.take(browser, "16-01-sheet").await;
    let with_sheet = browser.path().await;
    browser.evaluate("history.back()").await;
    tokio::time::sleep(Duration::from_millis(900)).await;
    let after = browser.path().await;
    shots.take(browser, "16-02-back-from-sheet").await;
    shots.report.push_str(&format!(
        "## Back from the sheet: {with_sheet} -> {after}\n"
    ));
    browser.evaluate("history.back()").await;
    tokio::time::sleep(Duration::from_millis(900)).await;
    let after = browser.path().await;
    shots.take(browser, "16-03-back-from-page").await;
    shots
        .report
        .push_str(&format!("## Back from the feature: {after}\n"));
}

/// 17: the connection dropped, a note written meanwhile, then the connection back.
async fn offline(phone: &Phone, browser: &mut Browser, shots: &mut Shots) {
    open(phone, browser, "/r/sample/inbox", "We need a home icon").await;
    browser.command("Network.enable", json!({})).await;
    let link = |offline: bool| json!({ "offline": offline, "latency": 0, "downloadThroughput": -1, "uploadThroughput": -1 });
    browser
        .command("Network.emulateNetworkConditions", link(true))
        .await;
    tokio::time::sleep(Duration::from_millis(4000)).await;
    shots.take(browser, "17-01-offline").await;
    tap_id(browser, "bottom-bar-action").await;
    keyboard(browser, KEYBOARD).await;
    browser.types("Written in the tunnel").await;
    browser.enter().await;
    tokio::time::sleep(Duration::from_millis(1200)).await;
    shots.take(browser, "17-02-note-offline").await;
    keyboard(browser, 0).await;
    browser.evaluate("document.activeElement?.blur()").await;
    browser
        .command("Network.emulateNetworkConditions", link(false))
        .await;
    let back = seen(browser, "Written in the tunnel").await;
    tokio::time::sleep(Duration::from_millis(3000)).await;
    shots.take(browser, "17-03-online-again").await;
    let path = browser.path().await;
    let text = browser
        .evaluate("document.body.innerText.slice(0, 400)")
        .await;
    shots.report.push_str(&format!(
        "## back online at {path}, the note shown: {back}; the page starts {text}\n"
    ));
}

/// 18: Home and the waiting feature, held sideways.
async fn turned(phone: &Phone, browser: &mut Browser, shots: &mut Shots) {
    let size = super::super::cdp::Size {
        width: 844,
        height: 390,
        phone: true,
    };
    browser.show(size, shots.mode()).await;
    open(phone, browser, "/r/sample/", "Due dates").await;
    shots.take(browser, "18-01-home-turned").await;
    open(phone, browser, "/r/sample/git", "README.md").await;
    shots.take(browser, "18-02-git-turned").await;
}
