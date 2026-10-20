// The sandbox's state, `.sandbox/` at the checkout's root, git-ignored: its sample projects, its
// data folder, with their list and sessions, and its empty config folder. This module alone builds,
// stamps, and resets it; everything else reads the paths it returns. Nothing here computes the
// human's own data or config folder.
//
// A build writes into a temporary folder beside it, renamed into place, then repairs the
// projects' worktrees, lists the projects, and seeds the sessions, whose paths must be the final
// ones. Its stamp, the builders' version, is written last: a `.sandbox/` without one is still being
// built by the process its `building` file names, or was left by a seed killed midway, and is
// built again.
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join, relative } from "node:path";
import { addRepository } from "uraeda-binding";
import { git } from "uraeda-binding/test-utils";
import { buildProjects } from "../samples/index.ts";
import { seedSessions } from "./sessions.ts";

/** What a start prints when the stamp is not the builders' version. */
export const STALE_WARNING =
  "The sample projects were built by older code: run with --reset to rebuild them.";

/** "Today" in the sandbox, the day the sample projects' commits are dated. */
export const SANDBOX_TODAY = "2026-10-16";

/** The sample projects' folders, by the name the server lists each one by. */
export type Projects = { broken: string; empty: string; sample: string };

/** The sandbox's folders, and whether older builders built them. */
export type Sandbox = { configDir: string; dataDir: string; projects: Projects; stale: boolean };

/** What a seed builds with: the sample projects into a folder, and the sessions of "sample". */
export type Builders = {
  projects: (dir: string) => Projects;
  sessions: (dataDir: string, sample: string) => Promise<void>;
};

const BUILDERS: Builders = { projects: buildProjects, sessions: seedSessions };

/** The sandbox's folder, at the checkout's root. */
const FOLDER = ".sandbox";

/** A folder a seed builds in, or moves an old `.sandbox/` aside to, named after its process. */
const SCRATCH = /^\.sandbox-(?:build|old)-(\d+)-/;

/** The checkout this module is in, whose builders the stamp reads. */
const checkout = join(import.meta.dirname, "../../..");

/**
 * What the sample projects and sessions are built from: their builders, the fixtures and templates
 * they copy, and the test helpers they call. A change to any of them makes a seed stale.
 */
const SOURCES = [
  "packages/web/samples",
  "packages/web/sandbox/agent.ts",
  "packages/web/sandbox/sessions.ts",
  "packages/web/sandbox/seed.ts",
  "packages/binding/test-utils.ts",
  "fixtures/repo",
  "fixtures/broken",
  "fixtures/round-mockup",
  "fixtures/preview",
  "fixtures/spec-page",
  "skills/uraeda/assets/templates/specs",
];

/** Every file under `path`, a file or a folder, but tests. */
function files(path: string): Array<string> {
  if (!statSync(path).isDirectory()) {
    return [path];
  }
  return readdirSync(path)
    .filter((name) => name !== "__tests__")
    .sort()
    .flatMap((name) => files(join(path, name)));
}

/** The builders' version: a hash of their files' paths and contents. */
export function buildersVersion(): string {
  const hash = createHash("sha256");
  for (const file of SOURCES.flatMap((source) => files(join(checkout, source)))) {
    hash.update(relative(checkout, file)).update("\0").update(readFileSync(file)).update("\0");
  }
  return hash.digest("hex");
}

/** The sandbox's folders in `folder`. */
function paths(folder: string): Omit<Sandbox, "stale"> {
  const projects = join(folder, "projects");
  return {
    configDir: join(folder, "config"),
    dataDir: join(folder, "data"),
    projects: {
      broken: join(projects, "broken"),
      empty: join(projects, "empty"),
      sample: join(projects, "sample"),
    },
  };
}

/** Whether the process `pid` runs. */
function running(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // It runs, as another user's.
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

/** Reads a file, or undefined when there is none. */
function readIfAny(path: string): string | undefined {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return undefined;
  }
}

/** Removes the folders seeds whose process is gone left beside `.sandbox/`. */
function removeLeftovers(root: string) {
  for (const name of readdirSync(root)) {
    const pid = name.match(SCRATCH)?.[1];
    if (pid !== undefined && !running(Number(pid))) {
      rmSync(join(root, name), { force: true, recursive: true });
    }
  }
}

/** What a seed finds at `.sandbox/`: a whole one and its stamp, none, or one left unfinished. */
type Found = { stamp: string } | "none" | "unfinished";

/**
 * What is at `.sandbox/`, once another seed, still running, has completed it: a `.sandbox/` without
 * its stamp whose builder is gone was left by a seed killed midway.
 */
