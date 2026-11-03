import { expect, test } from "vite-plus/test";
import { limitOfText } from "../claude-limits.ts";
import type { Limit } from "../events.ts";

/** 23:01 in Tokyo, 15:01 in Paris, the server's zone here. */
const NOW = new Date("2026-11-03T14:01:00Z");
const SERVER_ZONE = "Europe/Paris";

test.each<[string, Omit<Limit, "text"> | undefined]>([
  [
    "You've hit your session limit · resets 8:40am (Asia/Tokyo)",
    { kind: "session", resetsAt: "2026-11-03T23:40:00.000Z" },
  ],
  // 11pm in Tokyo today went by a minute ago: the next one is tomorrow's.
  [
    "You've hit your session limit · resets 11pm (Asia/Tokyo)",
    { kind: "session", resetsAt: "2026-11-04T14:00:00.000Z" },
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
])("the limit text %s", (text, expected) => {
  expect(limitOfText(text, NOW, SERVER_ZONE)).toEqual(expected && { ...expected, text });
});
