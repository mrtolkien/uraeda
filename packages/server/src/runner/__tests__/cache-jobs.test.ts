import { DatabaseSync } from "node:sqlite";
import { expect, test } from "vite-plus/test";
import { migrations, SessionCache } from "../cache.ts";
import type { JobRunRow } from "../cache-jobs.ts";

const ROOT = "/repo/a";

/** A started run of "Dependencies" in `ROOT`, due at 1000 unless given another time. */
function run(
  fields: Partial<Omit<JobRunRow, "id" | "refusal" | "refusedTurn">> = {},
): Omit<JobRunRow, "id" | "refusal" | "refusedTurn"> {
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
    id: added?.id,
    refusal: null,
    refusedTurn: null,
  });
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

test("a refusal is set with its turn, and cleared", () => {
  const jobs = opened();
  const added = jobs.add(run({ session: "s1" }));
  jobs.setRefusal(added?.id ?? 0, { text: "No slug", turn: 4 });
  expect(jobs.ofSession("s1")).toMatchObject({ refusal: "No slug", refusedTurn: 4 });
  jobs.setRefusal(added?.id ?? 0, null);
  expect(jobs.ofSession("s1")).toMatchObject({ refusal: null, refusedTurn: null });
});

test("the migration adds the table to a cache made before it", () => {
  const db = new DatabaseSync(":memory:");
  for (const migration of migrations.slice(0, -1)) {
    if (typeof migration === "string") {
      db.exec(migration);
    } else {
      migration(db);
    }
  }
  db.exec(`PRAGMA user_version = ${migrations.length - 1}`);
  expect(db.prepare("SELECT name FROM sqlite_master WHERE name = 'job_runs'").all()).toEqual([]);
  const last = migrations.at(-1);
  if (typeof last === "string") {
    db.exec(last);
  } else {
    last?.(db);
  }
  expect(db.prepare("SELECT COUNT(*) AS n FROM job_runs").get()).toEqual({ n: 0 });
});
