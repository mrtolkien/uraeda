import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { checkCase, readCase } from "../case.ts";
import { parseRecord, parseScores } from "../record.ts";
import { listRuns, runFolderPath, writeRun } from "../recorder.ts";
import { readSuite } from "../suite.ts";
import { repositoryWithIgnore, sampleRecord, sampleScores, temporary, write } from "./samples.ts";

const SUITE = `cases = ["ansible-multipart-helper"]
arms = ["uraeda", "plain"]
model = "claude-sonnet-5-5"
effort = "medium"
agent = "claude"
max-steps = 30

[human]
path = "benchmarks/human.md"
commit = "abc123"
`;

const CASE = `source = "swe-bench-pro-v2"
task = "instance_ansible__ansible-1"
image = "ghcr.io/scaleapi/swe-bench_pro-v2@sha256:1"
upstream = "https://github.com/ansible/ansible"
repository = "/app"
`;

test("SC-003: the record schema rejects a missing field, naming it", () => {
  const { urls: _, ...record } = sampleRecord();

  expect(() => parseRecord({ ...record, transcripts: [] })).toThrow("urls");
});

test("SC-003: a nested field is named by its path, and a wrong outcome is refused", () => {
  const record = { ...sampleRecord(), transcripts: [] };

  expect(() => parseRecord({ ...record, harness: { name: "claude" } })).toThrow("harness.version");
  expect(() => parseRecord({ ...record, outcome: "won" })).toThrow("outcome");
});

test("the plain arm's scores hold the tests only", () => {
  expect(parseScores(sampleScores())).toEqual(sampleScores());
  expect(() => parseScores({})).toThrow("tests");
});

test("a suite reads with every field of the data model", () => {
  const suite = readSuite(write(join(temporary(), "s.toml"), SUITE));

  expect(suite).toMatchObject({
    arms: ["uraeda", "plain"],
    effort: "medium",
    human: {
      commit: "abc123",
      effort: "medium",
      model: "claude-sonnet-5-5",
      path: "benchmarks/human.md",
    },
    maxSteps: 30,
    model: "claude-sonnet-5-5",
  });
});

test("a suite with an unknown effort is refused", () => {
  const path = write(join(temporary(), "s.toml"), SUITE.replace('"medium"', '"huge"'));

  expect(() => readSuite(path)).toThrow("effort");
});

test("a case reads with its fields, named by its folder", () => {
  const folder = join(temporary(), "ansible-multipart-helper");
  write(join(folder, "case.toml"), CASE);

  expect(readCase(folder)).toMatchObject({
    id: "ansible-multipart-helper",
    repository: "/app",
    upstream: "https://github.com/ansible/ansible",
  });
});

test("a case whose repository has a specs folder is rejected", async () => {
  const folder = join(temporary(), "c");
  write(join(folder, "case.toml"), CASE);

  await expect(checkCase(readCase(folder), async () => ["src", "specs"])).rejects.toThrow("specs/");
  await expect(checkCase(readCase(folder), async () => ["src"])).resolves.toBeUndefined();
});

test("US5.3: git keeps the record and not the transcripts, whose hash the record holds", () => {
  const repo = repositoryWithIgnore();
  const folder = runFolderPath(join(repo, "benchmarks"), {
    arm: "uraeda",
    case: "c",
    date: "2026-10-19",
    n: 1,
    suite: "first",
  });
  write(join(folder, "transcripts/a.jsonl"), "{}\n");
  const specs = temporary();
  write(join(specs, "spec.md"), "# Spec\n");

  writeRun(folder, { diff: "diff\n", record: sampleRecord(), scores: sampleScores(), specs });
  execFileSync("git", ["add", "-A"], { cwd: repo });
  const tracked = execFileSync("git", ["ls-files"], { cwd: repo, encoding: "utf8" }).split("\n");

  expect(tracked.filter((file) => file.includes("runs/"))).toEqual([
    "benchmarks/runs/2026-10-19-first/c--uraeda--1/final.diff",
    "benchmarks/runs/2026-10-19-first/c--uraeda--1/record.json",
    "benchmarks/runs/2026-10-19-first/c--uraeda--1/scores.json",
    "benchmarks/runs/2026-10-19-first/c--uraeda--1/specs/spec.md",
  ]);
  const [run] = listRuns(join(repo, "benchmarks"));
  expect(run?.record.transcripts).toEqual([
    {
      file: "a.jsonl",
      sha256: "ca3d163bab055381827226140568f3bef7eaac187cebd76878e0b63e9e442356",
    },
  ]);
});

test("writing a run with an invalid record refuses before it writes", () => {
  const folder = join(temporary(), "run");
  const { urls: _, ...record } = sampleRecord();

  expect(() =>
    writeRun(folder, { diff: "", record: record as never, scores: sampleScores() }),
  ).toThrow("urls");
});

test("a suite gives the human and the judge a model and an effort of their own", () => {
  const path = write(
    join(temporary(), "s.toml"),
    SUITE.replace('model = "claude-sonnet-5-5"', 'model = "claude-opus-5-5"').replace(
      'commit = "abc123"',
      'commit = "abc123"\nmodel = "claude-sonnet-5-5"\neffort = "high"',
    ),
  );

  expect(readSuite(path)).toMatchObject({
    human: { effort: "high", model: "claude-sonnet-5-5" },
    model: "claude-opus-5-5",
  });
});
