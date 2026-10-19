import { mkdirSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { openBrowser } from "uraeda-server/browser";
import { isBaseline } from "./baseline.ts";
import type { ListedRun } from "./recorder.ts";
import { listRuns } from "./recorder.ts";
import { REPORT_STYLE } from "./report-style.ts";

const escape = (value: string | number) =>
  String(value).replaceAll(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

/** The run's case and arm, from its folder `<case>--<arm>--<n>`. */
function parts(run: ListedRun) {
  const [caseId = "", arm = "", n = "1"] = basename(run.folder).split("--");
  return { arm, caseId, n: Number(n) };
}

/** Whether the run counts in the comparison: neither invalid nor suspected of a leak. */
const counts = (run: ListedRun) =>
  run.record.outcome !== "invalid" && !run.record.flags?.includes("leak-suspected");

const dollars = (run: ListedRun) =>
  `$${run.record.steps.reduce((sum, step) => sum + step.cost.amount, 0).toFixed(2)}`;

function duration(run: ListedRun): string {
  const seconds = Math.max(
    0,
    Math.round((Date.parse(run.record.ended) - Date.parse(run.record.started)) / 1000),
  );
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return hours > 0 ? `${hours} h ${minutes} m` : `${minutes} m`;
}

function testsCell(run: ListedRun): string {
  if (!counts(run)) {
    const why = run.record.flags?.includes("leak-suspected") ? "Leak suspected" : "Invalid run";
    return `<span class="pill flag">⚠ ${why}</span>`;
  }
  const tests = run.scores?.tests;
  if (tests === undefined) {
    return `<span class="muted">not graded (${escape(run.record.outcome)})</span>`;
  }
  const label = `${tests.passed}/${tests.total}`;
  return tests.resolved
    ? `<span class="pill pass">✓ Resolved · ${label}</span>`
    : `<span class="pill fail">✕ Failed · ${label}</span>`;
}

function requirementsCell(run: ListedRun): string {
  if (run.record.steps.every((step) => step.role === "plain") || parts(run).arm === "plain") {
    return '<td class="muted">not applicable</td>';
  }
  const requirements = run.scores?.requirements;
  if (requirements === undefined || !counts(run)) {
    return '<td class="muted">not graded</td>';
  }
  const share = requirements.total === 0 ? 0 : (requirements.covered / requirements.total) * 100;
  return `<td><div class="bar"><div class="track"><div class="fill" style="width: ${share.toFixed(0)}%"></div></div><span>${requirements.covered}/${requirements.total}</span></div></td>`;
}

function row(run: ListedRun, caseCell: string, from?: string): string {
  const arm = parts(run).arm === "plain" ? "Plain" : "Flow";
  const note =
    from === undefined ? "" : ` <small class="muted">baseline of ${escape(from)}</small>`;
  return `<tr>${caseCell}<td>${arm}${note}</td><td>${testsCell(run)}</td>${requirementsCell(run)}<td class="num">${run.record.steps.length}</td><td class="num">${dollars(run)}</td><td class="num">${duration(run)}</td></tr>`;
}

type Comparison = { compared: Array<string>; text: string };

/** How the cases with both a flow run and a baseline, neither flagged, compare. */
function compare(byCase: Map<string, Array<ListedRun>>, flagged: number): Comparison {
  let better = 0;
  let worse = 0;
  let same = 0;
  const compared: Array<string> = [];
  for (const [id, runs] of byCase) {
    const flow = runs.find((run) => parts(run).arm === "uraeda" && counts(run));
    const plain = runs.find((run) => parts(run).arm === "plain" && counts(run));
    if (flow?.scores === undefined || plain?.scores === undefined) {
      continue;
    }
    compared.push(id);
    if (flow.scores.tests.resolved === plain.scores.tests.resolved) {
      same++;
    } else if (flow.scores.tests.resolved) {
      better++;
    } else {
      worse++;
    }
  }
  const tail = flagged > 0 ? ` ${flagged} run${flagged === 1 ? "" : "s"} flagged, left out.` : "";
  return {
    compared,
    text: `${compared.length} cases compared: flow better on ${better}, same on ${same}, worse on ${worse}.${tail}`,
  };
}

/**
 * The suite's runs by case, each flow run with its baseline: the plain run of the same suite, else
 * the one a later flow run reuses from another suite (same task, image, model, and effort).
 */
function groupByCase(
  runs: Array<ListedRun>,
  baselines: Array<ListedRun>,
  borrowed: Map<ListedRun, string>,
): Map<string, Array<ListedRun>> {
  const byCase = new Map<string, Array<ListedRun>>();
  for (const run of runs) {
    byCase.set(parts(run).caseId, [...(byCase.get(parts(run).caseId) ?? []), run]);
  }
  for (const [id, caseRuns] of byCase) {
    const flow = caseRuns.find((run) => parts(run).arm === "uraeda");
    if (flow === undefined || caseRuns.some((run) => parts(run).arm === "plain")) {
      continue;
    }
    const baseline = baselines.find(
      (run) =>
        run.record.task.id === flow.record.task.id &&
        run.record.task.image === flow.record.task.image &&
        run.record.models.asked === flow.record.models.asked &&
        run.record.effort === flow.record.effort,
    );
    if (baseline !== undefined) {
      borrowed.set(baseline, basename(dirname(baseline.folder)));
      byCase.set(id, [...caseRuns, baseline]);
    }
  }
  return byCase;
}

function suiteSection(
  name: string,
  runs: Array<ListedRun>,
  latest: boolean,
  baselines: Array<ListedRun>,
): string {
  const borrowed = new Map<ListedRun, string>();
  const byCase = groupByCase(runs, baselines, borrowed);
  const first = runs[0]?.record;
  const meta = first
    ? `${escape(first.models.asked)} · ${escape(first.effort)} · Claude Code ${escape(first.harness.version)} · skill ${escape(first.skill.commit.slice(0, 7))}${first.skill.dirty ? " (dirty)" : ""} · ${byCase.size} cases`
    : "";
  const rows = [...byCase].flatMap(([id, caseRuns]) =>
    caseRuns
      .toSorted((a, b) => (parts(a).arm < parts(b).arm ? 1 : -1))
      .map((run, index) =>
        row(
          run,
          index === 0 ? `<td class="case" rowspan="${caseRuns.length}">${escape(id)}</td>` : "",
          borrowed.get(run),
        ),
      ),
  );
  const verdict = compare(byCase, runs.filter((run) => !counts(run)).length);
  const date = name.slice(0, 10);
  const suite = name.slice(11);
  return `<section><div class="suite-head"><h2>${escape(suite)} · ${escape(date)}</h2>${latest ? '<span class="latest">Latest</span>' : ""}<span class="meta">${meta}</span></div><div class="card"><table><thead><tr><th>Case</th><th>Arm</th><th>Hidden tests</th><th>Requirements in the spec</th><th class="num">Sessions</th><th class="num">Cost</th><th class="num">Time</th></tr></thead><tbody>${rows.join("")}</tbody></table></div><p class="verdict" data-compared="${escape(verdict.compared.join(","))}">${escape(verdict.text)}</p></section>`;
}

/** One self-contained HTML page of every run, newest suite first. */
export function renderReport(runs: Array<ListedRun>, now = new Date()): string {
  const suites = new Map<string, Array<ListedRun>>();
  for (const run of runs) {
    const name = basename(dirname(run.folder));
    suites.set(name, [...(suites.get(name) ?? []), run]);
  }
  const baselines = runs.filter(isBaseline);
  const ordered = [...suites].toSorted(([a], [b]) => (a < b ? 1 : -1));
  const sections = ordered.map(([name, suiteRuns], index) =>
    suiteSection(name, suiteRuns, index === 0, baselines),
  );
  return `<!doctype html><html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>Uraeda benchmarks</title><style>${REPORT_STYLE}</style></head><body><main><h1>Uraeda benchmarks</h1><p class="lede">Latest suite first. Five cases show gross failures and large gains, never a score.</p>${sections.join("")}<footer>Generated from benchmarks/runs/ on ${now.toISOString().slice(0, 16).replace("T", " at ")}.</footer></main></body></html>\n`;
}

export type ReportResult = { empty: true } | { opened: boolean; path: string };

/**
 * Writes `<root>/report.html` from the run folders and opens it in the browser, or only says where
 * it is when nothing can open it (SSH, no display). Nothing is written without a run folder.
 */
export function writeReport(
  root: string,
  {
    open = (url: string) => openBrowser(url),
  }: { open?: (url: string) => "opened" | "skipped" } = {},
): ReportResult {
  const runs = listRuns(root);
  if (runs.length === 0) {
    return { empty: true };
  }
  const path = join(root, "report.html");
  mkdirSync(root, { recursive: true });
  writeFileSync(path, renderReport(runs));
  return { opened: open(pathToFileURL(path).href) === "opened", path };
}
