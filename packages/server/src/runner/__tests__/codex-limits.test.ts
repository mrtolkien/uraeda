import { expect, test } from "vite-plus/test";
import { codexLimit, codexWindows } from "../codex-limits.ts";

/** A window as `[usedPercent, windowDurationMins, resetsAt]`. */
type Window = [number, number | null, number | null];

const window = ([usedPercent, windowDurationMins, resetsAt]: Window) => ({
  resetsAt,
  usedPercent,
  windowDurationMins,
});
const rateLimits = ({
  primary,
  reached = null,
  secondary,
}: {
  primary?: Window;
  reached?: string | null;
  secondary?: Window;
}) => ({
  credits: null,
  limitId: "codex",
  limitName: null,
  planType: "plus",
  primary: primary ? window(primary) : null,
  rateLimitReachedType: reached,
  secondary: secondary ? window(secondary) : null,
});
const usageError = {
  codexErrorInfo: "usageLimitExceeded",
  message: "You've hit your usage limit.",
};

test.each<[string, unknown, unknown]>([
  [
    "both windows",
    rateLimits({ primary: [7, 300, 1_794_155_269], secondary: [64, 10_080, 1_794_205_264] }),
    [
      { id: "five_hour", label: "5h", resetsAt: "2026-11-08T16:27:49.000Z", used: 0.07 },
      { id: "seven_day", label: "Week", resetsAt: "2026-11-09T06:21:04.000Z", used: 0.64 },
    ],
  ],
  [
    "a window of another length is named by it",
    rateLimits({ primary: [12.5, 60, 1_794_155_269] }),
    [{ id: "60m", label: "1h", resetsAt: "2026-11-08T16:27:49.000Z", used: 0.125 }],
  ],
  ["a window without its reset is left out", rateLimits({ primary: [7, 300, null] }), []],
  ["no snapshot", undefined, []],
])("%s", (_name, limits, expected) => {
  expect(codexWindows(limits)).toEqual(expected);
});

test.each<[string, unknown, unknown, unknown]>([
  [
    "a turn refused by the 5-hour limit",
    rateLimits({ primary: [100, 300, 1_794_155_269], secondary: [64, 10_080, 1_794_205_264] }),
    usageError,
    { kind: "session", resetsAt: "2026-11-08T16:27:49.000Z", text: usageError.message },
  ],
  [
    "a turn refused by the weekly limit",
    rateLimits({ primary: [100, 300, 1_794_155_269], secondary: [100, 10_080, 1_794_205_264] }),
    usageError,
    { kind: "other", resetsAt: "2026-11-09T06:21:04.000Z", text: usageError.message },
  ],
  [
    "a limit reached in a usage report",
    rateLimits({ primary: [100, 300, 1_794_155_269], reached: "rate_limit_reached" }),
    undefined,
    { kind: "session", resetsAt: "2026-11-08T16:27:49.000Z" },
  ],
  [
    "credits run out",
    rateLimits({ primary: [40, 300, 1_794_155_269], reached: "workspace_member_credits_depleted" }),
    undefined,
    { kind: "other" },
  ],
  ["a refusal without windows", undefined, usageError, { kind: "other", text: usageError.message }],
  [
    "a refusal before the 5-hour window reads full resumes at its reset",
    rateLimits({ primary: [97, 300, 1_794_155_269], secondary: [64, 10_080, 1_794_205_264] }),
    usageError,
    { kind: "session", resetsAt: "2026-11-08T16:27:49.000Z", text: usageError.message },
  ],
  [
    "a limit reached in a report before the 5-hour window reads full",
    rateLimits({ primary: [99, 300, 1_794_155_269], reached: "rate_limit_reached" }),
    undefined,
    { kind: "session", resetsAt: "2026-11-08T16:27:49.000Z" },
  ],
  [
    "a refusal whose first window is not the 5-hour one",
    rateLimits({ primary: [97, 10_080, 1_794_205_264] }),
    usageError,
    { kind: "other", text: usageError.message },
  ],
  [
    "another error",
    rateLimits({ primary: [100, 300, 1_794_155_269] }),
    { codexErrorInfo: "badRequest", message: "Bad request" },
    undefined,
  ],
  [
    "a usage report under the limits",
    rateLimits({ primary: [7, 300, 1_794_155_269] }),
    undefined,
    undefined,
  ],
])("%s", (_name, limits, error, expected) => {
  expect(codexLimit(limits, error)).toEqual(expected);
});
