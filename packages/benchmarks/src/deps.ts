import type { Adapter } from "uraeda-server/runner/adapter";
import type { LoopOptions } from "./loop.ts";
import type { Sandbox, SandboxOptions } from "./sandbox.ts";

/** What a run needs from outside, which tests replace with fakes. */
export type Deps = {
  /** An adapter for sessions in the container (`agent`), or on the host (`host`). */
  adapter: (kind: "agent" | "host", sandbox: Sandbox, pluginDir: string) => Adapter;
  /** Claude Code's binary on this machine. */
  claude: string;
  docker?: (args: Array<string>) => Promise<string>;
  fetchTests: (task: string, folder: string) => Promise<void>;
  /** What the loop asks, in place of `ura` and `git`. */
  loop?: LoopOptions["deps"];
  now: () => Date;
  prepareSandbox: (options: SandboxOptions) => Promise<Sandbox>;
  /** This repository, whose commit and skill a run records. */
  repository: string;
  /** The `benchmarks/` folder: suites, cases, runs. */
  root: string;
  /** The commit the skill is loaded from: `HEAD` by default. */
  skillCommit?: string;
};

/** A run's identity: what it is a run of, and who allowed it. */
export type RunTarget = {
  approvedBy: string;
  /** The suite's file name without `.toml`, which names the run folder. */
  suiteName: string;
};
