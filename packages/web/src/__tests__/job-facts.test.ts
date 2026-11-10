// US4: what a job's card says of its next run, and of its last, from the Jobs record. Each reason a
// job has no next time has words, an agent that is off among them, and a last run reads as the
// sidebar's card names its session or its change.
import { expect, test } from "vite-plus/test";
import { lastFact, nextFact, type RunSession } from "../jobs/facts.ts";

const NOW = new Date(2026, 10, 12, 10, 30);
/** The zone `NOW` is local to, which the times read in. */
const ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

const job = (next: { at: string | null; why: string | null }, rest = {}) => ({
  agent: null,
  next,
  problem: null,
  ...rest,
});

test.each([
  [job({ at: new Date(2026, 10, 13, 3).toISOString(), why: null }), "Tomorrow at 3:00", "quiet"],
  [job({ at: null, why: "paused" }), "Paused", "quiet"],
  [job({ at: null, why: "change-open" }), "Waits for that change to close", "quiet"],
  [job({ at: null, why: "off" }), "Scheduled jobs are off", "quiet"],
  [
    job({ at: null, why: "problem" }, { problem: "Two jobs are named “A”." }),
    "Two jobs are named “A”.",
    "problem",
  ],
  [
    job({ at: null, why: "agent-off" }),
    "Not running here: no agent is on in this repository.",
    "problem",
  ],
  [
    job({ at: null, why: "agent-off" }, { agent: "codex" }),
    "Not running here: codex is not available.",
    "problem",
  ],
])("nextFact(%j) says %s", (given, text, tone) =>
  expect(nextFact(given, NOW, ZONE)).toMatchObject({ text, tone }),
);

const run = (folder: string | null) => ({
  at: new Date(2026, 10, 12, 3).toISOString(),
  due: null,
  folder,
  id: "1",
  outcome: "started" as const,
  reason: null,
  session: "s",
  title: "Upgrade three dependencies",
  trigger: "manual" as const,
});

const session = (rest: Partial<RunSession>): RunSession => ({
  done: false,
  label: "Idle",
  status: "idle",
  ...rest,
});

test.each([
  [undefined, undefined, "Never ran", "quiet"],
  [
    run(null),
    session({ label: "New reply", status: "unread" }),
    "Today at 3:00 · new reply",
    "unread",
  ],
  [run(null), session({ done: true }), "Today at 3:00 · read", "quiet"],
  [
    run("2026-11-12-upgrade"),
    session({
      label: "Needs you",
      status: "needs-you",
      step: { kind: "pull-request", label: "PR ready" },
    }),
    "Today at 3:00 · started “Upgrade three dependencies”, PR ready",
    "needsYou",
  ],
  [
    run(null),
    session({ label: "Needs attention", status: "attention" }),
    "Today at 3:00 · needs attention",
    "problem",
  ],
  [run(null), undefined, "Today at 3:00 · “Upgrade three dependencies”", "quiet"],
])("lastFact(%#) says %s", (given, read, text, tone) =>
  expect(lastFact(given, read, NOW, ZONE)).toMatchObject({ text, tone }),
);
