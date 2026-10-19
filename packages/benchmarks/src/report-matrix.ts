import { basename, dirname } from "node:path";
import type { ListedRun } from "./recorder.ts";

const escape = (value: string | number) =>
  String(value).replaceAll(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

const MODEL_ORDER = ["opus", "sonnet", "haiku"];
const EFFORT_ORDER = ["low", "medium", "high", "xhigh", "max"];

/** The model's rank in the matrix: Opus, Sonnet, Haiku, then the others by name. */
const modelRank = (model: string) => {
  const index = MODEL_ORDER.findIndex((name) => model.includes(name));
  return index === -1 ? MODEL_ORDER.length : index;
};

/** `claude-opus-5-5` as "Opus 5.5". */
export function modelLabel(model: string): string {
  const match = /^claude-([a-z]+)-(\d+)-(\d+)$/.exec(model);
  return match?.[1]
    ? `${match[1][0]?.toUpperCase()}${match[1].slice(1)} ${match[2]}.${match[3]}`
    : model;
}

type Config = { effort: string; model: string };
const key = (config: Config) => `${config.model}|${config.effort}`;

const arm = (run: ListedRun) =>
  basename(run.folder).split("--")[1] === "plain" ? "plain" : "flow";
const caseOf = (run: ListedRun) => basename(run.folder).split("--")[0] ?? "";
const flagged = (run: ListedRun) =>
  run.record.outcome === "invalid" || run.record.flags?.includes("leak-suspected") === true;

function cell(run: ListedRun | undefined): string {
  if (run === undefined) {
    return '<td class="muted">not run</td>';
  }
  const tests = run.scores?.tests;
  const cost = run.record.steps.reduce((sum, step) => sum + step.cost.amount, 0);
  const small = `<small class="muted"> $${cost.toFixed(2)}${
    run.scores?.requirements
      ? ` · req ${run.scores.requirements.covered}/${run.scores.requirements.total}`
      : ""
  }</small>`;
  if (flagged(run)) {
    return `<td><span class="pill flag">⚠ flagged</span>${small}</td>`;
  }
  if (tests === undefined) {
    return `<td class="muted">${escape(run.record.outcome)}</td>`;
  }
  const label = `${tests.passed}/${tests.total}`;
  return `<td>${
    tests.resolved
      ? `<span class="pill pass">✓ ${label}</span>`
      : `<span class="pill fail">✕ ${label}</span>`
  }${small}</td>`;
}

/**
 * The matrix of the latest results: a row for each case, and for each model and effort a column of
 * the plain run and one of the flow run, each the newest run of its suites. The screening is left
 * out: it chose the cases, and is not a result.
 */
export function matrixSection(runs: Array<ListedRun>): string {
  const results = runs.filter((run) => !basename(dirname(run.folder)).endsWith("-screening"));
  const configs = new Map<string, Config>();
  const latest = new Map<string, ListedRun>();
  for (const run of results.toSorted((a, b) => (a.folder < b.folder ? -1 : 1))) {
    const config = { effort: run.record.effort, model: run.record.models.asked };
    configs.set(key(config), config);
    latest.set(`${caseOf(run)}|${key(config)}|${arm(run)}`, run);
  }
  const columns = [...configs.values()].toSorted(
    (a, b) =>
      modelRank(a.model) - modelRank(b.model) ||
      EFFORT_ORDER.indexOf(a.effort) - EFFORT_ORDER.indexOf(b.effort),
  );
  const cases = [...new Set(results.map(caseOf))].toSorted();
  if (columns.length === 0) {
    return "";
  }
  const head = columns
    .map((c) => `<th colspan="2">${escape(modelLabel(c.model))} · ${escape(c.effort)}</th>`)
    .join("");
  const sub = columns.map(() => "<th>Plain</th><th>Flow</th>").join("");
  const rows = cases
    .map(
      (id) =>
        `<tr><td class="case">${escape(id)}</td>${columns
          .map(
            (c) =>
              cell(latest.get(`${id}|${key(c)}|plain`)) + cell(latest.get(`${id}|${key(c)}|flow`)),
          )
          .join("")}</tr>`,
    )
    .join("");
  const totals = columns
    .map((c) =>
      (["plain", "flow"] as const)
        .map((which) => {
          const found = cases.flatMap((id) => latest.get(`${id}|${key(c)}|${which}`) ?? []);
          const resolved = found.filter(
            (run) => !flagged(run) && run.scores?.tests.resolved,
          ).length;
          return `<td class="num">${found.length === 0 ? "" : `${resolved} of ${found.length}`}</td>`;
        })
        .join(""),
    )
    .join("");
  return `<section><div class="suite-head"><h2>Latest results</h2><span class="meta">hidden tests passed, the newest run of each case, model, and effort</span></div><div class="card"><table data-matrix><thead><tr><th rowspan="2">Case</th>${head}</tr><tr>${sub}</tr></thead><tbody>${rows}<tr><td class="case">Resolved</td>${totals}</tr></tbody></table></div></section>`;
}
