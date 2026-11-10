// A job's schedule and its times in words, as its card reads them, in the server's local time,
// which is the human's: the card never shows a time as the server writes it.
import type { Schedule } from "uraeda-binding";

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

/** A time of day, the hour unpadded and the minutes in two digits: "3:00", "16:05". */
const clock = (at: { hour: number; minute: number }) =>
  `${at.hour}:${String(at.minute).padStart(2, "0")}`;

/** The schedule in words: "Every day at 3:00", "Every Monday at 4:00", "Weekdays at 5:00". */
export function scheduleWords(schedule: Schedule): string {
  switch (schedule.kind) {
    case "hourly":
      return "Every hour";
    case "weekdays":
      return `Weekdays at ${clock(schedule)}`;
    case "weekly":
      return `Every ${DAYS[(schedule.day ?? 1) - 1]} at ${clock(schedule)}`;
    default:
      return `Every day at ${clock(schedule)}`;
  }
}

/** The calendar day of a date, as a count, so that a day is a day whatever the clock changes did. */
const dayNumber = (date: Date) =>
  Math.round(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 864e5);

/** The Monday-first index of a date's day of the week. */
const weekday = (date: Date) => (date.getDay() + 6) % 7;

/**
 * A time, ahead or past, as the card reads it: "Today at 3:00", "Tomorrow at 3:00", then a day
 * ahead by its name and date, "Monday 16 November at 4:00"; a day past is "Yesterday at 4:00", its
 * name within the week, "Saturday at 5:00", and its date after, "2 November at 5:00". A date of
 * another year says the year. Days are counted on the calendar.
 */
export function whenWords(at: Date, now: Date): string {
  const days = dayNumber(at) - dayNumber(now);
  const time = clock({ hour: at.getHours(), minute: at.getMinutes() });
  const year = at.getFullYear() === now.getFullYear() ? "" : ` ${at.getFullYear()}`;
  const date = `${at.getDate()} ${MONTHS[at.getMonth()]}${year}`;
  if (days === 0) {
    return `Today at ${time}`;
  }
  if (days === 1) {
    return `Tomorrow at ${time}`;
  }
  if (days > 1) {
    return `${DAYS[weekday(at)]} ${date} at ${time}`;
  }
  if (days === -1) {
    return `Yesterday at ${time}`;
  }
  return days > -7 ? `${DAYS[weekday(at)]} at ${time}` : `${date} at ${time}`;
}
