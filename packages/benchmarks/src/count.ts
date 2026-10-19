import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Step } from "./record.ts";

/** What the run's questions and reviews add up to, from its `specs/` folder copy and its steps. */
export function countRounds(
  specs: string,
  steps: Array<Step>,
): { questions: number; revisions: number; rounds: number } {
  const files = existsSync(specs)
    ? readdirSync(specs).filter((file) => /^clarifications-\d+\.md$/.test(file))
    : [];
  const questions = files.reduce(
    (sum, file) =>
      sum + (readFileSync(join(specs, file), "utf8").match(/^## Q\d+:/gm)?.length ?? 0),
    0,
  );
  return {
    questions,
    revisions: steps.filter((step) => step.role === "human" && step.gate === "changes requested")
      .length,
    rounds: files.length,
  };
}
