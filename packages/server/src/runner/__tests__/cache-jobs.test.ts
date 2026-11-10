import { DatabaseSync } from "node:sqlite";
import { expect, test } from "vite-plus/test";
import { migrations, SessionCache } from "../cache.ts";
import type { JobRunRow } from "../cache-jobs.ts";

const ROOT = "/repo/a";

/** What `add` takes: a run's fields but those the record decides. */
type NewRun = Omit<JobRunRow, "blockedBy" | "error" | "id" | "refusal" | "refusedTurn"> & {
  blockedBy?: string | null;
  error?: string | null;
};

/** A started run of "Dependencies" in `ROOT`, due at 1000 unless given another time. */
function run(fields: Partial<NewRun> = {}): NewRun {
  return {
    at: 1,
    due: 1000,
    job: "Dependencies",
    outcome: "started",
    reason: null,
    repository: ROOT,
    session: null,
    trigger: "schedule",
    ...fields,
  };
}

/** The cache's record of runs, over a database in memory. */
function opened() {
  return SessionCache.open(":memory:").jobs;
}

test("a time is recorded once, and the history keeps its 50 latest rows", () => {
  const jobs = opened();
  expect(jobs.add(run({ due: 1000 }))).toBeDefined();
  expect(jobs.add(run({ due: 1000 }))).toBeUndefined();
  for (let due = 2000; due < 2060; due += 1) {
    jobs.add(run({ due }));
  }
  expect(jobs.history("Dependencies", ROOT)).toHaveLength(50);
  jobs.rename("Dependencies", "Upgrades");
  expect(jobs.history("Upgrades", ROOT)[0]?.due).toBe(2059);
  expect(jobs.history("Dependencies", "/another/root")).toEqual([]);
});

test("a time is recorded once for each job and each repository", () => {
  const jobs = opened();
  expect(jobs.add(run())).toBeDefined();
  expect(jobs.add(run({ job: "Other" }))).toBeDefined();
  expect(jobs.add(run({ repository: "/repo/b" }))).toBeDefined();
});

test("a row the table refuses is an error, not a time recorded already", () => {
  const jobs = opened();
  const nameless = { ...run(), job: null } as unknown as ReturnType<typeof run>;
  expect(() => jobs.add(nameless)).toThrow();
});

test("runs by hand have no time, and each is recorded", () => {
  const jobs = opened();
  expect(jobs.add(run({ due: null, trigger: "manual" }))).toBeDefined();
  expect(jobs.add(run({ due: null, trigger: "manual" }))).toBeDefined();
  expect(jobs.history("Dependencies", ROOT)).toHaveLength(2);
});

test("the history of a job is pruned apart from the other jobs'", () => {
  const jobs = opened();
  jobs.add(run({ job: "Other" }));
  for (let due = 2000; due < 2060; due += 1) {
    jobs.add(run({ due }));
  }
  expect(jobs.history("Other", ROOT)).toHaveLength(1);
});

test("a row reads back as written, with no refusal", () => {
  const jobs = opened();
  const added = jobs.add(run({ at: 5, session: "s1" }));
  expect(added).toEqual({
    ...run({ at: 5, session: "s1" }),
    blockedBy: null,
    error: null,
    id: added?.id,
    refusal: null,
    refusedTurn: null,
  });
});

test("a skipped time keeps the folder of the change that blocked it", () => {
  const jobs = opened();
  const added = jobs.add(
    run({ blockedBy: "2026-11-10-upgrade", outcome: "skipped", reason: "change-open" }),
  );
  expect(added?.blockedBy).toBe("2026-11-10-upgrade");
  expect(jobs.history("Dependencies", ROOT)[0]?.blockedBy).toBe("2026-11-10-upgrade");
});

test("the latest started run skips the skipped ones, and a session finds its run", () => {
  const jobs = opened();
  expect(jobs.latestStarted("Dependencies", ROOT)).toBeUndefined();
  jobs.add(run({ due: 1000, session: "s1" }));
  jobs.add(run({ due: 2000, session: "s2" }));
  jobs.add(run({ due: 3000, outcome: "skipped", reason: "working" }));
  expect(jobs.latestStarted("Dependencies", ROOT)?.session).toBe("s2");
  expect(jobs.ofSession("s1")?.due).toBe(1000);
  expect(jobs.ofSession("missing")).toBeUndefined();
});

test("fifty skips never push out the latest started run", () => {
  const jobs = opened();
  jobs.add(run({ due: 1000, session: "s1" }));
  for (let due = 2000; due < 2060; due += 1) {
    jobs.add(run({ due, outcome: "skipped", reason: "change-open" }));
  }
  expect(jobs.history("Dependencies", ROOT)).toHaveLength(50);
  expect(jobs.latestStarted("Dependencies", ROOT)?.session).toBe("s1");
  expect(jobs.ofSession("s1")?.due).toBe(1000);
});

