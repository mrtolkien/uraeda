// A feature's own run options, kept in their own database in the data folder: only what the
// feature changed, over the settings as they are at each run, never cleared with the cache; and the
// cache's migration that places the sessions in their runs.
import { DatabaseSync } from "node:sqlite";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, onTestFinished, test, vi } from "vite-plus/test";
import { temporaryFolder } from "uraeda-binding/test-utils";
import { testSettings } from "../../testing.ts";
import { migrations, SessionCache } from "../cache.ts";
import { FEATURE_OPTIONS_FILE, featureOptionsOf } from "../feature-options.ts";

const binding = await import("uraeda-binding");

const REPO = "/repo/a";
const FOLDER = "2026-11-08-run-options";

/**
 * A feature options store in a new data folder, over the settings of a new config folder, beside
 * a cache in memory.
 */
async function opened() {
  const settings = await testSettings();
  onTestFinished(() => settings.close());
  const dataDir = temporaryFolder("uraeda-data");
  const options = featureOptionsOf({ binding, dataDir, settings });
  onTestFinished(() => options.close());
  /** Writes the settings' run options, and reads the file again, as a change of the page does. */
  const setDefaults = async (runs: Parameters<typeof binding.setRunOptions>[1]) => {
    await binding.setRunOptions(settings.dir, runs);
    await settings.reload();
  };
  return { cache: SessionCache.open(":memory:"), dataDir, options, setDefaults };
}

test("a feature runs on the settings for every value it never changed", async () => {
  const { options, setDefaults } = await opened();
  await setDefaults({ steps: [{ model: "opus", step: "review" }] });

  options.set(REPO, FOLDER, { steps: [{ effort: "high", model: "opus", step: "spec" }] });
  await setDefaults({ steps: [{ model: "sonnet", step: "review" }] });

  expect(options.own(REPO, FOLDER)).toEqual({
    steps: [{ effort: "high", model: "opus", step: "spec" }],
  });
  expect(options.resolved(REPO, FOLDER).steps).toEqual([
    { effort: "high", model: "opus", step: "spec" },
    { model: "sonnet", step: "review" },
  ]);
});

test("a feature's change applies to its next run", async () => {
  const { cache, options } = await opened();
  const build = cache.createSession({
    agent: "claude",
    folder: FOLDER,
    model: "opus",
    nativeId: "3f2c",
    repo: REPO,
    title: null,
  });
  cache.addTurn({
    allowed: null,
    kind: "workflow",
    sessionId: build.id,
    state: "running",
    step: "implementation",
    trigger: "manual",
  });

  options.set(REPO, FOLDER, { steps: [{ model: "sonnet", step: "review" }] });

  expect(options.resolved(REPO, FOLDER).steps).toEqual([{ model: "sonnet", step: "review" }]);
  expect(cache.session(build.id)?.model).toBe("opus");
});

test("a feature without options reads none, and options set back to none leave no row", async () => {
  const { dataDir, options } = await opened();

  expect(options.own(REPO, FOLDER)).toEqual({ steps: [] });
  options.set(REPO, FOLDER, { reviewDepth: "branch", steps: [] });
  options.set(REPO, FOLDER, { steps: [] });

  expect(options.own(REPO, FOLDER)).toEqual({ steps: [] });
  const file = new DatabaseSync(join(dataDir, FEATURE_OPTIONS_FILE));
  onTestFinished(() => file.close());
  expect(file.prepare("SELECT COUNT(*) AS rows FROM feature_options").get()).toEqual({ rows: 0 });
  expect(() => options.set(REPO, FOLDER, { reviewDepth: "deep", steps: [] })).toThrow(/^refused: /);
});

test("a feature's options outlive the cache, and a file that cannot be read is kept", async () => {
  const { dataDir, options } = await opened();
  const own = { steps: [{ model: "opus", step: "spec" }] };
  options.set(REPO, FOLDER, own);
  options.close();
  const log = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  onTestFinished(() => log.mockRestore());
  // A cache that cannot be read starts empty.
  const runner = join(dataDir, "runner.sqlite");
  writeFileSync(runner, "not a database");
  SessionCache.open(runner).db.close();

  expect(options.own(REPO, FOLDER)).toEqual(own);

  // A file of options that cannot be read refuses new ones, and is kept as it was.
  const elsewhere = temporaryFolder("uraeda-data");
  const file = join(elsewhere, FEATURE_OPTIONS_FILE);
  writeFileSync(file, "not a database");
  const settings = { runs: () => ({ options: { steps: [] } }) };
  const broken = featureOptionsOf({ binding, dataDir: elsewhere, settings });

  expect(() => broken.set(REPO, FOLDER, own)).toThrow(/^refused: The run options could not be/);
  expect(broken.own(REPO, FOLDER)).toEqual({ steps: [] });
  expect(readFileSync(file, "utf8")).toBe("not a database");
});

test("migration 11 keeps every session, with no step, parent, role, or worktree", () => {
  const path = join(temporaryFolder("uraeda-cache"), "cache.db");
  const old = new DatabaseSync(path);
  for (const migration of migrations.slice(0, 10)) {
    if (typeof migration === "string") {
      old.exec(migration);
    } else {
      migration(old);
    }
  }
  old.exec("PRAGMA user_version = 10");
  old.exec(`INSERT INTO sessions (id, repo, folder, agent, native_id, created_at, updated_at)
    VALUES ('s', '${REPO}', '${FOLDER}', 'claude', '3f2c', '2026-11-03', '2026-11-03');`);
  old.close();

  const cache = SessionCache.open(path);

  expect(cache.session("s")).toMatchObject({
    parent: null,
    role: null,
    step: null,
    worktree: null,
  });
  const sub = cache.createSession({
    agent: "codex",
    folder: FOLDER,
    nativeId: "9a1b",
    parent: "s",
    repo: REPO,
    role: "implementer",
    step: "build",
    title: null,
    worktree: "/repo/a/.worktrees/task-1",
  });
  expect(cache.session(sub.id)).toMatchObject({
    parent: "s",
    role: "implementer",
    step: "build",
    worktree: "/repo/a/.worktrees/task-1",
  });
});
