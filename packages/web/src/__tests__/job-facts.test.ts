// US4: what a job's card says of its next run, and of its last, from the Jobs record. Each reason a
// job has no next time has words, an agent that is off among them, and a last run reads as the
// sidebar's card names its session or its change.
import { expect, test } from "vite-plus/test";
import { lastFact, nextFact, type RunSession } from "../jobs/facts.ts";

const NOW = new Date(2026, 10, 12, 10, 30);
/** The zone `NOW` is local to, which the times read in. */
const ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

const job = (next: { at: string | null; text?: string | null; why: string | null }, rest = {}) => ({
  agent: null,
  next: { text: null, ...next },
  problem: null,
  ...rest,
});

const MISSING = "“notes” is not in Uraeda's list.";

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
  // The agent's words are the server's, its title and its reason included.
  [
    job({ at: null, text: "Not running here: Codex is off in this repository.", why: "agent-off" }),
    "Not running here: Codex is off in this repository.",
    "problem",
  ],
  // The scheduler's order of reasons: a pause stands over an agent that is off, which the server
  // gives no words for then; the card says "Paused" (US4 2).
  [job({ at: null, why: "paused" }, { agent: "codex" }), "Paused", "quiet"],
  // A problem that is not why the job does not run does not replace what the card says.
  [job({ at: null, why: "paused" }, { problem: MISSING }), "Paused", "quiet"],
  [
    job({ at: new Date(2026, 10, 13, 3).toISOString(), why: null }, { problem: MISSING }),
    "Tomorrow at 3:00",
    "quiet",
  ],
])("nextFact(%j) says %s", (given, text, tone) =>
  expect(nextFact(given, NOW, ZONE)).toMatchObject({ text, tone }),
);

/** US4, edge cases: a job that runs here and names a repository that is not listed shows both. */
test("a job's problem shows beneath its next run when the job still runs here", () => {
  const ahead = new Date(2026, 10, 13, 3).toISOString();
  expect(nextFact(job({ at: ahead, why: null }, { problem: MISSING }), NOW, ZONE)).toMatchObject({
    note: MISSING,
  });
  expect(nextFact(job({ at: null, why: "paused" }, { problem: MISSING }), NOW, ZONE)).toMatchObject(
    { note: MISSING },
  );
  // The problem that is the reason is said once, as the reason.
  expect(
    nextFact(job({ at: null, why: "problem" }, { problem: "A job has no prompt." }), NOW, ZONE)
      .note,
  ).toBeUndefined();
  expect(nextFact(job({ at: ahead, why: null }), NOW, ZONE).note).toBeUndefined();
});

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
