import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import type { ListedRun } from "../recorder.ts";
import { renderReport, writeReport } from "../report.ts";
import { sampleRecord, sampleScores, temporary, write } from "./samples.ts";

/** A listed run of `caseId` and `arm` in the suite folder `<date>-<suite>`. */
function run(
  suiteFolder: string,
  caseId: string,
  arm: "uraeda" | "plain",
  extra: { flags?: Array<"leak-suspected">; outcome?: "invalid"; resolved?: boolean } = {},
): ListedRun {
  return {
    folder: `/benchmarks/runs/${suiteFolder}/${caseId}--${arm}--1`,
    record: {
      ...sampleRecord(),
      ...(extra.outcome ? { outcome: extra.outcome } : {}),
      ...(extra.flags ? { flags: extra.flags } : {}),
      transcripts: [],
    },
    scores: { tests: { passed: 3, resolved: extra.resolved ?? false, total: 5 } },
  };
}

/** The cases the page's comparison line counts. */
const compared = (html: string) =>
  (/data-compared="([^"]*)"/.exec(html)?.[1] ?? "").split(",").filter(Boolean);

test("US5.1: the newer suite comes first and names its versions", () => {
  const html = renderReport([
    run("2026-09-01-smoke", "a", "uraeda"),
    run("2026-10-19-first", "b", "uraeda"),
  ]);

  expect(html.indexOf("first · 2026-10-19")).toBeLessThan(html.indexOf("smoke · 2026-09-01"));
  expect(html).toContain("claude-sonnet-5-5 · medium · Claude Code 2.1.303 · skill bbbbbbb");
});

test("US5.2: invalid and leak-suspected runs show their flag and leave the comparison", () => {
  const html = renderReport([
    run("2026-10-19-first", "ok", "uraeda", { resolved: true }),
    run("2026-10-19-first", "ok", "plain"),
    run("2026-10-19-first", "bad", "uraeda", { outcome: "invalid" }),
    run("2026-10-19-first", "bad", "plain"),
    run("2026-10-19-first", "leak", "uraeda", { flags: ["leak-suspected"] }),
    run("2026-10-19-first", "leak", "plain"),
  ]);

  expect(html).toContain("Invalid run");
  expect(html).toContain("Leak suspected");
  expect(compared(html)).toEqual(["ok"]);
  expect(html).toContain(
    "1 cases compared: flow better on 1, same on 0, worse on 0. 2 runs flagged",
  );
});

test("a flow run beside its baseline shows tests, sessions, cost, and time for both", () => {
  const html = renderReport([
    run("2026-10-19-first", "c", "uraeda", { resolved: true }),
    run("2026-10-19-first", "c", "plain"),
  ]);

  expect(html).toContain("✓ Resolved · 3/5");
  expect(html).toContain("✕ Failed · 3/5");
  expect(html).toContain("$0.00");
});

test("without a display the path is printed, not opened", () => {
  const root = temporary();
  write(
    join(root, "runs/2026-10-19-first/c--plain--1/record.json"),
    JSON.stringify({ ...sampleRecord(), transcripts: [] }),
  );
  write(
    join(root, "runs/2026-10-19-first/c--plain--1/scores.json"),
    JSON.stringify(sampleScores()),
  );

  const result = writeReport(root, { open: () => "skipped" });

  expect(result).toEqual({ opened: false, path: join(root, "report.html") });
});

test("with no run folder it says there is nothing to show, and writes nothing", () => {
  expect(writeReport(temporary(), { open: () => "opened" })).toEqual({ empty: true });
});

test("US3.3: a later flow run is paired with the baseline an earlier suite made", () => {
  const html = renderReport([
    run("2026-09-01-first", "c", "plain"),
    run("2026-10-19-second", "c", "uraeda", { resolved: true }),
  ]);

  expect(compared(html)).toEqual(["c"]);
  expect(html).toContain("baseline of 2026-09-01-first");
});

test("a baseline for another model is not borrowed", () => {
  const other = run("2026-09-01-first", "c", "plain");
  other.record.models.asked = "claude-opus-5-5";

  const html = renderReport([other, run("2026-10-19-second", "c", "uraeda", { resolved: true })]);

  expect(compared(html)).toEqual([]);
});

test("the screening comes after the suites that were run, though its folder name sorts first", () => {
  const html = renderReport([
    run("2026-10-19-screening", "a", "plain"),
    run("2026-10-19-first", "a", "uraeda"),
  ]);

  expect(html.indexOf("first · 2026-10-19")).toBeLessThan(html.indexOf("screening · 2026-10-19"));
  expect(html.match(/class="latest"/g)).toHaveLength(1);
  expect(html.indexOf('class="latest"')).toBeLessThan(html.indexOf("screening · 2026-10-19"));
});

/** A run of a case, on a model and effort, in a suite folder. */
function configured(
  folder: string,
  caseId: string,
  arm: "uraeda" | "plain",
  model: string,
  effort: string,
  resolved: boolean,
): ListedRun {
  const made = run(folder, caseId, arm, { resolved });
  made.record.models.asked = model;
  made.record.effort = effort;
  return made;
}

/** The matrix section alone. */
const matrix = (html: string) => /<table data-matrix>.*?<\/table>/s.exec(html)?.[0] ?? "";

test("the results matrix comes first, with a column pair for each model and effort", () => {
  const html = renderReport([
    configured("2026-10-19-first-haiku-high", "c", "plain", "claude-haiku-5-5", "high", false),
    configured("2026-10-19-first", "c", "uraeda", "claude-sonnet-5-5", "medium", true),
    configured("2026-10-19-first-opus-high", "c", "uraeda", "claude-opus-5-5", "high", true),
    run("2026-10-19-screening", "x", "plain"),
  ]);

  const headings = [...matrix(html).matchAll(/<th colspan="2">(.*?)<\/th>/g)].map((m) => m[1]);
  expect(headings).toEqual(["Opus 5.5 · high", "Sonnet 5.5 · medium", "Haiku 5.5 · high"]);
  expect(html.indexOf("Latest results")).toBeLessThan(html.indexOf("first · 2026-10-19"));
  expect(matrix(html)).not.toContain(">x<");
});

test("a matrix cell shows the newest run's tests, and a count of the cases resolved", () => {
  const html = renderReport([
    configured("2026-10-18-first", "c", "plain", "claude-sonnet-5-5", "medium", false),
    configured("2026-10-19-first", "c", "plain", "claude-sonnet-5-5", "medium", true),
  ]);

  expect(matrix(html)).toContain("✓ 3/5");
  expect(matrix(html)).not.toContain("✕");
  expect(matrix(html)).toContain("1 of 1");
});
