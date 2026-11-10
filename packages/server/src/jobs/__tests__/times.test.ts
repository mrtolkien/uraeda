import type { Schedule } from "uraeda-binding";
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { dueAt, MISSED_AFTER_MS, nextAfter } from "../times.ts";

// The times are the process's local time: the zone is set for this file, and put back.
const zone = process.env.TZ;
beforeAll(() => {
  process.env.TZ = "Europe/Paris";
});
afterAll(() => {
  if (zone === undefined) {
    delete process.env.TZ;
  } else {
    process.env.TZ = zone;
  }
});

const daily = (hour: number, minute: number): Schedule => ({ hour, kind: "daily", minute });
const weekdays = (hour: number, minute: number): Schedule => ({ hour, kind: "weekdays", minute });
const weekly = (day: number, hour: number, minute: number): Schedule => ({
  day,
  hour,
  kind: "weekly",
  minute,
});
const hourly = (): Schedule => ({ hour: 0, kind: "hourly", minute: 0 });

/** A time written as ISO text: in the zone's local time unless it has an offset. */
const local = (text: string) => new Date(text);

test.each([
  ["daily 03:00, at 03:00:20", daily(3, 0), "2026-11-11T03:00:20", "2026-11-11T03:00:00"],
  ["daily 03:00, at 02:59", daily(3, 0), "2026-11-11T02:59:00", "2026-11-10T03:00:00"],
  ["daily 03:00, exactly at 03:00", daily(3, 0), "2026-11-11T03:00:00", "2026-11-11T03:00:00"],
  ["weekdays, on a Sunday", weekdays(3, 0), "2026-11-15T12:00:00", "2026-11-13T03:00:00"],
  [
    "weekdays, on a Monday before its time",
    weekdays(3, 0),
    "2026-11-16T01:00:00",
    "2026-11-13T03:00:00",
  ],
  ["monday 04:00", weekly(1, 4, 0), "2026-11-11T12:00:00", "2026-11-09T04:00:00"],
  ["sunday 04:00, on a Monday", weekly(7, 4, 0), "2026-11-16T12:00:00", "2026-11-15T04:00:00"],
  ["hourly", hourly(), "2026-11-11T14:20:00", "2026-11-11T14:00:00"],
  [
    "02:30 the night the clock moves forward",
    daily(2, 30),
    "2026-03-29T12:00:00",
    "2026-03-29T03:00:00",
  ],
  [
    "02:30 the night it moves back: the first",
    daily(2, 30),
    "2026-10-25T12:00:00",
    "2026-10-25T02:30:00+02:00",
  ],
  [
    "hourly, the first pass of the repeated hour",
    hourly(),
    "2026-10-25T02:20:00+02:00",
    "2026-10-25T02:00:00+02:00",
  ],
  [
    "hourly, the second pass of the repeated hour",
    hourly(),
    "2026-10-25T02:20:00+01:00",
    "2026-10-25T02:00:00+01:00",
  ],
  [
    "hourly, before the hour the clock skips",
    hourly(),
    "2026-03-29T01:30:00+01:00",
    "2026-03-29T01:00:00+01:00",
  ],
  [
    "hourly, after the hour the clock skips",
    hourly(),
    "2026-03-29T03:20:00+02:00",
    "2026-03-29T03:00:00+02:00",
  ],
])("%s", (_name, schedule, now, due) => {
  expect(dueAt(schedule, local(now)).getTime()).toBe(local(due).getTime());
});

test.each([
  ["daily 03:00 after its time", daily(3, 0), "2026-11-10T10:00:00", "2026-11-11T03:00:00"],
  ["daily 03:00 before its time", daily(3, 0), "2026-11-10T02:00:00", "2026-11-10T03:00:00"],
  ["daily 03:00, exactly at it", daily(3, 0), "2026-11-10T03:00:00", "2026-11-11T03:00:00"],
  ["weekly Monday 04:00", weekly(1, 4, 0), "2026-11-10T10:00:00", "2026-11-16T04:00:00"],
  ["weekdays, on a Friday evening", weekdays(3, 0), "2026-11-13T12:00:00", "2026-11-16T03:00:00"],
  ["hourly", hourly(), "2026-11-11T14:20:00", "2026-11-11T15:00:00"],
  [
    "02:30, the day before the clock moves forward",
    daily(2, 30),
    "2026-03-28T12:00:00",
    "2026-03-29T03:00:00",
  ],
  [
    "hourly, the first pass of the repeated hour",
    hourly(),
    "2026-10-25T02:20:00+02:00",
    "2026-10-25T02:00:00+01:00",
  ],
  [
    "hourly, the second pass of the repeated hour",
    hourly(),
    "2026-10-25T02:20:00+01:00",
    "2026-10-25T03:00:00+01:00",
  ],
  [
    "hourly, before the hour the clock skips",
    hourly(),
    "2026-03-29T01:30:00+01:00",
    "2026-03-29T03:00:00+02:00",
  ],
  [
    "hourly, after the hour the clock skips",
    hourly(),
    "2026-03-29T03:20:00+02:00",
    "2026-03-29T04:00:00+02:00",
  ],
])("next: %s", (_name, schedule, now, next) => {
  expect(nextAfter(schedule, local(now)).getTime()).toBe(local(next).getTime());
});

test("a time is missed once it is more than 5 minutes past", () => {
  expect(MISSED_AFTER_MS).toBe(300_000);
});
