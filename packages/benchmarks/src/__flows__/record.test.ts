import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { parseRecord, parseScores, type RunRecord } from "../record.ts";
import { listRuns, runFolderPath, writeRun } from "../recorder.ts";
import { repository, sh, temporary, write } from "./harness.ts";

const OPTIONAL = ["flags", "reason"];

/** A record with every field a run holds, and a value for each. */
const record = (): RunRecord => ({
  "approved-by": "owner",
  blocked: [{ rule: "Bash(ls)", target: "ls", tool: "Bash" }],
  effort: "medium",
  ended: "2026-10-19T12:00:00Z",
  harness: { name: "claude", version: "2.1.303" },
  human: { guidelines: "a".repeat(40), model: "claude-sonnet-5-5" },
  models: { answered: ["claude-sonnet-5-5"], asked: "claude-sonnet-5-5" },
  outcome: "finished",
  repository: { commit: "a".repeat(40), dirty: false },
  skill: { commit: "b".repeat(40), dirty: true },
  started: "2026-10-19T10:00:00Z",
  steps: [
    {
      cost: { amount: 0.5, kind: "reported" },
      gate: "answered",
      role: "human",
      seconds: 3,
      step: "discovery",
      tokens: { cacheRead: 1, cacheWrite: 2, input: 3, output: 4 },
    },
  ],
  task: { id: "instance_x", image: "ghcr.io/x@sha256:1", source: "swe-bench-pro-v2" },
  transcripts: [],
  urls: ["https://example.com/"],
  version: 1,
});

test.each(Object.keys(record()).filter((field) => !OPTIONAL.includes(field)))(
  "a record without %s is refused, naming it",
  (field) => {
    const { [field as keyof RunRecord]: _, ...without } = record();

    expect(() => parseRecord(without)).toThrow(field);
  },
);

test("a record whose nested fields are missing or wrong is refused, naming their path", () => {
  const noEffort = { ...record(), harness: { name: "claude" } };
  const badOutcome = { ...record(), outcome: "done" };
  const noCost = { ...record(), steps: [{ ...record().steps[0], cost: {} }] };

  expect(() => parseRecord(noEffort)).toThrow("harness.version");
  expect(() => parseRecord(badOutcome)).toThrow("outcome");
  expect(() => parseRecord(noCost)).toThrow("steps[0].cost");
  expect(parseRecord({ ...record(), flags: ["leak-suspected"], reason: "why" })).toBeDefined();
});

test("the scores hold the tests, and the plain arm's hold nothing else", () => {
  expect(parseScores({ tests: { passed: 1, resolved: false, total: 2 } })).toBeDefined();
  expect(() => parseScores({ rounds: 1 })).toThrow("tests");
});

test("an invalid record is refused before anything is written", () => {
  const folder = join(temporary(), "run");
  const { urls: _, ...without } = record();

  expect(() =>
    writeRun(folder, {
      diff: "",
      record: without as never,
      scores: { tests: { passed: 0, resolved: false, total: 0 } },
    }),
  ).toThrow("urls");
  expect(() => readFileSync(join(folder, "record.json"))).toThrow();
});

test("git keeps a run's record, scores, specs, and diff, and not its transcripts, whose hash the record holds", () => {
  const repo = repository();
  mkdirSync(join(repo, "benchmarks"));
  copyFileSync(
    join(import.meta.dirname, "../../../../benchmarks/.gitignore"),
    join(repo, "benchmarks/.gitignore"),
  );
  const folder = runFolderPath(join(repo, "benchmarks"), {
    arm: "uraeda",
    case: "c",
    date: "2026-10-19",
    n: 1,
    suite: "first",
  });
  write(join(folder, "transcripts/agent-1.jsonl"), '{"raw":"transcript"}\n');
  const specs = temporary();
  write(join(specs, "spec.md"), "# Spec\n");
  const { transcripts: _, ...fields } = record();

  writeRun(folder, {
    diff: "diff\n",
    record: fields,
    scores: { tests: { passed: 1, resolved: true, total: 1 } },
    specs,
  });
  sh(repo, "add", "-A");

  const tracked = sh(repo, "ls-files").split("\n");
  expect(tracked.some((file) => file.endsWith("record.json"))).toBe(true);
  expect(tracked.some((file) => file.endsWith("scores.json"))).toBe(true);
  expect(tracked.some((file) => file.endsWith("final.diff"))).toBe(true);
  expect(tracked.some((file) => file.endsWith("specs/spec.md"))).toBe(true);
  expect(tracked.some((file) => file.includes("transcripts"))).toBe(false);
  const [run] = listRuns(join(repo, "benchmarks"));
  expect(run?.record.transcripts).toEqual([
    {
      file: "agent-1.jsonl",
      sha256: createHash("sha256").update('{"raw":"transcript"}\n').digest("hex"),
    },
  ]);
});
