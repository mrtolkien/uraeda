// The dev shell's seeding of a new worktree, `packages/server/scripts/worktree-seed.ts`: its Rust
// build and Vite Task cache start from the main checkout's, without the workspace's own crates.
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { expect, test } from "vite-plus/test";
import { git, temporaryFolder } from "uraeda-binding/test-utils";
import { mainCheckout, seedTarget, seedTaskCache } from "../../scripts/worktree-seed.ts";

const SCRIPT = fileURLToPath(new URL("../../scripts/worktree-seed.ts", import.meta.url));
const ROOT = fileURLToPath(new URL("../../../..", import.meta.url));

/** Writes files under `root`, their paths from it. */
function write(root: string, files: Record<string, string>) {
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
}

/** A main checkout holding a one-crate Cargo workspace, and a worktree of it. */
function checkouts() {
  const main = temporaryFolder("uraeda-seed");
  git(main, "init", "--quiet", "--initial-branch", "main");
  for (const [key, value] of [
    ["user.name", "Test"],
    ["user.email", "test@example.com"],
    ["commit.gpgSign", "false"],
  ]) {
    git(main, "config", key, value);
  }
  write(main, {
    ".gitignore": "/target/\n/node_modules/\n/.worktrees/\n",
    "Cargo.toml": '[package]\nname = "seeded-app"\nversion = "0.1.0"\nedition = "2024"\n',
    "src/lib.rs": "",
  });
  git(main, "add", "--all");
  git(main, "commit", "--quiet", "--no-verify", "--message", "chore: crate");
  const worktree = join(main, ".worktrees/feature");
  git(main, "worktree", "add", "--quiet", "-b", "feature", worktree);
  return { main, worktree };
}

/**
 * The main checkout's build: the crate's units and its binary, a dependency's, and one named like
 * the crate.
 */
const BUILD = {
  "target/debug/.fingerprint/itoa-0123456789abcdef/lib-itoa": "",
  "target/debug/.fingerprint/seeded-app-0123456789abcdef/lib-seeded_app": "",
  "target/debug/.fingerprint/seeded-app-fedcba9876543210/test-integration-test-t": "",
  "target/debug/.fingerprint/seeded-app-macros-0123456789abcdef/lib-seeded_app_macros": "",
  "target/debug/deps/libitoa-0123456789abcdef.rlib": "",
  "target/debug/seeded-app": "",
  "target/debug/seeded-app.d": "",
  "target/x86_64-unknown-linux-gnu/debug/.fingerprint/seeded-app-0123456789abcdef/lib-seeded_app":
    "",
};

/** A copy keeping the files' times, as a clone does, on any filesystem. */
function copy(from: string, to: string) {
  cpSync(from, to, { preserveTimestamps: true, recursive: true, verbatimSymlinks: true });
  return true;
}

test("a worktree's main checkout is found, and the main checkout has none", () => {
  const { main, worktree } = checkouts();

  expect(mainCheckout(worktree)).toBe(main);
  expect(mainCheckout(main)).toBeNull();
});

test("a worktree's build starts from the main checkout's, without the workspace's own crates", () => {
  const { main, worktree } = checkouts();
  write(main, BUILD);

  expect(seedTarget(main, worktree, copy)).toBe("target/ seeded from the main checkout's");

  expect(readdirSync(join(worktree, "target/debug/.fingerprint")).sort()).toEqual([
    "itoa-0123456789abcdef",
    "seeded-app-macros-0123456789abcdef",
  ]);
  expect(readdirSync(join(worktree, "target/x86_64-unknown-linux-gnu/debug/.fingerprint"))).toEqual(
    [],
  );
  expect(existsSync(join(worktree, "target/debug/deps/libitoa-0123456789abcdef.rlib"))).toBe(true);
  // The main checkout's binary does not stand for the worktree's before its first build.
  expect(readdirSync(join(worktree, "target/debug")).sort()).toEqual([".fingerprint", "deps"]);
  expect(readdirSync(join(main, "target/debug/.fingerprint"))).toHaveLength(4);
});

