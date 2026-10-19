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