test("a started run that is still starting never pushes out the run before it", () => {
  const jobs = opened();
  jobs.add(run({ due: 1000, session: "s1" }));
  for (let due = 2000; due < 2060; due += 1) {
    jobs.add(run({ due, outcome: "skipped", reason: "change-open" }));
  }
  // The start of a run by hand: its row has no session yet, and the start may fail.
  const starting = jobs.add(run({ due: null, session: null, trigger: "manual" }));
  expect(jobs.latestStarted("Dependencies", ROOT)?.session).toBe("s1");
  expect(jobs.ofSession("s1")?.due).toBe(1000);
  jobs.remove(starting?.id ?? 0);
  expect(jobs.latestStarted("Dependencies", ROOT)?.session).toBe("s1");
  expect(jobs.ofSession("s1")?.due).toBe(1000);
});

test("the runs whose session is in a change are kept, and name the change's folder", () => {
  const cache = SessionCache.open(":memory:");
  const { jobs } = cache;
  const made = (folder: string | null) =>
    cache.createSession({
      agent: "fake",
      folder,
      nativeId: `n${Math.random()}`,
      repo: ROOT,
      title: null,
    }).id;
  const upgrades = made(null);
  jobs.add(run({ due: 1000, session: upgrades }));
  cache.attach(upgrades, "2026-11-01-upgrades");
  // Later runs opened no change, and a manual one is starting: the first run's change is still open.
  jobs.add(run({ due: 1500, session: made(null) }));
  for (let due = 2000; due < 2060; due += 1) {
    jobs.add(run({ due, outcome: "skipped", reason: "change-open" }));
  }
  jobs.add(run({ due: null, session: null, trigger: "manual" }));
  expect(jobs.ofSession(upgrades)?.due).toBe(1000);
  expect(jobs.changeFolders("Dependencies", ROOT)).toEqual(["2026-11-01-upgrades"]);
  expect(jobs.changeFolders("Other", ROOT)).toEqual([]);
  expect(jobs.changeFolders("Dependencies", "/another/root")).toEqual([]);
});

test("a time is looked up by its job and repository", () => {
  const jobs = opened();
  jobs.add(run({ due: 1000 }));
  expect(jobs.recorded("Dependencies", ROOT, 1000)).toBe(true);
  expect(jobs.recorded("Dependencies", ROOT, 2000)).toBe(false);
  expect(jobs.recorded("Other", ROOT, 1000)).toBe(false);
  expect(jobs.recorded("Dependencies", "/another/root", 1000)).toBe(false);
});

test("renaming a job to its own name changes nothing", () => {
  const jobs = opened();
  jobs.add(run({ due: 1000, session: "s1" }));
  jobs.rename("Dependencies", "Dependencies");
  expect(jobs.history("Dependencies", ROOT)).toHaveLength(1);
  expect(jobs.latestStarted("Dependencies", ROOT)?.session).toBe("s1");
});

test("on a rename onto a name with rows, the renamed job's rows win", () => {
  const jobs = opened();
  jobs.add(run({ due: 1000, job: "Upgrades", session: "stale" }));
  jobs.add(run({ due: 2000, job: "Upgrades", session: "stale-2" }));
  jobs.add(run({ due: 1000, session: "live" }));
  jobs.rename("Dependencies", "Upgrades");
  expect(jobs.history("Dependencies", ROOT)).toEqual([]);
  expect(jobs.history("Upgrades", ROOT).map(({ due, session }) => [due, session])).toEqual([
    [1000, "live"],
    [2000, "stale-2"],
  ]);
  expect(jobs.ofSession("live")?.job).toBe("Upgrades");
});

test("the history merged by a rename is pruned", () => {
  const jobs = opened();
  for (let due = 1000; due < 1050; due += 1) {
    jobs.add(run({ due, job: "Upgrades", session: `old-${due}` }));
  }
  for (let due = 1025; due < 1075; due += 1) {
    jobs.add(run({ due, session: `new-${due}` }));
  }
  jobs.rename("Dependencies", "Upgrades");
  expect(jobs.history("Upgrades", ROOT)).toHaveLength(50);
  // 25 stale rows without a twin and the 50 renamed ones are 75: the oldest 25 are gone, not hidden.
  expect(jobs.ofSession("old-1000")).toBeUndefined();
  expect(jobs.ofSession("new-1074")).toBeDefined();
});

test("a run's session is set after it, and a run that did not start is removed", () => {
  const jobs = opened();
  const added = jobs.add(run({ due: 1000 }));
  jobs.setSession(added?.id ?? 0, "s1");
  expect(jobs.ofSession("s1")?.due).toBe(1000);
  expect(jobs.latestStarted("Dependencies", ROOT)?.session).toBe("s1");
  jobs.remove(added?.id ?? 0);
  expect(jobs.history("Dependencies", ROOT)).toEqual([]);
  // The time is free again: it can be recorded and started once more.
  expect(jobs.add(run({ due: 1000 }))).toBeDefined();
});