test("a worktree with a build of its own, or on a filesystem without clones, keeps its own", () => {
  const { main, worktree } = checkouts();
  write(main, BUILD);
  write(worktree, { "target/debug/.fingerprint/seeded-app-0123456789abcdef/lib-seeded_app": "" });

  expect(seedTarget(main, worktree, copy)).toBeNull();
  expect(readdirSync(join(worktree, "target/debug/.fingerprint"))).toEqual([
    "seeded-app-0123456789abcdef",
  ]);

  const { main: other, worktree: bare } = checkouts();
  write(other, BUILD);
  const partial = (_from: string, to: string) => {
    write(to, { half: "" });
    return false;
  };
  expect(seedTarget(other, bare, partial)).toBe(
    "target/ not seeded: this filesystem cannot clone files",
  );
  expect(readdirSync(bare).filter((name) => name.startsWith("target"))).toEqual([]);

  const failing = (_from: string, to: string): boolean => {
    write(to, { half: "" });
    throw new Error("no space left");
  };
  expect(seedTarget(other, bare, failing)).toBe("target/ not seeded: no space left");
  expect(readdirSync(bare).filter((name) => name.startsWith("target"))).toEqual([]);
});

test("a seed killed midway leaves a folder git ignores", () => {
  const seeding = `target.seeding-${process.pid}/`;

  expect(git(ROOT, "check-ignore", seeding).trim()).toBe(seeding);
});

test("the script seeds a new worktree with clones, and says so, or says why it could not", () => {
  const { main, worktree } = checkouts();
  write(main, BUILD);

  const result = spawnSync(process.execPath, [SCRIPT, worktree], { encoding: "utf8" });

  expect(result.status).toBe(0);
  const seeded = existsSync(join(worktree, "target"));
  expect(result.stderr).toBe(
    seeded
      ? "worktree-seed: target/ seeded from the main checkout's\n"
      : "worktree-seed: target/ not seeded: this filesystem cannot clone files\n",
  );
  if (seeded) {
    expect(readdirSync(join(worktree, "target/debug/.fingerprint"))).toHaveLength(2);
  }
});

test("a worktree's task cache starts from the main checkout's, writes in progress included", () => {
  const { main, worktree } = checkouts();
  write(main, { "node_modules/.vite/task-cache/v1/run.tar.zst": "archive" });
  write(worktree, { "node_modules/.modules.yaml": "" });
  // Left open, so its write stays in the journal, as while a run of the main checkout records it.
  const database = new DatabaseSync(join(main, "node_modules/.vite/task-cache/v1/cache.db"));
  database.exec(
    "PRAGMA journal_mode = WAL; CREATE TABLE runs (task); INSERT INTO runs VALUES ('lint')",
  );

  expect(seedTaskCache(main, worktree)).toBe("Vite Task's cache seeded from the main checkout's");
  database.close();

  const cache = join(worktree, "node_modules/.vite/task-cache/v1");
  expect(readdirSync(cache).sort()).toEqual(["cache.db", "run.tar.zst"]);
  const seeded = new DatabaseSync(join(cache, "cache.db"), { readOnly: true });
  expect(seeded.prepare("SELECT task FROM runs").all()).toEqual([{ task: "lint" }]);
  seeded.close();
});

test("a worktree's task cache waits for its dependencies, and is never replaced", () => {
  const { main, worktree } = checkouts();
  write(main, { "node_modules/.vite/task-cache/v1/run.tar.zst": "archive" });

  expect(seedTaskCache(main, worktree)).toBeNull();
  expect(existsSync(join(worktree, "node_modules"))).toBe(false);

  write(worktree, { "node_modules/.modules.yaml": "", "node_modules/.vite/task-cache/v1/own": "" });
  expect(seedTaskCache(main, worktree)).toBeNull();
  expect(readdirSync(join(worktree, "node_modules/.vite/task-cache/v1"))).toEqual(["own"]);
});
