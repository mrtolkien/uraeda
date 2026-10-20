import { execFileSync, spawn } from "node:child_process";
import { relative } from "node:path";
import { createVitest } from "vite-plus/test/node";
import { fastConfig } from "../vite.fast.config.ts";
import { changedFiles, rustCommands, selectFast, unproven } from "./fast-selection.ts";
import { acquire, lockFolder } from "./test-run.ts";

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

/** Runs a command to its end, rejecting with its exit status. */
function started(command: string, args: Array<string>): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code, signal) =>
      code === 0
        ? resolve()
        : reject(new Error(`${command} ${args.join(" ")} failed: ${signal ?? code}`)),
    );
  });
}

/**
 * Runs independent chains of commands at once, each in order, and waits for every chain to end
 * before failing with the first error: no command outlives the run.
 */
async function concurrently(chains: Array<Array<[string, Array<string>]>>) {
  const results = await Promise.allSettled(
    chains.map(async (chain) => {
      for (const [command, args] of chain) {
        await started(command, args);
      }
    }),
  );
  const failed = results.find((result) => result.status === "rejected");
  if (failed) {
    throw failed.reason;
  }
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
  // One of the machine's two heavy slots, as ready's checks take: never held around ready, whose
  // tasks would wait for it.
  const release = await acquire(lockFolder(), "heavy", 2);
  try {
    await checks(selection, args.includes("--graph"));
  } finally {
    release();
  }
}

async function checks(selection: ReturnType<typeof selectFast>, graph: boolean) {
  // Types read the committed declarations, so the TypeScript checks need no native build: they run
  // beside the native and Rust chain, which shares one Cargo build directory and stays in order.
  const typescript: Array<[string, Array<string>]> = [["vp", ["check"]]];
  if (selection.checks.includes("specs:check")) {
    typescript.push(["vp", ["run", "specs:check"]]);
  }
  const native: Array<[string, Array<string>]> = [];
  if (selection.checks.includes("binding:touch")) {
    native.push(["vp", ["run", "binding:touch"]]);
  }
  if (selection.rust.length) {
    native.push(...rustCommands(selection.rust));
  }
  await concurrently([typescript, native]);
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
    if (graph) {
      for (const project of vitest.projects) {
        report(`Graph ${project.name}:`, [...project.vite.moduleGraph.idToModuleMap.keys()]);
      }
    }
    const missing = unproven(
      selection.families,
      specifications.map((spec) => spec.project.name),
    );
    if (missing.length) {
      throw new Error(`Selected families discovered no tests: ${missing.join(", ")}`);
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
