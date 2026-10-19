import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Case } from "./case.ts";
import { git } from "./git.ts";
import type { Scores } from "./record.ts";
import { run } from "./run-command.ts";

/** A Python string literal's text, with the escapes `repr` writes: `\\`, quotes, and line breaks. */
function unescape(text: string): string {
  return text.replaceAll(/\\(.)/g, (_, char: string) =>
    char === "n" ? "\n" : char === "t" ? "\t" : char,
  );
}

/** Parses a list the verifier's config stores as JSON, or as a Python literal of strings. */
function listOf(value: unknown): Array<string> {
  if (Array.isArray(value)) {
    return value.map(String);
  }
  if (typeof value !== "string") {
    return [];
  }
  try {
    return (JSON.parse(value) as Array<unknown>).map(String);
  } catch {
    return [...value.matchAll(/'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"/g)].map((match) =>
      unescape(match[1] ?? match[2] ?? ""),
    );
  }
}

/** The tests the task requires: those that must pass after the change, and those that must still. */
export function requiredTests(config: Record<string, unknown>): Array<string> {
  return [...new Set([...listOf(config.fail_to_pass), ...listOf(config.pass_to_pass)])];
}

type Docker = (args: Array<string>) => Promise<string>;
type FetchTests = (task: string, folder: string) => Promise<void>;

/**
 * Runs the task's verifier on `patch` in a fresh container of the case's image. The verifier is
 * fetched here, after any flow ended, into a folder of its own that no session ever had mounted or
 * as its working directory. An empty patch changes nothing, so no container starts.
 */
export async function runVerifier(options: {
  case: Case;
  docker?: Docker;
  fetchTests: FetchTests;
  patch: string;
}): Promise<Scores["tests"]> {
  const docker = options.docker ?? ((args) => run("docker", args));
  const work = mkdtempSync(join(tmpdir(), "benchmarks-grade-"));
  try {
    const hidden = join(work, "tests");
    await options.fetchTests(options.case.task, hidden);
    const config = JSON.parse(readFileSync(join(hidden, "config.json"), "utf8")) as Record<
      string,
      unknown
    >;
    const required = requiredTests(config);
    if (options.patch.trim() === "") {
      return { passed: 0, resolved: false, total: required.length };
    }
    writeFileSync(join(work, "model.patch"), options.patch);
    const logs = join(work, "logs");
    mkdirSync(logs);
    await docker([
      "run",
      "--rm",
      "--entrypoint",
      "bash",
      "-v",
      `${join(work, "model.patch")}:/work/model.patch:ro`,
      "-v",
      `${hidden}:/tests:ro`,
      "-v",
      `${logs}:/logs/verifier`,
      options.case.image,
      "-c",
      `cd ${options.case.repository} && git apply --whitespace=nowarn /work/model.patch && bash /tests/test.sh`,
    ]).catch(() => "");
    return readResults(logs, required);
  } finally {
    rmSync(work, { force: true, recursive: true });
  }
}

/** The branch's diff against `base`, without the `specs/` folder: what the verifier grades. */
export function finalDiff(repo: string, base: string): Promise<string> {
  return git(repo, [
    "diff",
    "--binary",
    "--no-ext-diff",
    "--no-textconv",
    "--no-color",
    base,
    "HEAD",
    "--",
    ".",
    ":(exclude)specs",
  ]);
}

/** Runs the task's hidden tests on the branch's final diff. */
export async function gradeTests(options: {
  base: string;
  case: Case;
  docker?: Docker;
  fetchTests: FetchTests;
  repo: string;
}): Promise<Scores["tests"]> {
  const { base, repo, ...rest } = options;
  return runVerifier({ ...rest, patch: await finalDiff(repo, base) });
}

/** The tests that passed, from the verifier's `output.json`; none when it wrote none. */
function readResults(logs: string, required: Array<string>): Scores["tests"] {
  let passed = new Set<string>();
  try {
    const output = JSON.parse(readFileSync(join(logs, "output.json"), "utf8")) as {
      tests?: Array<{ name: string; status: string }>;
    };
    passed = new Set(
      (output.tests ?? []).filter((test) => test.status === "PASSED").map((test) => test.name),
    );
  } catch {
    // The patch did not apply, or the tests did not run: nothing passed.
  }
  const count = required.filter((name) => passed.has(name)).length;
  return {
    passed: count,
    resolved: required.length > 0 && count === required.length,
    total: required.length,
  };
}
