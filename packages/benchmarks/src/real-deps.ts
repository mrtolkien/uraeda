import { realpathSync } from "node:fs";
import { join } from "node:path";
import { ClaudeAdapter } from "uraeda-server/runner/claude";
import type { Deps } from "./deps.ts";
import { fetchVerifier } from "./tests-source.ts";
import { prepareSandbox } from "./sandbox.ts";
import { run } from "./run-command.ts";

/** This repository's root, and its `benchmarks/` folder. */
export const REPOSITORY = join(import.meta.dirname, "../../..");
export const BENCHMARKS = join(REPOSITORY, "benchmarks");

/** The real tools: the server's Claude adapter, Docker, the benchmark's repository on GitHub. */
export async function realDeps(): Promise<Deps> {
  const claude = realpathSync((await run("which", ["claude"])).trim());
  return {
    adapter: (kind, sandbox, pluginDir) => {
      const imagesDir = join(sandbox.configDir, "images");
      if (kind === "host") {
        // The sessions on the host read the run's folder from the runner's own environment.
        process.env.CLAUDE_CONFIG_DIR = sandbox.hostConfigDir;
        return new ClaudeAdapter({ configDir: sandbox.hostConfigDir, imagesDir, pluginDir });
      }
      return new ClaudeAdapter({
        command: sandbox.command,
        configDir: sandbox.configDir,
        imagesDir,
        pluginDir,
      });
    },
    claude,
    fetchTests: fetchVerifier,
    now: () => new Date(),
    prepareSandbox,
    repository: REPOSITORY,
    root: BENCHMARKS,
  };
}
