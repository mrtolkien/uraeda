//! The times a schedule names, in a time zone, the server's local one: the scheduler asks which
//! time is due and whether the server saw it arrive, and the Jobs record which comes next.

use std::time::{Duration, SystemTime};

use jiff::civil::{Date, DateTime, Time};
use jiff::tz::{AmbiguousOffset, TimeZone};
use jiff::{Timestamp, ToSpan as _};
use uraeda_core::jobs::Schedule;

/// A time is missed once it is more than 5 minutes past.
pub(crate) const MISSED_AFTER: Duration = Duration::from_secs(5 * 60);

/// How many days apart two times of any schedule are, at most: a weekly one's week.
const DAYS: i32 = 7;

/// How far a time the clock skips looks for the first minute that exists: no clock skips more.
const SKIP_LIMIT: i32 = 4 * 60;

const HOUR: Duration = Duration::from_secs(60 * 60);

fn timestamp(time: SystemTime) -> Timestamp {
    Timestamp::try_from(time).unwrap_or(Timestamp::UNIX_EPOCH)
}

fn system(time: Timestamp) -> SystemTime {
    SystemTime::from(time)
}

/// The instant of `hour:minute` on a local day. A time the clock skips that night is the first
/// minute after the skip (2:30 becomes 3:00), and a time it passes twice is the first.
fn at(zone: &TimeZone, day: Date, hour: u32, minute: u32) -> Option<Timestamp> {
    let time = Time::new(i8::try_from(hour).ok()?, i8::try_from(minute).ok()?, 0, 0).ok()?;
    let mut civil = DateTime::from_parts(day, time);
    for _ in 0..=SKIP_LIMIT {
        let ambiguous = zone.to_ambiguous_timestamp(civil);
        if !matches!(ambiguous.offset(), AmbiguousOffset::Gap { .. }) {
            return ambiguous.earlier().ok();
        }
        civil = civil.checked_add(1.minute()).ok()?;
    }
    None
}

/// Whether the schedule runs on a local day.
fn runs_on(schedule: &Schedule, day: Date) -> bool {
    let weekday = day.weekday().to_monday_one_offset();
    match schedule.kind.as_str() {
        "weekdays" => weekday <= 5,
        "weekly" => i8::try_from(schedule.day.unwrap_or(1)).is_ok_and(|day| day == weekday),
        _ => true,
    }
}

/// The top of the local hour `now` is in: `now` less what the clock has shown since the hour.
/// It counts the real hours, so the hour a clock passes twice has two tops, an hour apart.
fn top_of_hour(zone: &TimeZone, now: Timestamp) -> Timestamp {
    let local = now.to_zoned(zone.clone());
    let since = i64::from(local.minute()) * 60 + i64::from(local.second());
    let since = jiff::SignedDuration::new(since, local.subsec_nanosecond());
    now.checked_sub(since).unwrap_or(now)
}

/// The scheduled times of the local days from `now`'s, `days` of them, in the order given.
fn times(
    schedule: &Schedule,
    zone: &TimeZone,
    now: Timestamp,
    days: impl Iterator<Item = i32>,
) -> impl Iterator<Item = Timestamp> {
    let today = now.to_zoned(zone.clone()).date();
    days.filter_map(move |day| today.checked_add(day.days()).ok())
        .filter(|day| runs_on(schedule, *day))
        .filter_map(|day| at(zone, day, schedule.hour, schedule.minute))
}

/// The latest scheduled time at or before `now`. None for a time of day out of range, which the
/// core never reads.
pub(crate) fn due_at(schedule: &Schedule, zone: &TimeZone, now: SystemTime) -> Option<SystemTime> {
    let now = timestamp(now);
    if schedule.kind == "hourly" {
        return Some(system(top_of_hour(zone, now)));
    }
    // One day ahead is no use, and a week back always holds a time.
    let mut times = times(schedule, zone, now, (-DAYS..=0).rev());
    times.find(|time| *time <= now).map(system)
}

/// The first scheduled time after `now`.
pub(crate) fn next_after(
    schedule: &Schedule,
    zone: &TimeZone,
    now: SystemTime,
) -> Option<SystemTime> {
    let at = timestamp(now);
    if schedule.kind == "hourly" {
        return Some(system(top_of_hour(zone, at)) + HOUR);
    }
    let mut times = times(schedule, zone, at, 0..=DAYS);
    times.find(|time| *time > at).map(system)
}

