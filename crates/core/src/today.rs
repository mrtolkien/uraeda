//! Calendar days: today's, those in folder names, and timestamps for JSON.

use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

/// A calendar day.
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub struct Date {
    pub year: i32,
    pub month: u32,
    pub day: u32,
}

impl Date {
    /// Parses `YYYY-MM-DD`, rejecting days that do not exist, like `2026-13-99`.
    pub fn parse(text: &str) -> Option<Date> {
        let bytes = text.as_bytes();
        if bytes.len() != 10 || bytes[4] != b'-' || bytes[7] != b'-' {
            return None;
        }
        let digits = |range: std::ops::Range<usize>| -> Option<u32> {
            let part = &text[range];
            part.bytes()
                .all(|b| b.is_ascii_digit())
                .then(|| part.parse().ok())?
        };
        let date = Date {
            year: digits(0..4)? as i32,
            month: digits(5..7)?,
            day: digits(8..10)?,
        };
        let valid = (1..=12).contains(&date.month)
            && date.day >= 1
            && date.day <= days_in_month(date.year, date.month);
        valid.then_some(date)
    }
}

impl std::fmt::Display for Date {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{:04}-{:02}-{:02}", self.year, self.month, self.day)
    }
}

fn days_in_month(year: i32, month: u32) -> u32 {
    match month {
        2 if (year % 4 == 0 && year % 100 != 0) || year % 400 == 0 => 29,
        2 => 28,
        4 | 6 | 9 | 11 => 30,
        _ => 31,
    }
}

/// Today: `URA_TODAY` when set, else the local date from `date`, else the UTC date.
pub fn today() -> Date {
    if let Some(date) = std::env::var("URA_TODAY")
        .ok()
        .and_then(|value| Date::parse(value.trim()))
    {
        return date;
    }
    Command::new("date")
        .arg("+%F")
        .output()
        .ok()
        .and_then(|output| Date::parse(String::from_utf8_lossy(&output.stdout).trim()))
        .unwrap_or_else(|| utc(SystemTime::now()).0)
}

/// The UTC date and the seconds into that day.
fn utc(time: SystemTime) -> (Date, u64) {
    let seconds = time
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    // Howard Hinnant's days-to-civil algorithm.
    let days = (seconds / 86_400) as i64 + 719_468;
    let era = days.div_euclid(146_097);
    let day_of_era = days.rem_euclid(146_097);
    let year_of_era =
        (day_of_era - day_of_era / 1460 + day_of_era / 36_524 - day_of_era / 146_096) / 365;
    let day_of_year = day_of_era - (365 * year_of_era + year_of_era / 4 - year_of_era / 100);
    let shifted_month = (5 * day_of_year + 2) / 153;
    let day = (day_of_year - (153 * shifted_month + 2) / 5 + 1) as u32;
    let month = if shifted_month < 10 {
        shifted_month + 3
    } else {
        shifted_month - 9
    } as u32;
    let year = (year_of_era + era * 400 + i64::from(month <= 2)) as i32;
    (Date { year, month, day }, seconds % 86_400)
}

/// A timestamp in RFC 3339, in UTC: `2026-10-11T08:12:00Z`.
pub fn rfc3339(time: SystemTime) -> String {
    let (date, seconds) = utc(time);
    format!(
        "{date}T{:02}:{:02}:{:02}Z",
        seconds / 3600,
        seconds % 3600 / 60,
        seconds % 60
    )
}

/// How long ago a moment was, in words: "2 hours ago".
pub fn ago(time: SystemTime) -> String {
    let seconds = SystemTime::now()
        .duration_since(time)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let (count, unit) = match seconds {
        0..60 => return "just now".to_string(),
        60..3600 => (seconds / 60, "minute"),
        3600..86_400 => (seconds / 3600, "hour"),
        _ => (seconds / 86_400, "day"),
    };
    let plural = if count == 1 { "" } else { "s" };
    format!("{count} {unit}{plural} ago")
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Duration;

    #[test]
    fn dates() {
        assert_eq!(Date::parse("2026-10-11").unwrap().to_string(), "2026-10-11");
        assert_eq!(Date::parse("2028-02-29").map(|d| d.day), Some(29));
        for invalid in [
            "2026-13-99",
            "2026-02-29",
            "2026-10-1",
            "2026/10/11",
            "abcd-10-11",
        ] {
            assert_eq!(Date::parse(invalid), None, "{invalid}");
        }
    }

    #[test]
    fn timestamps() {
        let time = UNIX_EPOCH + Duration::from_secs(1_791_706_320);
        assert_eq!(rfc3339(time), "2026-10-11T08:12:00Z");
        assert_eq!(rfc3339(UNIX_EPOCH), "1970-01-01T00:00:00Z");
    }
}
