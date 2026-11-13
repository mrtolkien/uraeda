//! Times in a named zone, the server's: Native Shell's JavaScript has no time zone database, so a
//! time the app shows is turned into its wall clock here, with the system's one.

use jiff::Timestamp;
use jiff::tz::TimeZone;
use nsh_core::prelude::*;

/// A wall clock's reading in a zone.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, JsObject)]
pub struct ZonedClock {
    pub year: i32,
    /// From 1, January, to 12.
    pub month: i32,
    pub day: i32,
    pub hour: i32,
    pub minute: i32,
    /// From 0, Sunday, to 6, as `Date.getDay` counts.
    pub weekday: i32,
}

/// Times in the server's zone.
#[module]
pub(crate) struct Clocks;

#[module(flat)]
impl Clocks {
    /// The wall clock at `at`, milliseconds since 1970 in UTC, in the IANA zone `zone`,
    /// `Europe/Paris`: in this device's zone when `zone` is empty or no zone the system knows.
    pub(crate) fn zoned_clock(at: f64, zone: String) -> ZonedClock {
        clock(at, &zone)
    }
}

fn clock(at: f64, zone: &str) -> ZonedClock {
    let zone = TimeZone::get(zone).unwrap_or_else(|_| TimeZone::system());
    // A time out of jiff's range, or not a number, reads as 1970's first instant.
    #[allow(
        clippy::cast_possible_truncation,
        reason = "checked by jiff's range below"
    )]
    let instant = Timestamp::from_millisecond(at as i64).unwrap_or(Timestamp::UNIX_EPOCH);
    let shown = instant.to_zoned(zone);
    ZonedClock {
        year: i32::from(shown.year()),
        month: i32::from(shown.month()),
        day: i32::from(shown.day()),
        hour: i32::from(shown.hour()),
        minute: i32::from(shown.minute()),
        weekday: i32::from(shown.weekday().to_sunday_zero_offset()),
    }
}

#[cfg(test)]
mod tests {
    use super::clock;

    #[test]
    fn a_time_reads_in_the_zone_named_whatever_the_device_s() {
        // 2026-11-12 14:30 in UTC: 15:30 in Paris, 09:30 in New York, a Thursday in both.
        let at = 1_794_493_800_000.0;
        let paris = clock(at, "Europe/Paris");
        assert_eq!(
            (paris.day, paris.hour, paris.minute, paris.weekday),
            (12, 15, 30, 4)
        );
        let new_york = clock(at, "America/New_York");
        assert_eq!((new_york.hour, new_york.weekday), (9, 4));
        // Across a day's end: 06:00 the next day in Tokyo, a Friday.
        let tokyo = clock(at + 6.5 * 3_600_000.0, "Asia/Tokyo");
        assert_eq!((tokyo.day, tokyo.hour, tokyo.weekday), (13, 6, 5));
    }
}
