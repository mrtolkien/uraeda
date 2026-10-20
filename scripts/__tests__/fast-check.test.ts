import { spawn } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "vite-plus/test";
import { checkStages, concurrently } from "../fast-check.ts";
import { selectFast } from "../fast-selection.ts";
import { execFileSync } from "node:child_process";

const SCRIPT = join(import.meta.dirname, "../fast-check.ts");
const folders: Array<string> = [];
afterEach(() =>
  folders.splice(0).forEach((path) => rmSync(path, { force: true, recursive: true })),
);

/**
 * A repository with one uncommitted change, a `vp` that only records its arguments, and both heavy
 * slots held by this live process.
 */
function checkout(changed: string) {
  const root = mkdtempSync(join(tmpdir(), "fast-check-"));
  folders.push(root);
  const git = (...args: Array<string>) => execFileSync("git", args, { cwd: root });
  git("init", "-q");
  writeFileSync(join(root, ".gitignore"), ".bin/\n.cache/\n.vp-calls\n");
  git("add", ".gitignore");
  git("-c", "user.email=t@example.com", "-c", "user.name=T", "commit", "-q", "-m", "x");
  writeFileSync(join(root, changed), "changed");
  const bin = join(root, ".bin");
  mkdirSync(bin);
  writeFileSync(join(bin, "vp"), `#!/bin/sh\necho "$@" >> "${join(root, ".vp-calls")}"\n`);
  chmodSync(join(bin, "vp"), 0o755);
  const locks = join(root, ".cache", "uraeda", "locks");
  mkdirSync(locks, { recursive: true });
  for (const slot of [0, 1]) {
    writeFileSync(
      join(locks, `heavy-${slot}.lock`),
      JSON.stringify({ cwd: "other", pid: process.pid }),
    );
  }
  return { bin, root };
}

/** Runs fast-check for at most `ms`, then stops it; resolves with its output and exit code. */
function fastCheck(root: string, bin: string, ms: number) {
  return new Promise<{ code: number | null; output: string }>((resolve) => {
    const child = spawn(process.execPath, [SCRIPT], {
      cwd: root,
      env: {
        ...process.env,
        PATH: `${bin}:${process.env.PATH}`,
        XDG_CACHE_HOME: join(root, ".cache"),
      },
    });
    let output = "";
    child.stdout.on("data", (data) => (output += data));
    child.stderr.on("data", (data) => (output += data));
    const timer = setTimeout(() => child.kill("SIGKILL"), ms);
    child.once("exit", (code) => {
      clearTimeout(timer);
      resolve({ code, output });
    });
  });
}

const calls = (root: string) =>
  existsSync(join(root, ".vp-calls")) ? readFileSync(join(root, ".vp-calls"), "utf8") : "";

test("an escalation to ready runs it without holding a heavy slot", async () => {
  const { bin, root } = checkout("runtime.bin");
  const { code, output } = await fastCheck(root, bin, 30_000);
  expect(code, output).toBe(0);
  expect(calls(root)).toBe("run ready\n");
});

test("fast's own checks wait for a heavy slot", async () => {
  const { bin, root } = checkout("notes.md");
  const { output } = await fastCheck(root, bin, 8000);
  expect(output).toContain("Waiting for 2 other runs of the heavy tests");
  expect(calls(root)).toBe("");
}, 20_000);

test("the type check never runs while the binding's generated files are rebuilt", () => {
  const stages = checkStages(
    selectFast([{ added: false, deleted: false, path: "crates/binding/src/lib.rs" }]),
  );
  for (const stage of stages) {
    const commands = stage.flat().map(([command, args]) => [command, ...args].join(" "));
    expect(
      commands.includes("vp run binding:touch") && commands.includes("vp check"),
      JSON.stringify(stage),
    ).toBe(false);
  }
  expect(
    stages
      .flat()
      .flat()
      .map(([, args]) => args.join(" ")),
  ).toEqual(expect.arrayContaining(["run binding:touch", "check"]));
});

test("when both chains fail, both failures are reported", async () => {
  const failure = await concurrently([
    [["sh", ["-c", "exit 3"]]],
    [["sh", ["-c", "exit 4"]]],
  ]).catch((error: unknown) => error);
  expect(failure).toBeInstanceOf(AggregateError);
  expect((failure as AggregateError).errors.map(String)).toEqual([
    expect.stringContaining("exit 3"),
    expect.stringContaining("exit 4"),
  ]);
});
