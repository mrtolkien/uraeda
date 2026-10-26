// The times a transcript shows: when a message was sent, and how long an activity lasted. Each
// takes the time it counts from, so no test depends on the clock.
import { expect, test } from "vite-plus/test";
import { elapsed, sentAt } from "../Transcript.tsx";

/** The time of day `sentAt` shows for a date, in the test's locale. */
const timeOf = (at: Date) =>
  at.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

const NOW = new Date(2026, 9, 14, 18, 0);

test("a message sent today shows its time alone", () => {
  const today = new Date(2026, 9, 14, 9, 5);

  expect(sentAt(today.toISOString(), NOW)).toBe(timeOf(today));
});

test("a message sent on another day of the year shows its date and its time", () => {
  const before = new Date(2026, 9, 12, 9, 5);

  const shown = sentAt(before.toISOString(), NOW);

  expect(shown).toMatch(/12/);
  expect(shown).toContain(timeOf(before));
  expect(shown).not.toContain("2026");
});

test("a message sent in another year shows its year too", () => {
  const before = new Date(2025, 9, 12, 9, 5);

  const shown = sentAt(before.toISOString(), NOW);

  expect(shown).toContain("2025");
  expect(shown).toContain(timeOf(before));
});

test("a message sent the same time of day on another day is not taken for today's", () => {
  const yesterday = new Date(2026, 9, 13, 18, 0);

  expect(sentAt(yesterday.toISOString(), NOW)).not.toBe(timeOf(yesterday));
});

test.each([
  { ms: 0, shown: "0 s" },
  { ms: 9400, shown: "9 s" },
  { ms: 59_999, shown: "59 s" },
  { ms: 60_000, shown: "1 min" },
  { ms: 65_000, shown: "1 min 5 s" },
  { ms: 120_000, shown: "2 min" },
  { ms: 599_000, shown: "9 min 59 s" },
  { ms: 600_000, shown: "10 min" },
  { ms: 605_000, shown: "10 min" },
  { ms: 754_000, shown: "12 min" },
])("an activity of $ms ms reads $shown", ({ ms, shown }) => {
  expect(elapsed(ms)).toBe(shown);
});
