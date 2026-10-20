/**
 * `vp run sandbox [--reset]`: the web app from this checkout, over the sample projects of
 * `.sandbox/`, built the first time and kept until `--reset` rebuilds them. It serves with `vp run
 * dev`'s script on the sandbox's Vite config, so it restarts as `vp run dev` does, in an
 * environment naming only `.sandbox/`'s folders, "today" fixed, and a fake `gh` first on its PATH.
 * The `.env` of the checkout is never read.
 */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { fakeGh, samplePullRequests } from "../samples/index.ts";
import { sandboxEnv, seed, STALE_WARNING } from "./seed.ts";

const root = fileURLToPath(new URL("../../..", import.meta.url));
const dev = fileURLToPath(new URL("../../server/scripts/dev.ts", import.meta.url));
const config = fileURLToPath(new URL("../vite.sandbox.config.ts", import.meta.url));

const args = process.argv.slice(2);
const unknown = args.find((arg) => arg !== "--reset");
if (unknown !== undefined) {
  process.stderr.write(`Unknown argument: ${unknown}\nUsage: vp run sandbox [--reset]\n`);
  process.exit(2);
}

const sandbox = await seed(root, { reset: args.includes("--reset") });
if (sandbox.stale) {
  process.stdout.write(`${STALE_WARNING}\n`);
}
// The sample's pull requests, from a `gh` in a temporary folder this process removes as it exits.
fakeGh(samplePullRequests());

const child = spawn(process.execPath, [dev, "--config", config], {
  cwd: root,
  env: sandboxEnv(sandbox),
  stdio: "inherit",
});
// Ctrl-C reaches the dev script too, which stops Vite: this process waits for it, then exits,
// removing the fake `gh`.
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => child.kill(signal));
}
child.once("exit", (code) => process.exit(code ?? 0));
