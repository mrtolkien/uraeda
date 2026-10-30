/**
 * What the benchmark measures on: the sandbox's projects seeded into a temporary folder, a clone of
 * this checkout listed beside them, and the release build served by `main.ts`, as `vp run start`
 * serves it, signed in with the access key it prints.
 */
import { type ChildProcess, execFileSync, spawn } from "node:child_process";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Page } from "playwright";
import { addRepository } from "uraeda-binding";
import { freePort } from "uraeda-server/free-port";
import { fakeGh } from "../samples/index.ts";
import { sandboxEnv, seed } from "../sandbox/seed.ts";

/** A project the benchmark opens: its folder, and its pages' prefix, `/r/<name>`. */
export type Project = { folder: string; prefix: string };

/** The served sandbox: its address, its projects, and what stops it and removes its folders. */
export type Served = {
  key: string;
  projects: { realistic: Project; uraeda: Project };
  stop: () => void;
  url: string;
};

/** How long the server may take to print its address and key. */
const START_MS = 30_000;

/**
 * Builds the binding in release and the web UI, as `vp run start` does: the targets are a release
 * build's.
 */
export function buildRelease(root: string) {
  for (const args of [
    ["run", "--filter", "uraeda-binding", "build:release"],
    ["run", "--filter", "uraeda-web", "build"],
  ]) {
    execFileSync("vp", args, { cwd: root, stdio: "inherit" });
  }
}

/**
 * Puts first on this process's PATH a `gh` that lists no pull request, and a `claude` that fails:
 * the benchmark reaches neither GitHub nor an agent, and spends no one's tokens.
 */
function offline() {
  fakeGh([]);
  const bin = mkdtempSync(join(tmpdir(), "uraeda-claude-"));
  writeFileSync(join(bin, "claude"), "#!/bin/sh\nexit 1\n");
  chmodSync(join(bin, "claude"), 0o755);
  process.env.PATH = `${bin}:${process.env.PATH ?? ""}`;
}

/** Waits for the server's output to hold its address and its access key. */
function started(child: ChildProcess): Promise<{ key: string; url: string }> {
  return new Promise((resolve, reject) => {
    let output = "";
    const timer = setTimeout(
      () => reject(new Error(`The server did not start:\n${output}`)),
      START_MS,
    );
    const read = (chunk: Buffer) => {
      output += chunk.toString();
      const url = /Uraeda server on (\S+)/.exec(output)?.[1];
      const key = /Access key, shown once: (\S+)/.exec(output)?.[1];
      if (url !== undefined && key !== undefined) {
        clearTimeout(timer);
        resolve({ key, url });
      }
    };
    child.stdout?.on("data", read);
    child.stderr?.on("data", read);
    child.once("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`The server exited with ${code}:\n${output}`));
    });
  });
}

/**
 * Seeds the sandbox into a new temporary folder, clones `root` into it, lists the clone, and
 * serves them all with `main.ts` on a free port, the realistic project opened first.
 */
export async function serve(root: string): Promise<Served> {
  offline();
  const folder = mkdtempSync(join(tmpdir(), "uraeda-performance-"));
  const sandbox = await seed(folder, { reset: true });
  const clone = join(folder, "uraeda");
  execFileSync("git", ["clone", "--quiet", root, clone]);
  // The commits of the starts, and those made outside, need a name, which no global config gives.
  for (const repo of [clone, sandbox.projects.realistic]) {
    execFileSync("git", ["-C", repo, "config", "user.name", "Benchmark"]);
    execFileSync("git", ["-C", repo, "config", "user.email", "benchmark@example.com"]);
  }
  const { repository: listed } = await addRepository(sandbox.dataDir, clone);
  const port = await freePort();
  const env = { ...sandboxEnv(sandbox), URAEDA_REPO: sandbox.projects.realistic };
  const child = spawn(
    process.execPath,
    [join(root, "packages/server/src/main.ts"), "--no-open", "--port", String(port)],
    { cwd: sandbox.projects.realistic, env, stdio: ["ignore", "pipe", "pipe"] },
  );
  const stop = () => {
    child.kill("SIGTERM");
    rmSync(folder, { force: true, recursive: true });
  };
  try {
    const { key, url } = await started(child);
    return {
      key,
      projects: {
        realistic: { folder: sandbox.projects.realistic, prefix: "/r/realistic" },
        uraeda: { folder: clone, prefix: `/r/${encodeURIComponent(listed.name)}` },
      },
      stop,
      url: url.replace(/\/$/, ""),
    };
  } catch (error) {
    stop();
    throw error;
  }
}

/** Signs the page in with the access key, as a human does on the sign-in screen. */
export async function signIn(page: Page, key: string) {
  await page.goto("/");
  await page.getByLabel("Access key").fill(key);
  await page.keyboard.press("Enter");
  await page.getByLabel("Access key").waitFor({ state: "detached" });
}
