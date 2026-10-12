import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseEnv } from "node:util";

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
  let file: Record<string, string | undefined> = {};
  try {
    file = parseEnv(readFileSync(resolve(root, ".env"), "utf8"));
  } catch {
    // No `.env`: the defaults apply.
  }
  const value = (name: string) => environment[name] ?? file[name];
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
