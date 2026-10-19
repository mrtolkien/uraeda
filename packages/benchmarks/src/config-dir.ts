import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** Where the benchmark's tasks, tests, and reference solutions are published. */
export const DATASET_HOSTS = [
  "github.com",
  "raw.githubusercontent.com",
  "huggingface.co",
  "datasets-server.huggingface.co",
];

/**
 * The hosts a run must not fetch from, for a task whose upstream repository is `upstream`: a
 * GitHub repository's four hosts, because the web tool matches whole domains, else its own host.
 */
export function upstreamHosts(upstream: string): Array<string> {
  const { hostname } = new URL(upstream);
  return hostname === "github.com"
    ? ["github.com", "raw.githubusercontent.com", "api.github.com", "codeload.github.com"]
    : [hostname];
}

/**
 * Makes the run's Claude Code configuration folder: the one place that sets the model and the
 * effort of every role, the rules that keep the upstream out of the web tool, and no fallback to
 * another model. The adapter passes none of them. The small-and-fast model is the run's model too,
 * so that no helper model answers (ruling R3).
 */
export function makeConfigDir(options: {
  deniedHosts: Array<string>;
  effort: string;
  folder: string;
  model: string;
}): string {
  mkdirSync(options.folder, { recursive: true });
  const settings = {
    effort: options.effort,
    env: {
      ANTHROPIC_DEFAULT_HAIKU_MODEL: options.model,
      ANTHROPIC_SMALL_FAST_MODEL: options.model,
      DISABLE_AUTOUPDATER: "1",
    },
    model: options.model,
    permissions: {
      deny: [
        ...new Set([...options.deniedHosts, "huggingface.co", "datasets-server.huggingface.co"]),
      ].map((host) => `WebFetch(domain:${host})`),
    },
    switchModelsOnFlag: false,
  };
  writeFileSync(join(options.folder, "settings.json"), `${JSON.stringify(settings, null, 2)}\n`);
  return options.folder;
}
