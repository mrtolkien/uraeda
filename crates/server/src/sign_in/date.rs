//! The dates of the sign-in file: RFC 3339 in UTC, to the second, as `2026-11-10T09:00:00Z`.

use std::time::{Duration, SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Deserializer, Serializer};
use uraeda_core::today::{self, Date};

/// A time as the file writes it.
pub(crate) fn text(time: SystemTime) -> String {
    today::rfc3339(time)
}

/// The time a text of the file says, or nothing when it is not a date as this file writes one: a
/// session whose last use is no date would never end.
fn parse(text: &str) -> Option<SystemTime> {
    let (date, time) = text.strip_suffix('Z')?.split_once('T')?;
    let day = u64::try_from(Date::parse(date)?.unix_seconds()).ok()?;
    let mut parts = time.split(':').map(|part| {
        let digits = part.len() == 2 && part.bytes().all(|byte| byte.is_ascii_digit());
        digits.then(|| part.parse::<u64>().ok()).flatten()
    });
    let (hours, minutes, seconds) = (parts.next()??, parts.next()??, parts.next()??);
    let valid = parts.next().is_none() && hours < 24 && minutes < 60 && seconds < 60;
    valid.then(|| UNIX_EPOCH + Duration::from_secs(day + hours * 3600 + minutes * 60 + seconds))
}

/// Writes a time of the file.
pub(crate) fn serialize<S: Serializer>(
    time: &SystemTime,
    serializer: S,
) -> Result<S::Ok, S::Error> {
    serializer.serialize_str(&text(*time))
}

/// Reads a time of the file.
pub(crate) fn deserialize<'de, D: Deserializer<'de>>(
    deserializer: D,
) -> Result<SystemTime, D::Error> {
    let text = String::deserialize(deserializer)?;
    parse(&text).ok_or_else(|| serde::de::Error::custom(format!("`{text}` is not a date")))
}