async function found(folder: string): Promise<Found> {
  for (;;) {
    const stamp = readIfAny(join(folder, "stamp"));
    if (stamp !== undefined) {
      return { stamp };
    }
    if (!existsSync(folder)) {
      return "none";
    }
    const builder = Number(readIfAny(join(folder, "building")));
    if (!builder || !running(builder)) {
      return "unfinished";
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

/**
 * Points each worktree of a project moved from `from` to `to` back at it, and it at them: git
 * records both sides' absolute paths.
 */
function repairWorktrees(project: string, from: string, to: string) {
  const moved = git(project, "worktree", "list", "--porcelain")
    .split("\n")
    .filter((line) => line.startsWith("worktree "))
    .map((line) => line.slice("worktree ".length))
    .filter((path) => path.startsWith(from + "/"))
    .map((path) => to + path.slice(from.length));
  if (moved.length > 0) {
    git(project, "worktree", "repair", ...moved);
  }
}

/**
 * Builds `.sandbox/` anew, replacing the one there when `replace` says so: in a temporary folder
 * beside it, renamed into place, then completed there. A failure removes what it built. When another seed renamed its own into
 * place first, this one uses that, once complete.
 */
async function build(root: string, version: string, builders: Builders, replace: boolean) {
  const folder = join(root, FOLDER);
  const temporary = mkdtempSync(join(root, `${FOLDER}-build-${process.pid}-`));
  try {
    writeFileSync(join(temporary, "building"), String(process.pid));
    const built = paths(temporary);
    builders.projects(join(temporary, "projects"));
    mkdirSync(built.dataDir);
    mkdirSync(built.configDir);
  } catch (error) {
    rmSync(temporary, { force: true, recursive: true });
    throw error;
  }
  // The folder replaced goes aside first: a rename never replaces a folder that holds files. Any
  // other is another seed's, renamed into place meanwhile.
  let old: string | undefined;
  if (replace && existsSync(folder)) {
    old = mkdtempSync(join(root, `${FOLDER}-old-${process.pid}-`));
    renameSync(folder, join(old, FOLDER));
  }
  try {
    renameSync(temporary, folder);
  } catch {
    // Another seed's folder is in place: it is the sandbox.
    rmSync(temporary, { force: true, recursive: true });
    if (old !== undefined) {
      rmSync(old, { force: true, recursive: true });
    }
    if (typeof (await found(folder)) === "string") {
      throw new Error(`Another seed left ${folder} unfinished: run the sandbox again.`);
    }
    return;
  }
  if (old !== undefined) {
    rmSync(old, { force: true, recursive: true });
  }
  try {
    const { dataDir, projects } = paths(folder);
    for (const project of Object.values(projects)) {
      repairWorktrees(project, join(temporary, "projects"), join(folder, "projects"));
    }
    // "sample" last, the most recently opened.
    for (const project of [projects.broken, projects.empty, projects.sample]) {
      await addRepository(dataDir, project);
    }
    await builders.sessions(dataDir, projects.sample);
    writeFileSync(join(folder, "stamp.new"), version);
    renameSync(join(folder, "stamp.new"), join(folder, "stamp"));
    rmSync(join(folder, "building"));
  } catch (error) {
    rmSync(folder, { force: true, recursive: true });
    throw error;
  }
}

/**
 * The sandbox at `root`'s `.sandbox/`: kept as it is, with `stale` when older builders built it,
 * or built when there is none, a seed left it unfinished, or `reset` asks for it.
 */
export async function seed(
  root: string,
  { reset }: { reset: boolean },
  builders: Builders = BUILDERS,
): Promise<Sandbox> {
  const folder = join(root, FOLDER);
  removeLeftovers(root);
  const version = buildersVersion();
  const at = await found(folder);
  if (typeof at === "object" && !reset) {
    return { ...paths(folder), stale: at.stamp !== version };
  }
  // Decided from what was found: a folder another seed renames into place meanwhile is kept.
  await build(root, version, builders, at !== "none");
  return { ...paths(folder), stale: false };
}

/**
 * The environment the sandbox's server runs in, from `environment`: its sample project opened
 * first, its own data and config folders, and "today" fixed. The variables of a human's server
 * that it does not use are left out, so none reaches it.
 */
export function sandboxEnv(
  { configDir, dataDir, projects }: Sandbox,
  environment: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  const { URAEDA_ALLOWED_HOSTS: _hosts, URAEDA_PORT: _port, ...kept } = environment;
  return {
    ...kept,
    URA_TODAY: SANDBOX_TODAY,
    URAEDA_CONFIG_DIR: configDir,
    URAEDA_DATA_DIR: dataDir,
    URAEDA_REPO: projects.sample,
  };
}
