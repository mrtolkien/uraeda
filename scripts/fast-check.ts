import { execFileSync } from "node:child_process";
import { relative } from "node:path";
import { createVitest } from "vite-plus/test/node";
import { fastConfig } from "../vite.fast.config.ts";
import { changedFiles, selectFast } from "./fast-selection.ts";

function report(...values: Array<unknown>) {
  process.stdout.write(
    values
      .map((value) => (typeof value === "string" ? value : JSON.stringify(value, null, 2)))
      .join(" ") + "\n",
  );
}

function run(command: string, args: Array<string> = []) {
  execFileSync(command, args, { stdio: "inherit" });
}

async function main() {
  const args = process.argv.slice(2);
  const baseIndex = args.indexOf("--base");
  if (
    args.some(
      (arg, index) =>
        arg !== "--graph" && index !== baseIndex && (baseIndex < 0 || index !== baseIndex + 1),
    ) ||
    (baseIndex >= 0 && !args[baseIndex + 1])
  ) {
    throw new Error("usage: vp run fast [--base <commit>] [--graph]");
  }
  const selection = selectFast(
    changedFiles(process.cwd(), baseIndex >= 0 ? args[baseIndex + 1] : undefined),
  );
  report("Fast selection:", JSON.stringify(selection, null, 2));
  report(`Deferred to ready: ${selection.deferred.join("; ")}`);
  if (selection.checks.includes("ready")) {
    report("An unclassified input requires complete validation.");
    run("vp", ["run", "ready"]);
    return;
  }
  // Types read the committed declarations; only selected test consumers need a native build.
  run("vp", ["check"]);
  if (selection.checks.includes("specs:check")) {
    run("vp", ["run", "specs:check"]);
  }
  if (selection.checks.includes("binding:touch")) {
    run("vp", ["run", "binding:touch"]);
  }
  if (selection.rust.length) {
    run("cargo", ["fmt", "--check"]);
    const packages = selection.rust.includes("workspace")
      ? ["--workspace"]
      : selection.rust.flatMap((name) => ["-p", name]);
    run("cargo", ["clippy", ...packages, "--all-targets", "--", "-D", "warnings"]);
    run("cargo", ["nextest", "run", ...packages]);
  }
  if (!selection.related.length && !selection.families.length) {
    return;
  }
  process.env.VITEST = "true";
  const config = fastConfig(selection);
  const vitest = await createVitest(
    { config: false, related: config.related, watch: false },
    { test: config.test },
  );
  try {
    await vitest.standalone();
    const specifications = await vitest.getRelevantTestSpecifications();
    report(
      "Discovered tests:",
      specifications.map((spec) => relative(process.cwd(), spec.moduleId)),
    );
    if (args.includes("--graph")) {
      for (const project of vitest.projects) {
        report(`Graph ${project.name}:`, [...project.vite.moduleGraph.idToModuleMap.keys()]);
      }
    }
    if (!specifications.length) {
      report("Zero matching focused tests; the named broader checks remain deferred to ready.");
      return;
    }
    const result = await vitest.runTestSpecifications(specifications);
    if (result.testModules.some((module) => !module.ok())) {
      process.exitCode = 1;
    }
    if (vitest.state.getUnhandledErrors().length) {
      process.exitCode = 1;
    }
  } finally {
    await vitest.close();
  }
}

if (import.meta.main) {
  await main();
}
