// @vitest-environment node
// The sandbox's state: `.sandbox/` built once, kept across starts until a reset, never half built,
// and the only folders a run writes: the human's own data and config folders stay as they were.
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join, relative } from "node:path";
import { addRepository, readFile, readRepositories, saveAnswer } from "uraeda-binding";
import {
  fixtureRepo,
  git,
  initRepository,
  STORY_FEATURE,
  temporaryFolder,
} from "uraeda-binding/test-utils";
import { beforeAll, expect, onTestFinished, test } from "vite-plus/test";
import { fakeGh, SAMPLE_FOLDERS, samplePullRequests } from "../../samples/index.ts";
import { type Builders, type Sandbox, sandboxEnv, seed, STALE_WARNING } from "../seed.ts";
import { fateAt, first, type RepositoryRows, serveSandbox, setEnv, waitAtWork } from "./helpers.ts";

/** The round waiting in "sample", and its file. */
const ROUND = SAMPLE_FOLDERS.features["round-waiting"];
const ROUND_FILE = "clarifications-01.md";

/** The answer of the round's Q2, as the core reads it, or undefined while it waits. */
async function answer(sample: string): Promise<string | undefined> {
  const file = await readFile(sample, ROUND, ROUND_FILE);
  const questions = file.current.items.clarifications?.questions ?? [];
  return questions.find((question) => question.id === "Q2")?.answer || undefined;
}

/** Answers the round's Q2 with A, as the round page does, which commits it. */
async function answerQ2(sample: string) {
  await saveAnswer(sample, ROUND, "Q2", ["A"], "", "");
}

/** The folders beside `.sandbox/` that a seed builds in or moves aside. */
const leftovers = (root: string) =>
  readdirSync(root).filter((name) => name.startsWith(".sandbox") && name !== ".sandbox");

/**
 * Builders as quick as can be, for the seed's own steps: three empty repositories, and no session.
 * `fail` throws in the step it names, after that step wrote part of its work.
 */
function quickBuilders(fail?: "projects" | "sessions"): Builders {
  return {
    projects: (dir) => {
      const paths = {
        broken: join(dir, "broken"),
        empty: join(dir, "empty"),
        sample: join(dir, "sample"),
      };
      for (const path of Object.values(paths)) {
        initRepository(path);
        git(path, "commit", "--quiet", "--allow-empty", "--message", "chore: start");
        if (fail === "projects") {
          throw new Error("interrupted while building the projects");
        }
      }
      return paths;
    },
    sessions: async (dataDir) => {
      writeFileSync(join(dataDir, "runner.sqlite"), "");
      if (fail === "sessions") {
        throw new Error("interrupted while seeding the sessions");
      }
    },
  };
}

/** Every file under `folder`, by its path from it, with a hash of its content. */
function snapshot(folder: string): Record<string, string> {
  const files: Record<string, string> = {};
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) {
        files[`${relative(folder, path)}/`] = "";
        walk(path);
      } else {
        files[relative(folder, path)] = createHash("sha256")
          .update(readFileSync(path))
          .digest("hex");
      }
    }
  };
  walk(folder);
  return files;
}

// The real builders, once for the tests that read real sample projects.
let root: string;
let built: Sandbox;
beforeAll(async () => {
  fakeGh(samplePullRequests());
  root = temporaryFolder("sandbox-seed");
  built = await seed(root, { reset: false });
}, 120_000);

test("the sample's worktrees work at their place after the rename", () => {
  const worktree = join(built.projects.sample, ".worktrees", STORY_FEATURE);

  expect(built.projects.sample).toBe(join(root, ".sandbox", "projects", "sample"));
  expect(git(worktree, "status", "--porcelain")).toBe("");
  expect(git(worktree, "rev-parse", "--abbrev-ref", "HEAD").trim()).toBe(STORY_FEATURE);
  expect(git(built.projects.sample, "worktree", "list", "--porcelain")).toContain(
    `worktree ${worktree}\n`,
  );
  expect(leftovers(root)).toEqual([]);
});

test("the sandbox lists its three projects, in its own data folder", async () => {
  const rows = await readRepositories(built.dataDir);

  expect(rows.map((row) => row.path).sort()).toEqual(
    [built.projects.broken, built.projects.empty, built.projects.sample].sort(),
  );
  expect(built.dataDir).toBe(join(root, ".sandbox", "data"));
  expect(readdirSync(built.configDir)).toEqual([]);
});

test("builders changed since the seed print the reset hint, and keep the state", async () => {
  const stamp = join(root, ".sandbox", "stamp");
  const current = readFileSync(stamp, "utf8");
  onTestFinished(() => writeFileSync(stamp, current));
  await answerQ2(built.projects.sample);
  writeFileSync(stamp, "built by older code");

  const first = await seed(root, { reset: false });
  const second = await seed(root, { reset: false });

  expect(STALE_WARNING).toBe(
    "The sample projects were built by older code: run with --reset to rebuild them.",
  );
  expect(first.stale).toBe(true);
  expect(second.stale).toBe(true);
  expect(await answer(built.projects.sample)).toBe("A");
});

