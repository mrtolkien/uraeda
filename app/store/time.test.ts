// Run by `nsh test`, without a display: times read in the server's zone, whatever the device's.
import { expect, test } from "nsh/test";
import { serverDay, serverDaysAgo, serverTime, setServerZone } from "./time";

test("a time reads in the server's zone, and as near to now as it is", () => {
  // Thursday 2026-11-12, 14:30 in UTC.
  const now = Date.UTC(2026, 10, 12, 14, 30);
  setServerZone("Asia/Tokyo");
  // 23:30 in Tokyo: today there, whatever the device's day.
  expect(serverTime(now, now)).toBe("23:30");
  // An hour later is Friday in Tokyo.
  expect(serverTime(now + 3_600_000, now)).toBe("Fri 00:30");
  setServerZone("America/New_York");
  expect(serverTime(now, now)).toBe("09:30");
  expect(serverTime("2026-10-01T12:00:00Z", now)).toBe("1 Oct 08:00");
  expect(serverTime("2025-10-01T12:00:00Z", now)).toBe("1 Oct 2025");
});

test("a day reads in the server's zone, and a date as it is written", () => {
  const now = Date.UTC(2026, 10, 12, 14, 30);
  setServerZone("Asia/Tokyo");
  // 23:30 on the 11th in UTC is already the 12th in Tokyo: today there.
  expect(serverDaysAgo(Date.UTC(2026, 10, 11, 23, 30), now)).toBe(0);
  expect(serverDay(Date.UTC(2026, 10, 11, 23, 30), now)).toBe("12 Nov");
  // A date with no time is the day it names, whatever the zone.
  expect(serverDay("2026-10-16", now)).toBe("16 Oct");
  expect(serverDay("2025-10-16", now)).toBe("16 Oct 2025");
  expect(serverDaysAgo("2026-11-11", now)).toBe(1);
});
