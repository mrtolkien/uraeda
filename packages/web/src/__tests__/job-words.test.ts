// US4: a job's schedule and its times in words, as its card reads them. The times read in the
// server's time zone, which the record carries, whatever the browser's zone is (review 05, finding 5).
import { expect, test } from "vite-plus/test";
import { scheduleWords, whenWords } from "../jobs/words.ts";

test.each([
  [{ hour: 0, kind: "hourly", minute: 0 }, "Every hour"],
  [{ hour: 3, kind: "daily", minute: 0 }, "Every day at 3:00"],
  [{ hour: 16, kind: "daily", minute: 5 }, "Every day at 16:05"],
  [{ hour: 5, kind: "weekdays", minute: 0 }, "Weekdays at 5:00"],
  [{ day: 1, hour: 4, kind: "weekly", minute: 0 }, "Every Monday at 4:00"],
  [{ day: 7, hour: 23, kind: "weekly", minute: 59 }, "Every Sunday at 23:59"],
  [{ day: 3, hour: 0, kind: "weekly", minute: 30 }, "Every Wednesday at 0:30"],
])("scheduleWords(%j) is %s", (schedule, words) => expect(scheduleWords(schedule)).toBe(words));

/** A time of the server's zone, here UTC: the month is 0-based, as `Date`'s. */
const utc = (year: number, month: number, day: number, hour = 0, minute = 0) =>
  new Date(Date.UTC(year, month, day, hour, minute));

// Tuesday 10 November 2026, 10:30.
const NOW = utc(2026, 10, 10, 10, 30);

test.each([
  // Ahead: today, tomorrow, then the day's name and date.
  [utc(2026, 10, 10, 15, 0), "Today at 15:00"],
  [utc(2026, 10, 11, 3, 0), "Tomorrow at 3:00"],
  [utc(2026, 10, 12, 3, 0), "Thursday 12 November at 3:00"],
  [utc(2026, 10, 16, 4, 0), "Monday 16 November at 4:00"],
  // The month's end, and the year's.
  [utc(2026, 11, 1, 0, 0), "Tuesday 1 December at 0:00"],
  [utc(2027, 0, 1, 9, 5), "Friday 1 January 2027 at 9:05"],
  // Past: today, yesterday, a day this week by name, then the date.
  [utc(2026, 10, 10, 3, 0), "Today at 3:00"],
  [utc(2026, 10, 9, 4, 0), "Yesterday at 4:00"],
  [utc(2026, 10, 7, 5, 0), "Saturday at 5:00"],
  [utc(2026, 10, 2, 5, 0), "2 November at 5:00"],
  [utc(2025, 11, 31, 23, 59), "31 December 2025 at 23:59"],
])("whenWords(%s) is %s", (at, words) => expect(whenWords(at, NOW, "UTC")).toBe(words));

test("a day is counted on the calendar, not in 24 hours", () => {
  // 23:50 and 00:10 are one day apart in the calendar, 20 minutes in time.
  const late = utc(2026, 10, 10, 23, 50);
  expect(whenWords(utc(2026, 10, 11, 0, 10), late, "UTC")).toBe("Tomorrow at 0:10");
  expect(whenWords(utc(2026, 10, 10, 23, 40), utc(2026, 10, 11, 0, 10), "UTC")).toBe(
    "Yesterday at 23:40",
  );
});

test("a time reads in the server's zone, for the hour and for the day's word", () => {
  // 23:30 UTC on the 10th is 0:30 on the 11th in Paris, and 8:30 on the 11th in Tokyo.
  const at = utc(2026, 10, 10, 23, 30);
  const now = utc(2026, 10, 10, 10, 0);
  expect(whenWords(at, now, "UTC")).toBe("Today at 23:30");
  expect(whenWords(at, now, "Europe/Paris")).toBe("Tomorrow at 0:30");
  expect(whenWords(at, now, "Asia/Tokyo")).toBe("Tomorrow at 8:30");
  // The day names and dates are the zone's too.
  expect(whenWords(utc(2026, 10, 15, 23, 30), now, "Europe/Paris")).toBe(
    "Monday 16 November at 0:30",
  );
});
