import { join } from "node:path";
import { parseArgs } from "node:util";
import { readCase } from "./case.ts";
import { prepareCase } from "./prepare-case.ts";
import { BENCHMARKS, realDeps } from "./real-deps.ts";
import { writeReport } from "./report.ts";
import { run } from "./run-command.ts";
import { runFlow } from "./run-flow.ts";
import { runPlain } from "./run-plain.ts";
import { chooseCases, screen } from "./screen.ts";
import { fetchGold, fetchInstruction } from "./tests-source.ts";
import { readSuite } from "./suite.ts";

const USAGE = `Usage:
  benchmarks run <suite> <case> --approved-by <name> [--arm uraeda|plain] [--skill-commit <sha>]
  benchmarks screen <suite> <case>... --approved-by <name>
  benchmarks prepare-case <instance-id> --id <case-id>
  benchmarks report

A run spends usage: it starts only with a human's name after --approved-by.
`;

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    "approved-by": { type: "string" },
    arm: { type: "string" },
    id: { type: "string" },
    "skill-commit": { type: "string" },
  },
});
const [command, ...rest] = positionals;
const out = (text: string) => process.stdout.write(`${text}\n`);

async function main(): Promise<void> {
  if (command === "report") {
    const result = writeReport(BENCHMARKS);
    out(
      "empty" in result
        ? "Nothing to show: no run yet."
        : `${result.opened ? "Opened" : "Written to"} ${result.path}`,
    );
    return;
  }
  if (command === "prepare-case") {
    const [task] = rest;
    if (task === undefined || values.id === undefined) {
      throw new Error(USAGE);
    }
    out(
      await prepareCase({
        docker: (args) => run("docker", args),
        fetchInstruction,
        id: values.id,
        root: BENCHMARKS,
        task,
      }),
    );
    return;
  }
  const [suiteName, ...cases] = rest;
  if (
    (command !== "run" && command !== "screen") ||
    suiteName === undefined ||
    cases.length === 0
  ) {
    throw new Error(USAGE);
  }
  const target = {
    approvedBy: values["approved-by"] ?? "",
    suiteName,
  };
  const suite = readSuite(join(BENCHMARKS, "suites", `${suiteName}.toml`));
  const loaded = cases.map((id) => readCase(join(BENCHMARKS, "cases", id)));
  const deps = {
    ...(await realDeps()),
    ...(values["skill-commit"] ? { skillCommit: values["skill-commit"] } : {}),
  };
  if (command === "screen") {
    const { dropped, results } = await screen(
      { ...deps, fetchGold },
      { ...target, candidates: loaded, suite },
    );
    const { chosen, filled, repositories } = chooseCases(results);
    out(`dropped (reference fails): ${dropped.join(", ") || "none"}`);
    out(`chosen (${repositories} repositories): ${chosen.map((c) => c.id).join(", ")}`);
    out(`filled with passing cases: ${filled.join(", ") || "none"}`);
    return;
  }
  for (const found of loaded) {
    const folder =
      values.arm === "plain"
        ? (await runPlain(deps, { ...target, case: found, suite })).folder
        : await runFlow(deps, { ...target, case: found, suite });
    out(`${found.id}: ${folder}`);
  }
}

try {
  await main();
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
