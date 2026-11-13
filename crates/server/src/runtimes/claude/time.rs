//! The instants Claude Code's output names: written in ISO 8601 as the events give them, and
//! found from a wall-clock time in a zone, as a limit's reset and a wakeup are given.

use std::time::SystemTime;

use jiff::civil::{Date, DateTime};
use jiff::tz::TimeZone;
use jiff::{Timestamp, ToSpan as _};

use crate::env::Environment;

/// The latest instant a date holds, in milliseconds since 1970, either side of it.
const LAST: f64 = 8.64e15;

const DAY: i64 = 86_400_000;
const MINUTE: i64 = 60_000;

/// When a line is read: the instant, and the server's own zone.
#[derive(Clone)]
pub(super) struct Clock {
    /// In milliseconds since 1970.
    pub now: i64,
    pub zone: TimeZone,
}

/// The server's zone: `TZ` of its environment, else the machine's.
pub(super) fn zone(environment: &Environment) -> TimeZone {
    let named = environment.var("TZ").and_then(named);
    named.unwrap_or_else(TimeZone::system)
}

/// The zone of a name, as `Asia/Tokyo`: none for a name no zone has.
pub(super) fn named(name: &str) -> Option<TimeZone> {
    TimeZone::get(name).ok()
}

/// An instant in milliseconds since 1970.
pub(super) fn millis(at: SystemTime) -> i64 {
    let since = at.duration_since(SystemTime::UNIX_EPOCH);
    since.map_or(0, |since| {
        i64::try_from(since.as_millis()).unwrap_or(i64::MAX)
    })
}

/// An instant in ISO 8601, in UTC, to the millisecond: `2026-11-03T23:40:00.000Z`. It is given
/// in milliseconds since 1970, of which only the whole ones count: none for a number no date
/// holds.
pub(super) fn iso(millis: f64) -> Option<String> {
    if !millis.is_finite() || millis.abs() > LAST {
        return None;
    }
    #[expect(
        clippy::cast_possible_truncation,
        reason = "whole, and within the dates checked above"
    )]
    let millis = millis.trunc() as i64;
    let (year, month, day) = civil(millis.div_euclid(DAY));
    let time = millis.rem_euclid(DAY);
    let (hour, minute) = (time / (60 * MINUTE), time / MINUTE % 60);
    let (second, milli) = (time / 1000 % 60, time % 1000);
    // A year outside four digits is written with six, and its sign.
    let year = match year {
        0..=9999 => format!("{year:04}"),
        _ if year < 0 => format!("-{:06}", -year),
        _ => format!("+{year:06}"),
    };
    Some(format!(
        "{year}-{month:02}-{day:02}T{hour:02}:{minute:02}:{second:02}.{milli:03}Z"
    ))
}

/// The date of a day counted from 1970-01-01, in the calendar of today extended both ways.
fn civil(days: i64) -> (i64, i64, i64) {
    // Counted in eras of 400 years, from a 1 March, so that a leap day ends its year.
    let days = days + 719_468;
    let era = days.div_euclid(146_097);
    let of_era = days.rem_euclid(146_097);
    let year_of_era = (of_era - of_era / 1460 + of_era / 36_524 - of_era / 146_096) / 365;
    let of_year = of_era - (365 * year_of_era + year_of_era / 4 - year_of_era / 100);
    let shifted = (5 * of_year + 2) / 153;
    let day = of_year - (153 * shifted + 2) / 5 + 1;
    let month = if shifted < 10 {
        shifted + 3
    } else {
        shifted - 9
    };
    let year = year_of_era + era * 400 + i64::from(month <= 2);
    (year, month, day)
}

/// The date and time a zone's clocks show at an instant.
pub(super) fn wall_clock(instant: i64, zone: &TimeZone) -> Option<DateTime> {
    let timestamp = Timestamp::from_millisecond(instant).ok()?;
    Some(timestamp.to_zoned(zone.clone()).datetime())
}

/// The instant at which UTC's clocks show a date and a time.
fn in_utc(date: Date, hour: i8, minute: i8) -> Option<i64> {
    let shown = date.at(hour, minute, 0, 0).to_zoned(TimeZone::UTC).ok()?;
    Some(shown.timestamp().as_millisecond())
}

/// How far a zone's clocks are ahead of UTC's at an instant, to the minute.
fn ahead(instant: i64, zone: &TimeZone) -> Option<i64> {
    let shown = wall_clock(instant, zone)?;
    Some(in_utc(shown.date(), shown.hour(), shown.minute())? - instant)
}

/// The instant a zone's clocks show a date and a time. For a time the zone's clocks skip, or
/// show twice, it is the one the zone's offset just before gives.
fn zoned_instant(date: Date, hour: i8, minute: i8, zone: &TimeZone) -> Option<i64> {
    let guess = in_utc(date, hour, minute)?;
    // The zone's offset at the guess, then at the instant it gives, for a guess across a change.
    let first = guess - ahead(guess, zone)?;
    Some(guess - ahead(first, zone)?)
}

/// How long after its minute a reset still counts: a later one is tomorrow's.
const RESET_GRACE: i64 = 10 * MINUTE;

/// The first instant a zone's clocks show `hour:minute`, from 10 minutes before now.
pub(super) fn next_wall_clock(hour: i8, minute: i8, now: i64, zone: &TimeZone) -> Option<String> {
    let today = wall_clock(now, zone)?.date();
    for days in [-1, 0, 1, 2] {
        let date = today.checked_add(days.days()).ok()?;
        let instant = zoned_instant(date, hour, minute, zone)?;
        if instant > now - RESET_GRACE {
            #[expect(clippy::cast_precision_loss, reason = "an instant of our days")]
            return iso(instant as f64);
        }
    }
    None
}

/// The instant the server's clocks show a time on the day that is `days` after today, and the
/// date they show then: a time they skip is the one after the change, and one they show twice
/// the first.
pub(super) fn local(clock: &Clock, days: i64, hour: i8, minute: i8) -> Option<(i64, DateTime)> {
    let today = wall_clock(clock.now, &clock.zone)?.date();
    let date = today.checked_add(days.days()).ok()?;
    let shown = date.at(hour, minute, 0, 0).to_zoned(clock.zone.clone());
    let shown = shown.ok()?;
    Some((shown.timestamp().as_millisecond(), shown.datetime()))
}
