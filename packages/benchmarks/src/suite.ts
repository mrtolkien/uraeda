import { readFileSync } from "node:fs";
import { parse } from "smol-toml";

/** What a benchmark runs: `benchmarks/suites/<suite>.toml`. */
export type Suite = {
  agent: string;
  arms: Array<"uraeda" | "plain">;
  cases: Array<string>;
  effort: string;
  human: { commit: string; effort: string; model: string; path: string };
  maxSteps: number;
  model: string;
};

const EFFORTS = ["low", "medium", "high", "xhigh", "max"];

/** Reads a TOML file whose fields are checked by `pick`, which names the field it misses. */
export function readToml(path: string): Record<string, unknown> {
  return parse(readFileSync(path, "utf8"));
}

function pick<T>(table: Record<string, unknown>, name: string, kind: "string" | "number"): T {
  const value = table[name];
  if (typeof value !== kind) {
    throw new Error(`${name}: expected ${kind === "string" ? "text" : "a number"}`);
  }
  return value as T;
}

export function readSuite(path: string): Suite {
  const table = readToml(path);
  const cases = table.cases;
  const arms = table.arms;
  const human = table.human as Record<string, unknown> | undefined;
  if (!Array.isArray(cases) || cases.length === 0) {
    throw new Error("cases: expected a list of case ids");
  }
  if (!Array.isArray(arms) || arms.some((arm) => arm !== "uraeda" && arm !== "plain")) {
    throw new Error('arms: expected "uraeda" and "plain"');
  }
  if (typeof human !== "object" || human === null) {
    throw new Error("human: expected a path and its commit");
  }
  const effort = pick<string>(table, "effort", "string");
  if (!EFFORTS.includes(effort)) {
    throw new Error(`effort: expected one of ${EFFORTS.join(", ")}`);
  }
  return {
    agent: pick(table, "agent", "string"),
    arms: arms as Suite["arms"],
    cases: cases as Array<string>,
    effort,
    // The simulated human and the judge may run another model than the agent under test.
    human: {
      commit: pick(human, "commit", "string"),
      effort: typeof human.effort === "string" ? human.effort : "medium",
      model: typeof human.model === "string" ? human.model : pick<string>(table, "model", "string"),
      path: pick(human, "path", "string"),
    },
    maxSteps: pick(table, "max-steps", "number"),
    model: pick(table, "model", "string"),
  };
}
