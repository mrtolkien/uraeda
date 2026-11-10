// US4: a job's schedule and its times in words, as its card reads them. The dates are local, as the
// words are: the server's time is the human's.
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

// Tuesday 10 November 2026, 10:30.
const NOW = new Date(2026, 10, 10, 10, 30);

test.each([
  // Ahead: today, tomorrow, then the day's name and date.
  [new Date(2026, 10, 10, 15, 0), "Today at 15:00"],
  [new Date(2026, 10, 11, 3, 0), "Tomorrow at 3:00"],
  [new Date(2026, 10, 12, 3, 0), "Thursday 12 November at 3:00"],
  [new Date(2026, 10, 16, 4, 0), "Monday 16 November at 4:00"],
  // The month's end, and the year's.
  [new Date(2026, 11, 1, 0, 0), "Tuesday 1 December at 0:00"],
  [new Date(2027, 0, 1, 9, 5), "Friday 1 January 2027 at 9:05"],
  // Past: today, yesterday, a day this week by name, then the date.
  [new Date(2026, 10, 10, 3, 0), "Today at 3:00"],
  [new Date(2026, 10, 9, 4, 0), "Yesterday at 4:00"],
  [new Date(2026, 10, 7, 5, 0), "Saturday at 5:00"],
  [new Date(2026, 10, 2, 5, 0), "2 November at 5:00"],
  [new Date(2025, 11, 31, 23, 59), "31 December 2025 at 23:59"],
])("whenWords(%s) is %s", (at, words) => expect(whenWords(at, NOW)).toBe(words));

test("a day is counted on the calendar, not in 24 hours", () => {
  // 23:50 and 00:10 are one day apart in the calendar, 20 minutes in time.
  const late = new Date(2026, 10, 10, 23, 50);
  expect(whenWords(new Date(2026, 10, 11, 0, 10), late)).toBe("Tomorrow at 0:10");
  expect(whenWords(new Date(2026, 10, 10, 23, 40), new Date(2026, 10, 11, 0, 10))).toBe(
    "Yesterday at 23:40",
  );
});