test("a refusal is set with its turn, and cleared", () => {
  const jobs = opened();
  const added = jobs.add(run({ session: "s1" }));
  jobs.setRefusal(added?.id ?? 0, { text: "No slug", turn: 4 });
  expect(jobs.ofSession("s1")).toMatchObject({ refusal: "No slug", refusedTurn: 4 });
  jobs.setRefusal(added?.id ?? 0, null);
  expect(jobs.ofSession("s1")).toMatchObject({ refusal: null, refusedTurn: null });
});

test("the reads of a job and repository use the unique index", () => {
  const db = new DatabaseSync(":memory:");
  for (const migration of migrations) {
    if (typeof migration === "string") {
      db.exec(migration);
    } else {
      migration(db);
    }
  }
  for (const sql of [
    "SELECT * FROM job_runs WHERE job = 'a' AND repository = 'b' ORDER BY id DESC LIMIT 50",
    "SELECT * FROM job_runs WHERE job = 'a' AND repository = 'b' AND outcome = 'started'",
    "SELECT 1 FROM job_runs WHERE job = 'a' AND repository = 'b' AND due = 1",
  ]) {
    const plan = db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all() as Array<{ detail: string }>;
    expect(plan.map(({ detail }) => detail).join(" ")).toContain("job_runs_due");
  }
});

/** The index of the step that creates `job_runs`. */
const TABLE_STEP = migrations.findIndex(
  (step) => typeof step === "string" && step.includes("CREATE TABLE job_runs"),
);

/** Applies the steps `from` to `to` (exclusive) of the schema to the database. */
function apply(db: DatabaseSync, from: number, to: number) {
  for (const migration of migrations.slice(from, to)) {
    if (typeof migration === "string") {
      db.exec(migration);
    } else {
      migration(db);
    }
  }
}

test("the migration adds the table to a cache made before it", () => {
  const db = new DatabaseSync(":memory:");
  apply(db, 0, TABLE_STEP);
  expect(db.prepare("SELECT name FROM sqlite_master WHERE name = 'job_runs'").all()).toEqual([]);
  apply(db, TABLE_STEP, migrations.length);
  expect(db.prepare("SELECT COUNT(*) AS n FROM job_runs").get()).toEqual({ n: 0 });
});

test("a start that failed is a row of its time, with why, and is no started run", () => {
  const jobs = opened();
  const failed = jobs.add(
    run({ due: 1000, error: "Claude Code has no model opus-9: pick another", outcome: "failed" }),
  );
  expect(failed).toMatchObject({
    error: "Claude Code has no model opus-9: pick another",
    outcome: "failed",
    session: null,
  });
  // Its time is recorded: nothing starts it again.
  expect(jobs.recorded("Dependencies", ROOT, 1000)).toBe(true);
  expect(jobs.add(run({ due: 1000 }))).toBeUndefined();
  expect(jobs.latestFailed("Dependencies", ROOT)?.id).toBe(failed?.id);
  expect(jobs.latestStarted("Dependencies", ROOT)).toBeUndefined();
  expect(jobs.changeFolders("Dependencies", ROOT)).toEqual([]);
  expect(jobs.history("Dependencies", ROOT)[0]).toMatchObject({ outcome: "failed" });
});

/**
 * Review 08, X3 (R45). Catches: the failure the card shows until a newer run starts deleted by the
 * pruning, 50 skipped times after it, so the card went back to an older run.
 */
test("the latest failed start outlives the pruning while no run started after it", () => {
  const jobs = opened();
  jobs.add(run({ due: 1000, session: "s1" }));
  const failed = jobs.add(run({ due: 2000, error: "no such model", outcome: "failed" }));
  for (let due = 3000; due < 3060; due += 1) {
    jobs.add(run({ due, outcome: "skipped", reason: "change-open" }));
  }
  expect(jobs.history("Dependencies", ROOT)).toHaveLength(50);
  expect(jobs.latestFailed("Dependencies", ROOT)?.id).toBe(failed?.id);
  // A newer failure replaces it, and the older one is pruned with the rest.
  const newer = jobs.add(run({ due: 4000, error: "no such agent", outcome: "failed" }));
  for (let due = 5000; due < 5060; due += 1) {
    jobs.add(run({ due, outcome: "skipped", reason: "change-open" }));
  }
  expect(jobs.latestFailed("Dependencies", ROOT)?.id).toBe(newer?.id);
  // A run that starts after it makes it an old row: the pruning takes it, as any other.
  jobs.add(run({ due: 6000, session: "s2" }));
  for (let due = 7000; due < 7060; due += 1) {
    jobs.add(run({ due, outcome: "skipped", reason: "change-open" }));
  }
  expect(jobs.latestFailed("Dependencies", ROOT)).toBeUndefined();
  expect(jobs.latestStarted("Dependencies", ROOT)?.session).toBe("s2");
});
