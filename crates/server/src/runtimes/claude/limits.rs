//! Why a Claude Code turn stopped: the usage limit that refused it, and the account's usage
//! windows. Claude Code's formats stay here, in its runtime.

use std::sync::LazyLock;

use regex::Regex;
use serde_json::Value;

use super::json::{field, is_true, nested, number, string};
use super::time::{Clock, iso, named, next_wall_clock};
use crate::runner::{Event, Limit, LimitKind, UsageWindow};

/// The limit of a `rate_limit_info` that refused a request: `rejected`, and not let through on
/// usage credits. `five_hour` is the session's limit; every other type, or none, is weekly, per
/// model, or a spend cap. `resetsAt` is in seconds since 1970.
pub(super) fn of_info(info: &Value, text: Option<&str>) -> Option<Limit> {
    if string(info, "status") != Some("rejected") || is_true(info, "isUsingOverage") {
        return None;
    }
    let session = string(info, "rateLimitType") == Some("five_hour");
    Some(Limit {
        kind: if session {
            LimitKind::Session
        } else {
            LimitKind::Other
        },
        resets_at: number(info, "resetsAt").and_then(|seconds| iso(seconds * 1000.0)),
        text: text.filter(|text| !text.is_empty()).map(str::to_owned),
    })
}

/// A word boundary, a space, and a letter as Claude Code's own code reads them: by ASCII's
/// letters, and with the byte order mark among the spaces.
macro_rules! pattern {
    ($pattern:literal) => {
        LazyLock::new(|| {
            let pattern = $pattern.replace("\\b", r"(?-u:\b)");
            let pattern = pattern.replace("\\s", r"[\s\x{FEFF}]");
            Regex::new(&pattern).expect("a pattern")
        })
    };
}

/// A text that names a limit.
static LIMIT: LazyLock<Regex> = pattern!(r"\b(?i-u:limit)\b");

/// A text that names the session's limit, in today's words or an older Claude Code's.
static SESSION: LazyLock<Regex> = pattern!(r"\b(?i-u:(?:session|5-hour) limit)\b");

/// The reset's wall-clock time, `8:40am` or `11pm`, and the zone in parentheses after it.
static RESET_TIME: LazyLock<Regex> = pattern!(
    r"\b(?i-u:resets)\s+([0-9]{1,2})(?::([0-9]{2}))?\s*((?i-u:[ap]m))\b(?:\s*\(([^()]+)\))?"
);

/// The limit a refusal's text names, for a Claude Code that sends no typed error:
/// `You've hit your session limit · resets 8:40am (Asia/Tokyo)`, or an older one's `5-hour limit
/// reached ∙ resets 3am`. Its reset is the next instant with that wall-clock time, in the zone
/// the text names, or in the server's without one: one up to 10 minutes before now counts, as a
/// refusal read just after its reset's minute. Any other limit is `other`, and a text naming no
/// limit gives none.
pub(super) fn of_text(text: &str, clock: &Clock) -> Option<Limit> {
    if !LIMIT.is_match(text) {
        return None;
    }
    let limit = |kind, resets_at| Limit {
        kind,
        resets_at,
        text: Some(text.to_owned()),
    };
    if !SESSION.is_match(text) {
        return Some(limit(LimitKind::Other, None));
    }
    Some(limit(LimitKind::Session, reset_of(text, clock)))
}

/// The reset a text names, as an instant.
fn reset_of(text: &str, clock: &Clock) -> Option<String> {
    let found = RESET_TIME.captures(text)?;
    let hour: i8 = found[1].parse().ok()?;
    let minute: i8 = found
        .get(2)
        .map_or(Ok(0), |minute| minute.as_str().parse())
        .ok()?;
    if !(1..=12).contains(&hour) || minute >= 60 {
        return None;
    }
    let afternoon = found[3].eq_ignore_ascii_case("pm");
    let hour = hour % 12 + if afternoon { 12 } else { 0 };
    let zone = match found.get(4) {
        Some(name) => named(name.as_str().trim())?,
        None => clock.zone.clone(),
    };
    next_wall_clock(hour, minute, clock.now, &zone)
}

/// The usage limit an assistant message reports refusing the turn: its typed error first, with
/// the kind and reset, else the text of a typed or `rate_limit` error.
pub(super) fn of_message(message: &Value, said: &str, clock: &Clock) -> Option<Event> {
    let typed = string(message, "api_error") == Some("usage_limit_reached");
    let info = field(nested(message, "api_error_params"), "rate_limit_info");
    let from_info = || of_info(info.filter(|_| typed)?, Some(said));
    let named = typed || string(message, "error") == Some("rate_limit");
    let limit = from_info().or_else(|| named.then(|| of_text(said, clock))?)?;
    Some(Event::Limit { limit })
}

/// Claude's usage windows, by their names in its reports, with their labels.
const WINDOWS: [(&str, &str); 2] = [("five_hour", "5h"), ("seven_day", "Week")];

/// The five-hour and seven-day windows' usage, each a fraction in Claude's output; status-only
/// notices give no percentage. A malformed window is left out, and the other one kept.
pub(super) fn usage(info: &Value) -> Option<Event> {
    let windows: Vec<UsageWindow> = WINDOWS
        .iter()
        .filter_map(|(id, label)| window(info, id, label))
        .collect();
    (!windows.is_empty()).then_some(Event::Usage { windows })
}

/// One window of a report: from its unified windows, or the report itself when it is that
/// window.
fn window(info: &Value, id: &str, label: &str) -> Option<UsageWindow> {
    let unified = field(nested(info, "unifiedWindows"), id).filter(|window| window.is_object());
    let itself = || (string(info, "rateLimitType") == Some(id)).then_some(info);
    let limit = unified.or_else(itself)?;
    let used = number(limit, "utilization").filter(|used| *used >= 0.0)?;
    let resets_at = iso(number(limit, "resetsAt")? * 1000.0)?;
    Some(UsageWindow {
        id: id.to_owned(),
        label: label.to_owned(),
        resets_at,
        // A tenth of a percent, as Claude Code shows it.
        used: ((used * 1000.0).round() / 1000.0).min(1.0),
    })
}
