//! A job's schedule: the four forms of the data model, in lower case, each time on 24 hours.

/// Why a time is refused.
pub(super) const TIME_PROBLEM: &str = "A time is from 00:00 to 23:59.";

/// The days a weekly schedule names, Monday first.
const DAYS: [&str; 7] = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
];

/// When a job runs, in the server's local time.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Schedule {
    /// `"hourly"`, `"daily"`, `"weekdays"`, or `"weekly"`.
    pub kind: String,
    /// The day of a weekly schedule, 1 for Monday to 7 for Sunday; absent for the other forms.
    pub day: Option<u32>,
    /// 0 to 23; 0 for `hourly`, which runs at minute 0 of every hour.
    pub hour: u32,
    /// 0 to 59.
    pub minute: u32,
}

/// The schedule `text` writes, or why it is none: the schedule is not understood, or its time is
/// outside 00:00 to 23:59.
pub fn schedule(text: &str) -> Result<Schedule, String> {
    let not_understood = || format!("the schedule “{text}” is not understood");
    let words: Vec<&str> = text.split_whitespace().collect();
    let (kind, day, time) = match words.as_slice() {
        ["hourly"] => return Ok(of("hourly", None, 0, 0)),
        ["daily", time] => ("daily", None, *time),
        ["weekdays", time] => ("weekdays", None, *time),
        [day, time] => {
            let number = DAYS.iter().position(|name| name == day);
            ("weekly", number.map(|number| number as u32 + 1), *time)
        }
        _ => return Err(not_understood()),
    };
    if kind == "weekly" && day.is_none() {
        return Err(not_understood());
    }
    let (hour, minute) = time_of(time).ok_or_else(not_understood)??;
    Ok(of(kind, day, hour, minute))
}

fn of(kind: &str, day: Option<u32>, hour: u32, minute: u32) -> Schedule {
    Schedule {
        kind: kind.to_owned(),
        day,
        hour,
        minute,
    }
}

/// `HH:MM` as its hour and minute, a problem when outside 00:00 to 23:59, or `None` when the text
/// is not two digits, a colon, and two digits.
fn time_of(time: &str) -> Option<Result<(u32, u32), String>> {
    let (hour, minute) = time.split_once(':')?;
    let two = |part: &str| {
        (part.len() == 2 && part.bytes().all(|byte| byte.is_ascii_digit()))
            .then(|| part.parse::<u32>().ok())
            .flatten()
    };
    let (hour, minute) = (two(hour)?, two(minute)?);
    Some(if hour > 23 || minute > 59 {
        Err(TIME_PROBLEM.to_owned())
    } else {
        Ok((hour, minute))
    })
}
