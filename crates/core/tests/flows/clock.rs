//! Dates and timestamps: the arithmetic behind a record's date and a commit's time.

use std::time::{Duration, UNIX_EPOCH};

use uraeda_core::today::{Date, rfc3339};

#[test]
fn dates_are_parsed_strictly_and_counted_from_the_epoch() {
    assert_eq!(Date::parse("2026-10-11").unwrap().to_string(), "2026-10-11");
    assert_eq!(
        Date::parse("2028-02-29").map(|d| d.day),
        Some(29),
        "a leap day"
    );
    for invalid in [
        "2026-13-99",
        "2026-02-29",
        "2026-10-1",
        "2026/10/11",
        "abcd-10-11",
        "",
    ] {
        assert_eq!(Date::parse(invalid), None, "{invalid}");
    }
    let rows = [
        ("1970-01-01", 0),
        ("2026-10-11", 1_791_676_800),
        ("2028-03-01", 1_835_481_600),
    ];
    for (date, seconds) in rows {
        assert_eq!(Date::parse(date).unwrap().unix_seconds(), seconds, "{date}");
    }
}

#[test]
fn a_time_is_written_in_utc() {
    assert_eq!(rfc3339(UNIX_EPOCH), "1970-01-01T00:00:00Z");
    assert_eq!(
        rfc3339(UNIX_EPOCH + Duration::from_secs(1_791_706_320)),
        "2026-10-11T08:12:00Z"
    );
}
