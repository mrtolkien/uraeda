import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { parseEnv } from "node:util";
import { dataDir } from "./runner/cache.ts";

/** The server's settings, from `.env` at the root, then the process's environment. */
export type Env = {
  /** Host names accepted besides 127.0.0.1 and localhost, like `mac.tail1234.ts.net`. */
  allowedHosts: Array<string>;
  port: number;
  /** The repository to open. */
  repo: string;
};

export const DEFAULT_PORT = 4310;

/** Reads `URAEDA_ALLOWED_HOSTS`, `URAEDA_PORT`, and `URAEDA_REPO` from `<root>/.env` and the environment. */
export function loadEnv(root: string, environment: NodeJS.ProcessEnv = process.env): Env {
  const value = settings(root, environment);
  const hosts = value("URAEDA_ALLOWED_HOSTS") ?? "";
  const port = value("URAEDA_PORT");
  return {
    allowedHosts: hosts
      .split(",")
      .map((host) => host.trim())
      .filter(Boolean),
    port: port ? Number(port) : DEFAULT_PORT,
    repo: resolve(root, value("URAEDA_REPO") || "."),
  };
}

/**
 * Uraeda's data folder, where the runner keeps its cache: `URAEDA_DATA_DIR` from the environment
 * or `<root>/.env`, or else the operating system's default.
 */
export function loadDataDir(
  root: string,
  environment: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
  home: string = homedir(),
): string {
  const value = settings(root, environment);
  return dataDir({ ...environment, URAEDA_DATA_DIR: value("URAEDA_DATA_DIR") }, platform, home);
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
