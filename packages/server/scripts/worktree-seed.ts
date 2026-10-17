/**
 * `node packages/server/scripts/worktree-seed.ts <worktree>`: seeds a linked worktree's Rust build
 * and Vite Task cache from the main checkout's, run by the dev shell of `flake.nix` while a
 * worktree lacks one.
 *
 * A new worktree started with neither: its first build compiled every dependency again, and its
 * first `vp run ready` reran every check, for about 14 GB of `target/` each. Each is copied as a
 * clone, whose files share the main checkout's blocks until one side rewrites them.
 *
 * Cargo cannot share one `target/` between checkouts: it judges a crate fresh by its files' times,
 * so a checkout whose files are older than another's last build ran that build's code. The copy
 * forgets the workspace's own crates, which the worktree builds again, and keeps the dependencies,
 * which do not depend on the checkout. Without clones, as on ext4, it copies nothing: a full copy
 * would cost the storage it saves. The task cache is keyed by its inputs' contents, so the main
 * checkout's entries hold in any checkout with the same files; it is small, so copied either way.
 */
import { spawnSync } from "node:child_process";
import {
  constants,
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  rmSync,
} from "node:fs";
import { dirname, join, relative } from "node:path";
import { DatabaseSync } from "node:sqlite";

/** Where Vite Task keeps its cache, from a checkout's root. */
const TASK_CACHE = "node_modules/.vite/task-cache";

/** The folders of `target/` that hold no `.fingerprint` folder, skipped while looking for them. */
const ARTIFACTS = new Set(["build", "deps", "examples", "incremental"]);

/** The main checkout of the repository `root` is in; null when `root` is the main checkout. */
export function mainCheckout(root: string): string | null {
  const result = spawnSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], {
    cwd: root,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    return null;
  }
  const main = dirname(result.stdout.trim());
  return relative(main, root) === "" ? null : main;
}

/** The names of the Cargo workspace's packages at `root`; null when cargo cannot read them. */
export function workspacePackages(root: string): Array<string> | null {
  const result = spawnSync(
    "cargo",
    ["metadata", "--no-deps", "--offline", "--format-version", "1"],
    { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  if (result.status !== 0) {
    return null;
  }
  const metadata = JSON.parse(result.stdout) as { packages: Array<{ name: string }> };
  return metadata.packages.map((pkg) => pkg.name);
}

/** Copies the folder `from` to `to` as a clone, keeping times and links; false without clones. */
export function cloneFolder(from: string, to: string): boolean {
  return spawnSync("cp", ["-a", "--reflink=always", from, to]).status === 0;
}

/**
 * Removes the fingerprints of `packages` from the build folder `target`, in every profile and
 * target triple: Cargo builds a unit without one again, and every unit depending on it.
 */
export function forgetPackages(target: string, packages: Array<string>) {
  // Package names hold only letters, digits, `-`, and `_`.
  const fingerprint = new RegExp(`^(${packages.join("|")})-[0-9a-f]{16}$`);
  const visit = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory() || ARTIFACTS.has(entry.name)) {
        continue;
      }
      const path = join(dir, entry.name);
      if (entry.name !== ".fingerprint") {
        visit(path);
        continue;
      }
      for (const unit of readdirSync(path)) {
        if (fingerprint.test(unit)) {
          rmSync(join(path, unit), { force: true, recursive: true });
        }
      }
    }
  };
  visit(target);
}

/**
 * Moves the folder `from`, filled whole, to `to`; drops it when `to` exists, as when another shell
 * seeded the worktree meanwhile.
 */
function publish(from: string, to: string) {
  try {
    renameSync(from, to);
  } catch {
    rmSync(from, { force: true, recursive: true });
  }
}

/** Seeds `root/target` from `main/target`; what was done, or null when there was nothing to do. */
export function seedTarget(
  main: string,
  root: string,
  clone: (from: string, to: string) => boolean = cloneFolder,
): string | null {
  const from = join(main, "target");
  const to = join(root, "target");
  if (existsSync(to) || !existsSync(from)) {
    return null;
  }
  const packages = workspacePackages(root);
  if (packages === null) {
    return "target/ not seeded: cargo could not read the workspace's packages";
  }
  const seeding = `${to}.seeding-${process.pid}`;
  if (!clone(from, seeding)) {
    rmSync(seeding, { force: true, recursive: true });
    return "target/ not seeded: this filesystem cannot clone files";
  }
  forgetPackages(seeding, packages);
  publish(seeding, to);
  return "target/ seeded from the main checkout's";
}

/** The files under `dir`, as paths from it. */
function files(dir: string): Array<string> {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(dir, join(entry.parentPath, entry.name)));
}

/**
 * Seeds the worktree's Vite Task cache from the main checkout's, once its dependencies are
 * installed; what was done, or null when there was nothing to do. Its databases are read through
 * SQLite, so a write in progress in the main checkout does not tear them, and before the archives
 * they list, so each one they list is copied.
 */
export function seedTaskCache(main: string, root: string): string | null {
  const from = join(main, TASK_CACHE);
  const to = join(root, TASK_CACHE);
  if (
    existsSync(to) ||
    !existsSync(from) ||
    !existsSync(join(root, "node_modules/.modules.yaml"))
  ) {
    return null;
  }
  const seeding = `${to}.seeding-${process.pid}`;
  try {
    const all = files(from);
    const databases = all.filter((path) => path.endsWith(".db"));
    const journals = new Set(databases.flatMap((path) => [`${path}-wal`, `${path}-shm`]));
    for (const path of databases) {
      mkdirSync(dirname(join(seeding, path)), { recursive: true });
      const database = new DatabaseSync(join(from, path), { readOnly: true });
      database.prepare("VACUUM INTO ?").run(join(seeding, path));
      database.close();
    }
    for (const path of all.filter((path) => !path.endsWith(".db") && !journals.has(path))) {
      mkdirSync(dirname(join(seeding, path)), { recursive: true });
      copyFileSync(join(from, path), join(seeding, path), constants.COPYFILE_FICLONE);
    }
  } catch (error) {
    // An archive removed by a run of the main checkout meanwhile: the next shell tries again.
    rmSync(seeding, { force: true, recursive: true });
    return `Vite Task's cache not seeded: ${(error as Error).message}`;
  }
  publish(seeding, to);
  return "Vite Task's cache seeded from the main checkout's";
}

if (import.meta.main) {
  const root = process.argv[2] ?? process.cwd();
  const main = mainCheckout(root);
  if (main !== null) {
    for (const done of [seedTarget(main, root), seedTaskCache(main, root)]) {
      if (done !== null) {
        process.stderr.write(`worktree-seed: ${done}\n`);
      }
    }
  }
}
