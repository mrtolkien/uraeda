import { expect, test } from "vite-plus/test";
import { limitOfText } from "../claude-limits.ts";
import type { Limit } from "../events.ts";

/** 23:01 in Tokyo, 15:01 in Paris, the server's zone here. */
const NOW = new Date("2026-11-03T14:01:00Z");
const SERVER_ZONE = "Europe/Paris";

test.each<[string, Omit<Limit, "text"> | undefined, string?]>([
  [
    "You've hit your session limit · resets 8:40am (Asia/Tokyo)",
    { kind: "session", resetsAt: "2026-11-03T23:40:00.000Z" },
  ],
  // 10:50pm in Tokyo today went by 11 minutes ago: the next one is tomorrow's.
  [
    "You've hit your session limit · resets 10:50pm (Asia/Tokyo)",
    { kind: "session", resetsAt: "2026-11-04T13:50:00.000Z" },
  ],
  // Read within 10 minutes after its minute: that reset, not tomorrow's.
  [
    "You've hit your session limit · resets 11pm (Asia/Tokyo)",
    { kind: "session", resetsAt: "2026-11-03T14:00:00.000Z" },
  ],
  [
    "You've hit your session limit · resets 8:40am (Asia/Tokyo)",
    { kind: "session", resetsAt: "2026-11-03T23:40:00.000Z" },
    "2026-11-03T23:40:20Z",
  ],
  // Read at 00:03 in Tokyo: yesterday's 11:58pm.
  [
    "You've hit your session limit · resets 11:58pm (Asia/Tokyo)",
    { kind: "session", resetsAt: "2026-11-03T14:58:00.000Z" },
    "2026-11-03T15:03:00Z",
  ],
  // Without a zone, the server's: 8:40 the next morning in Paris.
  [
    "You've hit your session limit · resets 8:40am",
    { kind: "session", resetsAt: "2026-11-04T07:40:00.000Z" },
  ],
  ["You've hit your session limit", { kind: "session" }],
  ["You've hit your weekly limit · resets Mon 12:00am (Asia/Tokyo)", { kind: "other" }],
  ["You've hit your Opus limit · resets 8:40am (Asia/Tokyo)", { kind: "other" }],
  ["Not logged in · Please run /login", undefined],
])("the limit text %s", (text, expected, now) => {
  expect(limitOfText(text, now ? new Date(now) : NOW, SERVER_ZONE)).toEqual(
    expected && { ...expected, text },
  );
});
