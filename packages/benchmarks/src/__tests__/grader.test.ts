import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { FakeAdapter } from "uraeda-server/runner/fake";
import { expect, test } from "vite-plus/test";
import type { Case } from "../case.ts";
import { countRounds } from "../count.ts";
import { gradeTests, requiredTests } from "../grader.ts";
import { git } from "../git.ts";
import { judgeRequirements, parseVerdicts } from "../judge.ts";
import { result } from "./loop-helpers.ts";
import { temporary, write } from "./samples.ts";

const CASE: Case = {
  id: "c",
  image: "image:tag",
  proposal: "/p.md",
  repository: "/app",
  source: "swe-bench-pro-v2",
  task: "instance_x",
  upstream: "https://github.com/a/b",
};
const CONFIG = JSON.stringify({
  fail_to_pass: "['t::new', 't::other']",
  pass_to_pass: ["t::old"],
});

/** A repository with a base commit, then a branch commit that changes code and the specs folder. */
async function repository(change: boolean) {
  const repo = temporary("benchmarks-grade-repo-");
  await git(repo, ["init", "-q", "-b", "main"]);
  await git(repo, ["config", "user.email", "t@example.com"]);
  await git(repo, ["config", "user.name", "t"]);
  // A user's diff tool must not change the patch the verifier applies.
  await git(repo, ["config", "diff.external", "echo EXTERNAL"]);
  write(join(repo, "app.py"), "a\n");
  await git(repo, ["add", "-A"]);
  await git(repo, ["commit", "-q", "-m", "base"]);
  const base = (await git(repo, ["rev-parse", "HEAD"])).trim();
  write(join(repo, "specs/f/spec.md"), "spec\n");
  if (change) {
    write(join(repo, "app.py"), "b\n");
  }
  await git(repo, ["add", "-A"]);
  await git(repo, ["commit", "-q", "-m", "work"]);
  return { base, repo };
}

/** What the grader did, with a fake docker that writes `passed` as the verifier's output. */
async function grade(change: boolean, passed: Array<string>) {
  const { base, repo } = await repository(change);
  const calls: Array<{ args: Array<string>; patch?: string; testsFolder?: string }> = [];
  const fetched: Array<string> = [];
  const tests = await gradeTests({
    base,
    case: CASE,
    docker: async (args) => {
      const mount = (suffix: string) =>
        args.find((arg) => arg.endsWith(suffix))?.split(":")[0] ?? "";
      const logs = mount(":/logs/verifier");
      writeFileSync(
        join(logs, "output.json"),
        JSON.stringify({ tests: passed.map((name) => ({ name, status: "PASSED" })) }),
      );
      calls.push({ args, patch: readFileSync(mount(":/work/model.patch:ro"), "utf8") });
      return "";
    },
    fetchTests: async (task, folder) => {
      fetched.push(folder);
      mkdirSync(folder, { recursive: true });
      writeFileSync(join(folder, "config.json"), CONFIG);
    },
    repo,
  });
  return { calls, fetched, repo, tests };
}

test("US4.1: applies the diff without specs/ to a fresh container", async () => {
  const { calls, tests } = await grade(true, ["t::new", "t::other", "t::old"]);

  expect(calls).toHaveLength(1);
  expect(calls[0]?.patch).toMatch(/^diff --git a\/app\.py b\/app\.py/);
  expect(calls[0]?.patch).not.toContain("specs/");
  expect(calls[0]?.args.slice(0, 3)).toEqual(["run", "--rm", "--entrypoint"]);
  expect(tests).toEqual({ passed: 3, resolved: true, total: 3 });
});

test("a test that does not pass keeps the task unresolved, counting the others", async () => {
  const { tests } = await grade(true, ["t::new", "t::old"]);

  expect(tests).toEqual({ passed: 2, resolved: false, total: 3 });
});

test("the hidden tests are fetched at grading, into a folder outside the repository", async () => {
  const { fetched, repo } = await grade(true, []);

  expect(fetched).toHaveLength(1);
  expect(fetched[0]?.startsWith(repo)).toBe(false);
});

test("a branch with no code change counts as failed, and starts no container", async () => {
  const { calls, tests } = await grade(false, ["t::new", "t::other", "t::old"]);

  expect(calls).toEqual([]);
  expect(tests).toEqual({ passed: 0, resolved: false, total: 3 });
});

test("a run whose tests print nothing passes nothing", async () => {
  const { tests } = await grade(true, []);

  expect(tests).toEqual({ passed: 0, resolved: false, total: 3 });
});

test("the required tests read as JSON lists or Python literals, once each", () => {
  expect(requiredTests({ fail_to_pass: "['a', 'b']", pass_to_pass: '["b", "c"]' })).toEqual([
    "a",
    "b",
    "c",
  ]);
});

const ANSWER = [
  "```json",
  JSON.stringify({
    items: [
      { line: "It accepts a list of fields", requirement: "accepts a list", verdict: "covered" },
      { line: "", requirement: "keeps order", verdict: "partial" },
      { requirement: "raises on empty", verdict: "missing" },
    ],
  }),
  "```",
].join("\n");

test("US4.2: scores each requirement covered, partial, or missing, with the line", () => {
  const scores = parseVerdicts(ANSWER);

  expect(scores).toMatchObject({ covered: 1, total: 3 });
  expect(scores.items[0]).toEqual({
    line: "It accepts a list of fields",
    requirement: "accepts a list",
    verdict: "covered",
  });
  expect(scores.items.map((item) => item.verdict)).toEqual(["covered", "partial", "missing"]);
});

test("a verdict that is none of the three is refused", () => {
  expect(() =>
    parseVerdicts('```json\n{"items":[{"requirement":"x","verdict":"maybe"}]}\n```'),
  ).toThrow("not readable");
});

test("the judge reads the proposal and the spec in its message, in an empty folder", async () => {
  const adapter = new FakeAdapter();
  adapter.script([{ text: ANSWER, type: "text" }, result()]);

  const { requirements } = await judgeRequirements({
    adapter,
    proposal: "# P\n\n## Requirements\n\n- accepts a list\n",
    spec: "# Spec\n\nIt accepts a list of fields\n",
  });

  expect(adapter.sent[0]?.text).toContain("- accepts a list");
  expect(adapter.sent[0]?.text).toContain("It accepts a list of fields");
  expect(requirements.covered).toBe(1);
});

test("the rounds, questions, and revisions come from the specs and the steps", () => {
  const specs = temporary();
  write(join(specs, "clarifications-01.md"), "## Q1: a\n\n## Q2: b\n");
  write(join(specs, "clarifications-02.md"), "## Q1: c\n");
  const steps = [
    { gate: "changes requested", role: "human" },
    { gate: "approved", role: "human" },
  ];

  expect(countRounds(specs, steps as never)).toEqual({ questions: 3, revisions: 1, rounds: 2 });
});
