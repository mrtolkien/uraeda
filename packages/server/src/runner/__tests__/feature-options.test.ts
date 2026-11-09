// A feature's own run options, kept in the data folder's database: only what the feature changed,
// over the settings as they are at each run, and the migration that adds them.
import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";
import { expect, onTestFinished, test } from "vite-plus/test";
import { temporaryFolder } from "uraeda-binding/test-utils";
import { testSettings } from "../../testing.ts";
import { migrations, SessionCache } from "../cache.ts";
import { FeatureOptions } from "../feature-options.ts";

const binding = await import("uraeda-binding");

const REPO = "/repo/a";
const FOLDER = "2026-11-08-run-options";

/** A feature options store on a new cache, over the settings of a new config folder. */
async function opened() {
  const settings = await testSettings();
  onTestFinished(() => settings.close());
  const cache = SessionCache.open(":memory:");
  const options = new FeatureOptions({
    binding,
    db: cache.db,
    defaults: () => settings.runs().options,
  });
  /** Writes the settings' run options, and reads the file again, as a change of the page does. */
  const setDefaults = async (runs: Parameters<typeof binding.setRunOptions>[1]) => {
    await binding.setRunOptions(settings.dir, runs);
    await settings.reload();
  };
  return { cache, options, setDefaults };
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
  const { cache, options } = await opened();

  expect(options.own(REPO, FOLDER)).toEqual({ steps: [] });
  options.set(REPO, FOLDER, { reviewDepth: "branch", steps: [] });
  options.set(REPO, FOLDER, { steps: [] });

  expect(options.own(REPO, FOLDER)).toEqual({ steps: [] });
  expect(cache.db.prepare("SELECT COUNT(*) AS rows FROM feature_options").get()).toEqual({
    rows: 0,
  });
  expect(() => options.set(REPO, FOLDER, { reviewDepth: "deep", steps: [] })).toThrow(/^refused: /);
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