test("a second seed keeps the state, and a reset rebuilds it", async () => {
  if ((await answer(built.projects.sample)) === undefined) {
    await answerQ2(built.projects.sample);
  }

  const again = await seed(root, { reset: false });
  expect(again).toEqual({ ...built, stale: false });
  expect(await answer(built.projects.sample)).toBe("A");

  const reset = await seed(root, { reset: true });
  expect(reset).toEqual({ ...built, stale: false });
  expect(await answer(built.projects.sample)).toBeUndefined();
  expect(git(join(built.projects.sample, ".worktrees", STORY_FEATURE), "status")).toBeTruthy();
  expect(leftovers(root)).toEqual([]);
}, 60_000);

test("a seed interrupted midway leaves no half-built .sandbox", async () => {
  const at = temporaryFolder("sandbox-interrupted");

  for (const step of ["projects", "sessions"] as const) {
    await expect(seed(at, { reset: false }, quickBuilders(step))).rejects.toThrow("interrupted");
    expect(existsSync(join(at, ".sandbox")), step).toBe(false);
    expect(leftovers(at), step).toEqual([]);
  }
});

test("a .sandbox a killed seed left is built again, not trusted", async () => {
  const at = temporaryFolder("sandbox-killed");
  // A seed killed after renaming its folder into place, before its stamp: its process is gone.
  const killed = Number(execFileSync("sh", ["-c", "echo $$"], { encoding: "utf8" }));
  mkdirSync(join(at, ".sandbox", "projects"), { recursive: true });
  writeFileSync(join(at, ".sandbox", "building"), String(killed));
  // And the temporary folder of another killed seed.
  mkdirSync(join(at, `.sandbox-build-${killed}-abc123`, "projects"), { recursive: true });

  const sandbox = await seed(at, { reset: false }, quickBuilders());

  expect(sandbox.stale).toBe(false);
  expect(git(sandbox.projects.sample, "log", "--format=%s")).toBe("chore: start\n");
  expect(existsSync(join(at, ".sandbox", "building"))).toBe(false);
  expect(leftovers(at)).toEqual([]);
});

test("two seeds at once build one .sandbox, which both use", async () => {
  const at = temporaryFolder("sandbox-twice");

  const [first, second] = await Promise.all([
    seed(at, { reset: false }, quickBuilders()),
    seed(at, { reset: false }, quickBuilders()),
  ]);

  expect(second).toEqual(first);
  expect(existsSync(join(at, ".sandbox", "stamp"))).toBe(true);
  expect(leftovers(at)).toEqual([]);
  expect((await readRepositories(first.dataDir)).length).toBe(3);
});

test("a .sandbox deleted by hand is built again at the next start", async () => {
  const at = temporaryFolder("sandbox-deleted");
  const before = await seed(at, { reset: false }, quickBuilders());
  rmSync(join(at, ".sandbox"), { force: true, recursive: true });

  const after = await seed(at, { reset: false }, quickBuilders());

  expect(after).toEqual(before);
  expect((await readRepositories(after.dataDir)).length).toBe(3);
});

test("the real data and config folders are untouched by a run", async () => {
  // The human's folders: named by the checkout's `.env` and the shell, and the core's defaults
  // under their home folder, each with files of its own.
  const real = temporaryFolder("real");
  const folders = {
    config: join(real, "config"),
    data: join(real, "data"),
    home: join(real, "home"),
    repo: fixtureRepo("repo", join(real, "repo")),
  };
  mkdirSync(folders.config, { recursive: true });
  writeFileSync(join(folders.config, "settings.toml"), "port = 4310\n");
  await addRepository(folders.data, folders.repo);
  for (const folder of [".config/uraeda", ".local/share/uraeda"]) {
    mkdirSync(join(folders.home, folder), { recursive: true });
    writeFileSync(join(folders.home, folder, "kept"), "the human's\n");
  }
  const checkout = temporaryFolder("checkout");
  const named = `URAEDA_DATA_DIR=${folders.data}\nURAEDA_CONFIG_DIR=${folders.config}\nURAEDA_REPO=${folders.repo}\n`;
  writeFileSync(join(checkout, ".env"), named);
  const restore = setEnv({
    HOME: folders.home,
    URAEDA_CONFIG_DIR: folders.config,
    URAEDA_DATA_DIR: folders.data,
    URAEDA_REPO: folders.repo,
    XDG_CONFIG_HOME: undefined,
    XDG_DATA_HOME: undefined,
  });
  onTestFinished(restore);
  const before = snapshot(real);

  const sandbox = await seed(checkout, { reset: false });
  onTestFinished(setEnv(sandboxEnv(sandbox)));
  const served = await serveSandbox(checkout);
  try {
    const { results } = await fateAt(served.url, null, [
      { ids: ["repositories"], kind: "byId", select: ["rows.name"], type: "Repositories" },
    ]);
    expect(
      first<RepositoryRows>(results[0])
        .rows.map((row) => row.name)
        .sort(),
    ).toEqual(["broken", "empty", "sample"]);
    const saved = await fateAt(served.url, "sample", [
      {
        input: { comment: "", folder: ROUND, letters: ["A"], previous: "", question: "Q2" },
        kind: "mutation",
        name: "answer.save",
        select: ["id"],
      },
    ]);
    expect(saved.results[0]?.ok).toBe(true);
    await waitAtWork(served);
  } finally {
    await served.close();
  }

  expect(snapshot(real)).toEqual(before);
  expect(await answer(sandbox.projects.sample)).toBe("A");
}, 180_000);
