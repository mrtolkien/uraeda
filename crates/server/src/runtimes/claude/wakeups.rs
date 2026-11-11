//! The one-shot wakeups the agent sets, which keep its process open until they fire.

use super::json::Object;
use super::time::{Clock, iso, local};
use crate::runner::Event;

/// The one-shot wakeup a tool call sets: `ScheduleWakeup` in `delaySeconds`, or a `CronCreate`
/// that does not recur. A recurring cron, or one that cannot be read, sets none.
pub(super) fn of_tool(name: &str, input: &Object, clock: &Clock) -> Option<Event> {
    let at = match name {
        "ScheduleWakeup" => {
            let delay = input.get("delaySeconds")?.as_number()?.as_f64()?;
            #[expect(clippy::cast_precision_loss, reason = "an instant of our days")]
            iso(clock.now as f64 + delay * 1000.0)?
        }
        "CronCreate" => {
            let once = input.get("recurring")? == &serde_json::Value::Bool(false);
            let cron = input.get("cron")?.as_str().filter(|_| once)?;
            fire_time(cron, clock)?
        }
        _ => return None,
    };
    Some(Event::Wakeup { at })
}

/// The days a one-shot cron is searched over: four years, for a 29 February.
const CRON_DAYS: i64 = 4 * 366;

/// A cron field: a number, or `*` for any.
#[derive(Clone, Copy, PartialEq, Eq)]
enum Field {
    Any,
    At(i8),
}

impl Field {
    /// Whether the field takes a value.
    fn takes(self, value: i8) -> bool {
        self == Field::Any || self == Field::At(value)
    }
}

/// A cron field: a number in its range, or `*` for any. Anything else cannot be read.
fn cron_field(field: &str, min: i8, max: i8) -> Option<Field> {
    if field == "*" {
        return Some(Field::Any);
    }
    let digits = !field.is_empty() && field.bytes().all(|byte| byte.is_ascii_digit());
    let value: i8 = field.parse().ok().filter(|_| digits)?;
    (min..=max).contains(&value).then_some(Field::At(value))
}

/// The next fire time of a one-shot cron, `minute hour day month weekday`, read in the server's
/// zone: a fixed minute and hour, the other fields a number or `*`. None for another cron.
fn fire_time(cron: &str, clock: &Clock) -> Option<String> {
    let fields: Vec<&str> = cron.split_whitespace().collect();
    let [minute, hour, day, month, weekday] = fields[..] else {
        return None;
    };
    let (Field::At(minute), Field::At(hour)) =
        (cron_field(minute, 0, 59)?, cron_field(hour, 0, 23)?)
    else {
        return None;
    };
    let day = cron_field(day, 1, 31)?;
    let month = cron_field(month, 1, 12)?;
    // Sunday is 0, and 7 too.
    let weekday = match cron_field(weekday, 0, 7)? {
        Field::At(weekday) => Field::At(weekday % 7),
        Field::Any => Field::Any,
    };
    for days in 0..=CRON_DAYS {
        let (instant, shown) = local(clock, days, hour, minute)?;
        let on_day = day.takes(shown.day());
        let on_weekday = weekday.takes(shown.weekday().to_sunday_zero_offset());
        // Cron fires on either the day or the weekday when both are set.
        let either = if day != Field::Any && weekday != Field::Any {
            on_day || on_weekday
        } else {
            on_day && on_weekday
        };
        if instant > clock.now && either && month.takes(shown.month()) {
            #[expect(clippy::cast_precision_loss, reason = "an instant of our days")]
            return iso(instant as f64);
        }
    }
    None
}
