// A job's schedule and its times in words, as its card reads them, in the server's time zone, the one
// its schedules run in: the hour of a time and of its schedule read alike, whatever the browser's zone.
import type { Schedule } from "uraeda-binding";
import type { JobRunView } from "uraeda-server/fate";

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

/** A date's calendar day and clock in a time zone. */
function partsIn(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    hour: "numeric",
    hourCycle: "h23",
    minute: "numeric",
    month: "numeric",
    timeZone,
    year: "numeric",
  }).formatToParts(date);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return {
    day: value("day"),
    hour: value("hour"),
    minute: value("minute"),
    month: value("month") - 1,
    year: value("year"),
  };
}

/** The calendar day of a date's parts, as a count, so that a day is a day whatever the clock changes did. */
const dayNumber = ({ day, month, year }: { day: number; month: number; year: number }) =>
  Math.round(Date.UTC(year, month, day) / 864e5);

/** The Monday-first index of a day counted by `dayNumber`: 1 January 1970 was a Thursday. */
const weekday = (days: number) => (((days + 3) % 7) + 7) % 7;

/**
 * A time, ahead or past, as the card reads it: "Today at 3:00", "Tomorrow at 3:00", then a day
 * ahead by its name and date, "Monday 16 November at 4:00"; a day past is "Yesterday at 4:00", its
 * name within the week, "Saturday at 5:00", and its date after, "2 November at 5:00". A date of
 * another year says the year. Hours and days are those of `timeZone`, the server's, in which its
 * schedules run, whatever the browser's zone is; days are counted on the calendar.
 */
export function whenWords(at: Date, now: Date, timeZone: string): string {
  const then = partsIn(at, timeZone);
  const days = dayNumber(then) - dayNumber(partsIn(now, timeZone));
  const time = clock(then);
  const year = then.year === partsIn(now, timeZone).year ? "" : ` ${then.year}`;
  const date = `${then.day} ${MONTHS[then.month]}${year}`;
  const name = DAYS[weekday(dayNumber(then))];
  if (days === 0) {
    return `Today at ${time}`;
  }
  if (days === 1) {
    return `Tomorrow at ${time}`;
  }
  if (days > 1) {
    return `${name} ${date} at ${time}`;
  }
  if (days === -1) {
    return `Yesterday at ${time}`;
  }
  return days > -7 ? `${name} at ${time}` : `${date} at ${time}`;
}

/** The line of a scheduled start that failed, in the form the skipped times use: why it could not. */
export const failedWords = (run: Pick<JobRunView, "error">) =>
  `Could not start: ${run.error ?? "the agent did not say why"}`;
