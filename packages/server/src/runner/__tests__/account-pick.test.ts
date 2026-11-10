import { expect, test } from "vite-plus/test";
import type { Account } from "../adapter.ts";
import { pickAccount } from "../account-pick.ts";

const HOUR = 3_600_000;
const at = (hours: number) => new Date(Date.UTC(2026, 10, 10, 12) + hours * HOUR).toISOString();
const account = (
  name: string,
  five: number,
  more: Partial<Account> & { resets?: string | null; week?: number } = {},
): Account => ({
  askedAt: 1,
  id: `/home/u/.claude-${name}`,
  name,
  state: "ready",
  windows: [
    {
      id: "five_hour",
      label: "5h",
      resetsAt: "resets" in more ? (more.resets ?? null) : at(2),
      used: five,
    },
    { id: "seven_day", label: "Week", resetsAt: at(72), used: more.week ?? 0.3 },
  ],
  ...more,
});

test.each([
  [
    "the most five hours left",
    [account("default", 0.42), account("b", 0), account("c", 0.88)],
    "b",
  ],
  [
    "a signed-out account and a used-up week are skipped",
    [
      account("default", 0.42),
      account("b", 0, { state: "signed-out" }),
      account("c", 0.2, { week: 1 }),
    ],
    "default",
  ],
  [
    "a tie goes to the first listed",
    [account("default", 0, { resets: null }), account("b", 0, { resets: null })],
    "default",
  ],
  [
    "a window not open loses a tie to one that resets",
    [account("default", 0, { resets: null }), account("b", 0, { resets: at(4) })],
    "b",
  ],
  [
    "an unparsable reset sorts last, and the order stays whole",
    [
      account("default", 1, { resets: "soon" }),
      account("b", 1, { resets: at(5) }),
      account("c", 1, { resets: at(1) }),
    ],
    "c",
  ],
  [
    "a used share that is no number sorts last",
    [account("default", Number.NaN), account("b", 0.9)],
    "b",
  ],
  [
    "a tie goes to the one that resets first",
    [
      account("default", 1, { resets: at(3) }),
      account("b", 1, { resets: at(5) }),
      account("c", 1, { resets: at(1) }),
    ],
    "c",
  ],
  [
    "an account whose usage was never read comes last",
    [account("default", 0, { askedAt: null, windows: [] }), account("b", 0.9)],
    "b",
  ],
  [
    "every week used up: the first signed-in one listed",
    [
      account("default", 0, { state: "missing" }),
      account("b", 0.5, { week: 1 }),
      account("c", 0.1, { week: 1 }),
    ],
    "b",
  ],
  ["no account signed in: no pick", [account("b", 0, { state: "signed-out" })], undefined],
])("the pick: %s", (_, accounts, picked) => {
  expect(pickAccount(accounts)?.name).toBe(picked);
});
