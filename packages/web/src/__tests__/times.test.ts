// The feature page's times, in the browser's time zone: UTC in the tests (`vite.config.ts`).
import { expect, onTestFinished, test, vi } from "vite-plus/test";
import { clock, day, duration } from "../feature/times.ts";

/** Review focus 10 */
test("a time shows its date only when the day changes", () => {
  expect(clock("2026-10-17T15:08:00Z", "2026-10-17T12:11:00Z")).toBe("15:08");
  expect(clock("2026-10-18T09:10:00Z", "2026-10-17T15:08:00Z")).toBe("Oct 18, 09:10");
  expect(clock("2026-10-17T00:05:00Z")).toBe("00:05");
});

test("durations", () => {
  expect(duration(26 * 60)).toBe("26 min");
  expect(duration(2 * 3600 + 50 * 60)).toBe("2 h 50 min");
  expect(duration(27 * 3600)).toBe("1 d 3 h");
  expect(duration(20)).toBe("< 1 min");
});

test("a day, from a time or a folder's date", () => {
  expect(day("2026-10-17T22:09:00Z")).toBe("Oct 17");
  expect(day("2026-10-09")).toBe("Oct 9");
});

/** Review focus 10: the day is the browser's, not UTC's. */
test("two times of one local day read as one day, whatever UTC says", async () => {
  process.env.TZ = "America/Los_Angeles";
  onTestFinished(() => {
    process.env.TZ = "UTC";
  });
  vi.resetModules();
  const times = await import("../feature/times.ts");

  // 13:00 and 22:00 on Oct 17 in Los Angeles: Oct 17 and Oct 18 in UTC.
  expect(times.clock("2026-10-18T05:00:00Z", "2026-10-17T20:00:00Z")).toBe("22:00");
});
