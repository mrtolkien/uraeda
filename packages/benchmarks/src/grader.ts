import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Case } from "./case.ts";
import { git } from "./git.ts";
import type { Scores } from "./record.ts";
import { run } from "./run-command.ts";

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
    return [...value.matchAll(/'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"/g)].map(
      (match) => match[1] ?? match[2] ?? "",
    );
  }
}

/** The tests the task requires: those that must pass after the change, and those that must still. */
export function requiredTests(config: Record<string, unknown>): Array<string> {
  return [...new Set([...listOf(config.fail_to_pass), ...listOf(config.pass_to_pass)])];
}

/**
 * Runs the task's hidden tests on the final diff, in a fresh container of the case's image. The
 * diff is the branch against `base`, without the `specs/` folder. The verifier is fetched here, after
 * the flow ended, into a folder of its own that no session ever had mounted or as its working
 * directory.
 */
export async function gradeTests(options: {
  base: string;
  case: Case;
  /** Runs a command: `docker`, in the real grader. */
  docker?: (args: Array<string>) => Promise<string>;
  fetchTests: (task: string, folder: string) => Promise<void>;
  repo: string;
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
    const diff = await git(options.repo, [
      "diff",
      "--binary",
      options.base,
      "HEAD",
      "--",
      ".",
      ":(exclude)specs",
    ]);
    if (diff.trim() === "") {
      return { passed: 0, resolved: false, total: required.length };
    }
    writeFileSync(join(work, "model.patch"), diff);
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
