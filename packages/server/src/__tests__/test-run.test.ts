// The test tasks' runner, `scripts/test-run.ts`: each run in its own temporary folder, removed when
// it ends, and at most a few runs of a kind at once on the machine.
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vite-plus/test";
import { temporaryFolder } from "uraeda-binding/test-utils";
import { acquire, alive, sweep } from "../../../../scripts/test-run.ts";

const SCRIPT = fileURLToPath(new URL("../../../../scripts/test-run.ts", import.meta.url));

/** The pid of a process that ended. */
function endedPid(): number {
  return spawnSync("true").pid!;
}

/** Runs the script on a command, in `parent` as the temporary folder; its output and exit code. */
function run(parent: string, ...command: Array<string>) {
  const result = spawnSync(process.execPath, [SCRIPT, ...command], {
    encoding: "utf8",
    env: { ...process.env, TMPDIR: parent },
  });
  return { code: result.status, stdout: result.stdout.trim() };
}

test.each([
  ["passes", "0"],
  ["fails", "3"],
])("a command that %s runs in a new folder, removed after it", (_name, code) => {
  const parent = temporaryFolder("uraeda-parent");
  const script = `require("fs").writeFileSync(require("os").tmpdir() + "/left", ""); console.log(require("os").tmpdir()); process.exit(${code})`;

  const { code: exited, stdout } = run(parent, process.execPath, "-e", script);

  expect(exited).toBe(Number(code));
  expect(stdout.startsWith(join(parent, "uraeda-run-"))).toBe(true);
  expect(readdirSync(parent)).toEqual([]);
});

test("a run folder whose script ended is removed, another run's is kept", () => {
  const parent = temporaryFolder("uraeda-parent");
  const ended = `uraeda-run-${endedPid()}-abc123`;
  const running = `uraeda-run-${process.pid}-abc123`;
  for (const name of [ended, running, "uraeda-repo-abc123"]) {
    mkdirSync(join(parent, name));
  }

  expect(sweep(parent)).toEqual([ended]);
  expect(readdirSync(parent).sort()).toEqual([running, "uraeda-repo-abc123"].sort());
});

test("a run waits while every slot is held, and takes the one released", async () => {
  const dir = temporaryFolder("uraeda-locks");
  const held = join(dir, "browser-0.lock");
  // Held by a running process, this test's parent.
  writeFileSync(held, JSON.stringify({ cwd: "/elsewhere", pid: process.ppid }));
  let waits = 0;

  const release = await acquire(dir, "browser", 1, async () => {
    waits++;
    // The holder ends its run.
    writeFileSync(held, JSON.stringify({ cwd: "/elsewhere", pid: endedPid() }));
  });

  expect(waits).toBe(1);
  expect(existsSync(held)).toBe(true);
  release();
  expect(existsSync(held)).toBe(false);
});

test("a free slot is taken at once, next to a held one", async () => {
  const dir = temporaryFolder("uraeda-locks");
  writeFileSync(join(dir, "browser-0.lock"), JSON.stringify({ cwd: "/a", pid: process.ppid }));

  const release = await acquire(dir, "browser", 2, () => {
    throw new Error("waited with a slot free");
  });

  expect(readdirSync(dir).sort()).toEqual(["browser-0.lock", "browser-1.lock"]);
  release();
  expect(readdirSync(dir)).toEqual(["browser-0.lock"]);
});

test.each(["SIGTERM", "SIGKILL"] as const)(
  "cancelling a run with %s stops its launcher and runner before cleanup",
  async (signal) => {
    const parent = temporaryFolder("uraeda-parent");
    // Like `vp test`: the launcher's child owns the actual work and inherits its output.
    const runner = `console.log(JSON.stringify({ pid: process.pid, folder: require('os').tmpdir() })); setInterval(() => {}, 1000)`;
    const launcher = `require('child_process').spawn(process.execPath, ['-e', ${JSON.stringify(runner)}], { stdio: 'inherit' });`;
    const child = spawn(process.execPath, [SCRIPT, process.execPath, "-e", launcher], {
      env: { ...process.env, TMPDIR: parent },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let pid: number | undefined;
    try {
      const [data] = await once(child.stdout!, "data");
      const started = JSON.parse(String(data).trim()) as { folder: string; pid: number };
      pid = started.pid;
      expect(alive(pid)).toBe(true);
      expect(existsSync(started.folder)).toBe(true);
      const exited = once(child, "exit");

      child.kill(signal);

      expect(await exited).toEqual(signal === "SIGTERM" ? [143, null] : [null, "SIGKILL"]);
      await expect.poll(() => alive(started.pid)).toBe(false);
      await expect.poll(() => readdirSync(parent)).toEqual([]);
    } finally {
      child.kill("SIGKILL");
      if (pid !== undefined && alive(pid)) {
        process.kill(pid, "SIGKILL");
      }
    }
  },
);
