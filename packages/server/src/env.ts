import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseEnv } from "node:util";
import { dataDir } from "uraeda-binding";

/** The server's settings, from `.env` at the root, then the process's environment. */
export type Env = {
  /** Host names accepted besides 127.0.0.1 and localhost, like `mac.tail1234.ts.net`. */
  allowedHosts: Array<string>;
  /** Whether `URAEDA_REPO` named the repository, which must then be in git. */
  given: boolean;
  port: number;
  /** The repository to open first: `URAEDA_REPO`, or else the folder the server starts in. */
  repo: string;
};

export const DEFAULT_PORT = 4310;

/** Reads `URAEDA_ALLOWED_HOSTS`, `URAEDA_PORT`, and `URAEDA_REPO` from `<root>/.env` and the environment. */
export function loadEnv(root: string, environment: NodeJS.ProcessEnv = process.env): Env {
  const value = settings(root, environment);
  const hosts = value("URAEDA_ALLOWED_HOSTS") ?? "";
  const port = value("URAEDA_PORT");
  const repo = value("URAEDA_REPO");
  return {
    allowedHosts: hosts
      .split(",")
      .map((host) => host.trim())
      .filter(Boolean),
    given: Boolean(repo),
    port: port ? Number(port) : DEFAULT_PORT,
    repo: resolve(root, repo || "."),
  };
}

/**
 * Uraeda's data folder, where the runner keeps its cache and the list of repositories:
 * `URAEDA_DATA_DIR` from the environment or `<root>/.env`, or else the operating system's
 * default, from the core.
 */
export function loadDataDir(root: string, environment: NodeJS.ProcessEnv = process.env): string {
  return dataDir(settings(root, environment)("URAEDA_DATA_DIR"));
}

/** A setting by its name: from the environment, else from `<root>/.env`. */
function settings(root: string, environment: NodeJS.ProcessEnv) {
  let file: Record<string, string | undefined> = {};
  try {
    file = parseEnv(readFileSync(resolve(root, ".env"), "utf8"));
  } catch {
    // No `.env`: the defaults apply.
  }
  return (name: string) => environment[name] ?? file[name];
}
