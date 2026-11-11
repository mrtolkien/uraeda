//! Codex's usage windows and the limits that refuse its turns, from its `RateLimitSnapshot` and
//! a failed turn's `TurnError`.

use std::time::{Duration, UNIX_EPOCH};

use serde_json::Value;
use uraeda_core::today::rfc3339;

use super::json::{number, text, written};
use crate::runner::{Limit, LimitKind, UsageWindow};

/// The window that resets every five hours, Codex's session limit.
const SESSION_MINUTES: f64 = 300.0;

/// The latest instant JavaScript's dates hold, in milliseconds.
const LAST_INSTANT: f64 = 8.64e15;

/// A window of a snapshot, as Codex sends it: its share used in percent, its length, its reset.
struct Window {
    key: &'static str,
    used: f64,
    minutes: Option<f64>,
    resets_at: Option<String>,
}

/// An instant in ISO 8601, as JavaScript writes one, from its seconds since 1970: none before
/// 1970, or past what a date holds.
fn instant(seconds: f64) -> Option<String> {
    let millis = (seconds * 1000.0).trunc();
    if !(0.0..=LAST_INSTANT).contains(&millis) {
        return None;
    }
    #[allow(
        clippy::cast_possible_truncation,
        clippy::cast_sign_loss,
        reason = "checked just above: between 0 and 8.64e15"
    )]
    let millis = millis as u64;
    let second = rfc3339(UNIX_EPOCH + Duration::from_secs(millis / 1000));
    let second = second.strip_suffix('Z')?;
    Some(format!("{second}.{:03}Z", millis % 1000))
}

/// One of a snapshot's windows, `primary` or `secondary`: none when malformed or absent.
fn window_of(limits: &Value, key: &'static str) -> Option<Window> {
    let window = limits.get(key).filter(|window| window.is_object())?;
    let used = number(window, "usedPercent").filter(|used| used.is_finite() && *used >= 0.0)?;
    Some(Window {
        key,
        used,
        minutes: number(window, "windowDurationMins").filter(|minutes| *minutes > 0.0),
        resets_at: number(window, "resetsAt").and_then(instant),
    })
}

fn windows_of(limits: &Value) -> Vec<Window> {
    let keys = ["primary", "secondary"].into_iter();
    keys.filter_map(|key| window_of(limits, key)).collect()
}

/// A length for people: `1h`, `2d`, or `45m`.
fn length_label(minutes: f64) -> String {
    if minutes % 1440.0 == 0.0 {
        return format!("{}d", written(minutes / 1440.0));
    }
    if minutes % 60.0 == 0.0 {
        return format!("{}h", written(minutes / 60.0));
    }
    format!("{}m", written(minutes))
}

/// A window's id and label: the windows Claude Code also has under Claude Code's, so the usage
/// pane draws both agents' windows alike, any other by its length, or by its place.
fn named(window: &Window) -> (String, String) {
    let own = |id: &str, label: &str| (id.to_owned(), label.to_owned());
    match window.minutes {
        None if window.key == "primary" => own("primary", "Primary"),
        None => own("secondary", "Secondary"),
        Some(10_080.0) => own("seven_day", "Week"),
        Some(SESSION_MINUTES) => own("five_hour", "5h"),
        Some(minutes) => (format!("{}m", written(minutes)), length_label(minutes)),
    }
}

/// The usage windows of a rate-limit snapshot. A window without its reset is left out, and the
/// other kept.
pub(super) fn windows(limits: &Value) -> Vec<UsageWindow> {
    let windows = windows_of(limits).into_iter();
    let usage = windows.filter_map(|window| {
        let resets_at = window.resets_at.clone()?;
        let (id, label) = named(&window);
        // A tenth of a percent, as Claude Code's are.
        let used = ((window.used * 10.0).round() / 1000.0).min(1.0);
        Some(UsageWindow {
            id,
            label,
            resets_at,
            used,
        })
    });
    usage.collect()
}

/// The window a refusal is about: the full one that resets last, or, when none reads full yet,
/// the snapshot lagging the refusal, the primary window when it is the five-hour one with its
/// reset, so the run resumes by itself.
fn refusing(windows: &[Window]) -> Option<&Window> {
    let mut full: Option<&Window> = None;
    for window in windows {
        let is_full = window.used >= 100.0 && window.resets_at.is_some();
        if is_full && full.is_none_or(|full| window.resets_at >= full.resets_at) {
            full = Some(window);
        }
    }
    full.or_else(|| {
        let primary = windows.iter().find(|window| window.key == "primary")?;
        let session = primary.minutes == Some(SESSION_MINUTES) && primary.resets_at.is_some();
        session.then_some(primary)
    })
}

/// The limit that refused a turn: a failed turn's `usageLimitExceeded` error, or a snapshot with
/// its `rateLimitReachedType` set. It is `session` when the five-hour window is the one that
/// refuses, and resumes at that window's reset; credits run out, or a full weekly window, are
/// `other`. Its text is the error's message.
pub(super) fn limit(limits: Option<&Value>, error: Option<&Value>) -> Option<Limit> {
    let none = Value::Null;
    let limits = limits.unwrap_or(&none);
    let reached = text(limits, "rateLimitReachedType");
    let usage_limit =
        error.is_some_and(|error| text(error, "codexErrorInfo") == "usageLimitExceeded");
    if !usage_limit && reached.is_empty() {
        return None;
    }
    let message = error
        .map(|error| text(error, "message"))
        .unwrap_or_default();
    let text = (!message.is_empty()).then(|| message.to_owned());
    // Credits run out: no window resets them.
    if !reached.is_empty() && reached != "rate_limit_reached" {
        return Some(Limit {
            kind: LimitKind::Other,
            resets_at: None,
            text,
        });
    }
    let windows = windows_of(limits);
    let full = refusing(&windows);
    let session = full.is_some_and(|full| full.minutes == Some(SESSION_MINUTES));
    Some(Limit {
        kind: if session {
            LimitKind::Session
        } else {
            LimitKind::Other
        },
        resets_at: full.and_then(|full| full.resets_at.clone()),
        text,
    })
}
