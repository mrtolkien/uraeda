// The times a schedule names, in the process's local time, computed with `Date` alone: the
// scheduler asks which time is due, and the web UI's "next run" asks which comes next.
import type { Schedule } from "uraeda-binding";

/** A time is missed once it is more than 5 minutes past. */
export const MISSED_AFTER_MS = 5 * 60_000;

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

/** How many days apart two times of any schedule are, at most: a weekly one's week. */
const DAYS = 7;

/**
 * The local time `hour:minute` of the day `day` days after `from`'s. A time the clock skips that
 * night is the first minute after the skip (2:30 becomes 3:00, not the 3:30 `Date` gives), and a
 * time it passes twice is the first.
 */
function at(from: Date, day: number, { hour, minute }: Schedule): Date {
  const time = new Date(from.getFullYear(), from.getMonth(), from.getDate() + day, hour, minute);
  if (time.getHours() === hour && time.getMinutes() === minute) {
    return time;
  }
  // `Date` moved it forward by the skip: go back minute by minute while the zone's offset is the
  // one after the skip, which ends on the first minute that exists.
  let first = time;
  while (new Date(first.getTime() - MINUTE_MS).getTimezoneOffset() === time.getTimezoneOffset()) {
    first = new Date(first.getTime() - MINUTE_MS);
  }
  return first;
}

/** Whether the schedule runs on the local day `day` days after `from`'s. */
function runsOn(schedule: Schedule, from: Date, day: number): boolean {
  const weekday = new Date(from.getFullYear(), from.getMonth(), from.getDate() + day).getDay();
  switch (schedule.kind) {
    case "weekdays":
      return weekday >= 1 && weekday <= 5;
    case "weekly":
      return weekday === (schedule.day ?? 1) % 7;
    default:
      return true;
  }
}

/** The top of the local hour `now` is in. */
function topOfHour(now: Date): Date {
  const top = new Date(now);
  top.setMinutes(0, 0, 0);
  return top;
}

/** The latest scheduled time at or before `now`, in the process's local time. */
export function dueAt(schedule: Schedule, now: Date): Date {
  if (schedule.kind === "hourly") {
    return topOfHour(now);
  }
  // One day ahead is no use, and a week back always holds a time.
  for (let day = 0; day >= -DAYS; day -= 1) {
    if (runsOn(schedule, now, day)) {
      const time = at(now, day, schedule);
      if (time.getTime() <= now.getTime()) {
        return time;
      }
    }
  }
  throw new Error(`The schedule ${schedule.kind} has no time within a week.`);
}

/** The first scheduled time after `now`. */
export function nextAfter(schedule: Schedule, now: Date): Date {
  if (schedule.kind === "hourly") {
    return new Date(topOfHour(now).getTime() + HOUR_MS);
  }
  for (let day = 0; day <= DAYS; day += 1) {
    if (runsOn(schedule, now, day)) {
      const time = at(now, day, schedule);
      if (time.getTime() > now.getTime()) {
        return time;
      }
    }
  }
  throw new Error(`The schedule ${schedule.kind} has no time within a week.`);
}