/// Whether the server starts a time due now: it saw the time arrive, being looking since
/// `first`, and it is not more than 5 minutes past.
pub(crate) fn startable(due: SystemTime, first: SystemTime, now: SystemTime) -> bool {
    let late = now.duration_since(due).unwrap_or_default();
    due > first && late <= MISSED_AFTER
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Paris, by its rule: no database of zones is read.
    fn paris() -> TimeZone {
        TimeZone::posix("CET-1CEST,M3.5.0,M10.5.0/3").unwrap()
    }

    fn schedule(kind: &str, day: Option<u32>, hour: u32, minute: u32) -> Schedule {
        Schedule {
            kind: kind.to_owned(),
            day,
            hour,
            minute,
        }
    }

    fn daily(hour: u32, minute: u32) -> Schedule {
        schedule("daily", None, hour, minute)
    }

    /// A time as RFC 3339 with its offset, or as a local time of Paris without one.
    fn local(text: &str) -> SystemTime {
        if let Ok(time) = text.parse::<Timestamp>() {
            return system(time);
        }
        let civil: DateTime = text.parse().unwrap();
        system(paris().to_ambiguous_timestamp(civil).earlier().unwrap())
    }

    #[test]
    fn the_time_due_is_the_latest_at_or_before_now() {
        let hourly = schedule("hourly", None, 0, 0);
        let weekdays = schedule("weekdays", None, 3, 0);
        let rows = [
            (
                "daily, just after",
                daily(3, 0),
                "2026-11-11T03:00:20",
                "2026-11-11T03:00:00",
            ),
            (
                "daily, before",
                daily(3, 0),
                "2026-11-11T02:59:00",
                "2026-11-10T03:00:00",
            ),
            (
                "daily, at it",
                daily(3, 0),
                "2026-11-11T03:00:00",
                "2026-11-11T03:00:00",
            ),
            (
                "weekdays, a Sunday",
                weekdays.clone(),
                "2026-11-15T12:00:00",
                "2026-11-13T03:00:00",
            ),
            (
                "weekdays, Monday early",
                weekdays,
                "2026-11-16T01:00:00",
                "2026-11-13T03:00:00",
            ),
            (
                "monday 04:00",
                schedule("weekly", Some(1), 4, 0),
                "2026-11-11T12:00:00",
                "2026-11-09T04:00:00",
            ),
            (
                "sunday 04:00, on a Monday",
                schedule("weekly", Some(7), 4, 0),
                "2026-11-16T12:00:00",
                "2026-11-15T04:00:00",
            ),
            (
                "hourly",
                hourly.clone(),
                "2026-11-11T14:20:00",
                "2026-11-11T14:00:00",
            ),
            (
                "02:30, clock forward",
                daily(2, 30),
                "2026-03-29T12:00:00",
                "2026-03-29T03:00:00",
            ),
            (
                "02:30, clock back: the first",
                daily(2, 30),
                "2026-10-25T12:00:00",
                "2026-10-25T02:30:00+02:00",
            ),
            (
                "hourly, first pass of the repeated hour",
                hourly.clone(),
                "2026-10-25T02:20:00+02:00",
                "2026-10-25T02:00:00+02:00",
            ),
            (
                "hourly, second pass of the repeated hour",
                hourly.clone(),
                "2026-10-25T02:20:00+01:00",
                "2026-10-25T02:00:00+01:00",
            ),
            (
                "hourly, after the skipped hour",
                hourly,
                "2026-03-29T03:20:00+02:00",
                "2026-03-29T03:00:00+02:00",
            ),
        ];
        for (name, schedule, now, due) in rows {
            let found = due_at(&schedule, &paris(), local(now));
            assert_eq!(found, Some(local(due)), "{name}");
        }
    }

    #[test]
    fn the_next_time_is_the_first_after_now() {
        let hourly = schedule("hourly", None, 0, 0);
        let rows = [
            (
                "daily, after",
                daily(3, 0),
                "2026-11-10T10:00:00",
                "2026-11-11T03:00:00",
            ),
            (
                "daily, before",
                daily(3, 0),
                "2026-11-10T02:00:00",
                "2026-11-10T03:00:00",
            ),
            (
                "daily, at it",
                daily(3, 0),
                "2026-11-10T03:00:00",
                "2026-11-11T03:00:00",
            ),
            (
                "weekly Monday",
                schedule("weekly", Some(1), 4, 0),
                "2026-11-10T10:00:00",
                "2026-11-16T04:00:00",
            ),
            (
                "weekdays, a Friday evening",
                schedule("weekdays", None, 3, 0),
                "2026-11-13T12:00:00",
                "2026-11-16T03:00:00",
            ),
            (
                "hourly",
                hourly.clone(),
                "2026-11-11T14:20:00",
                "2026-11-11T15:00:00",
            ),
            (
                "02:30, clock forward",
                daily(2, 30),
                "2026-03-28T12:00:00",
                "2026-03-29T03:00:00",
            ),
            (
                "hourly, first pass of the repeated hour",
                hourly.clone(),
                "2026-10-25T02:20:00+02:00",
                "2026-10-25T02:00:00+01:00",
            ),
            (
                "hourly, before the skipped hour",
                hourly,
                "2026-03-29T01:30:00+01:00",
                "2026-03-29T03:00:00+02:00",
            ),
        ];
        for (name, schedule, now, next) in rows {
            let found = next_after(&schedule, &paris(), local(now));
            assert_eq!(found, Some(local(next)), "{name}");
        }
    }

    // Only a server that saw a time arrive starts it, at most 5 minutes late: a restart, a job
    // turned on after its time, or a machine that slept starts nothing past.
    #[test]
    fn a_time_starts_only_when_seen_arriving_and_not_missed() {
        let due = local("2026-11-11T03:00:00");
        let minutes = |count: u64| Duration::from_secs(count * 60);
        let rows = [
            ("seen before, on time", due - minutes(10), due, true),
            (
                "seen before, 5 minutes late",
                due - minutes(10),
                due + minutes(5),
                true,
            ),
            (
                "seen before, 6 minutes late",
                due - minutes(10),
                due + minutes(6),
                false,
            ),
            (
                "first seen at the time itself",
                due,
                due + minutes(1),
                false,
            ),
            (
                "first seen after it",
                due + minutes(1),
                due + minutes(2),
                false,
            ),
        ];
        for (name, first, now, starts) in rows {
            assert_eq!(startable(due, first, now), starts, "{name}");
        }
    }
}
