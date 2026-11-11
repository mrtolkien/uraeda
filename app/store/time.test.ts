// Run by `nsh test`, without a display: times read in the server's zone, whatever the device's.
import { expect, test } from "nsh/test";
import { serverTime, setServerZone } from "./time";

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
