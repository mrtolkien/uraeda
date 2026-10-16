import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseEnv } from "node:util";

/** A value given for one run, with the name of the variable or flag that gave it. */
export type Given<T> = { name: string; value: T };

/**
 * The variables of the server's settings, from the process's environment, then `.env` at the
 * checkout's root, if any: each with its variable's name, absent when no variable gives it. The
 * settings unit applies the file and the defaults over them (see `settings.ts`).
 */
export type Env = {
  /** Host names accepted besides 127.0.0.1 and localhost, like `mac.tail1234.ts.net`. */
  allowedHosts?: Given<Array<string>>;
  /** Whether `URAEDA_REPO` named the repository, which must then be in git. */
  given: boolean;
  port?: Given<number>;
  /** The repository to open first: `URAEDA_REPO`, or else the folder the server starts in. */
  repo: string;
};

/**
 * Where the settings are read: `<root>/.env` too unless `file` is false, as for the web configs'
 * tests, which must not take a developer's `.env`.
 */
export type Sources = { file?: boolean };

/**
 * Reads `URAEDA_ALLOWED_HOSTS`, `URAEDA_PORT`, and `URAEDA_REPO` from `<root>/.env` and the
 * environment, an empty variable as unset. Without a root, as in the package, only the
 * environment, and the repository is resolved from the current folder.
 */
export function loadEnv(
  root: string | null,
  environment: NodeJS.ProcessEnv = process.env,
  sources: Sources = {},
): Env {
  const value = settings(root, environment, sources);
  const hosts = value("URAEDA_ALLOWED_HOSTS");
  const port = value("URAEDA_PORT");
  const repo = value("URAEDA_REPO");
  return {
    ...(hosts && { allowedHosts: { name: "URAEDA_ALLOWED_HOSTS", value: hostNames(hosts) } }),
    given: Boolean(repo),
    ...(port && { port: { name: "URAEDA_PORT", value: Number(port) } }),
    repo: resolve(root ?? process.cwd(), repo || "."),
  };
}

/** A comma separated list of host names, as `URAEDA_ALLOWED_HOSTS` and `--allowed-hosts` take. */
export function hostNames(list: string): Array<string> {
  return list
    .split(",")
    .map((host) => host.trim())
    .filter(Boolean);
}

/**
 * Uraeda's data folder, where the runner keeps its cache and the list of repositories:
 * `URAEDA_DATA_DIR` from the environment or `<root>/.env`, or else the operating system's
 * default, from the core, given by the binding: this module never loads it, so `--help` runs
 * without it. A relative path is resolved from the root, or the current folder without
 * one: the agent runs in the repository, where it would point elsewhere (R39).
 */
export function loadDataDir(
  root: string | null,
  core: { dataDir: (custom?: string | null) => string },
  environment: NodeJS.ProcessEnv = process.env,
  sources: Sources = {},
): string {
  const custom = settings(root, environment, sources)("URAEDA_DATA_DIR");
  return resolve(root ?? process.cwd(), core.dataDir(custom));
}

/**
 * Uraeda's config folder, which holds the settings file: `URAEDA_CONFIG_DIR` from the environment
 * or `<root>/.env`, or else the core's default, given by the binding, as `loadDataDir` does. A
 * relative path is resolved from the root, or the current folder without one.
 */
export function loadConfigDir(
  root: string | null,
  core: { configDir: (custom?: string | null) => string },
  environment: NodeJS.ProcessEnv = process.env,
  sources: Sources = {},
): string {
  const custom = settings(root, environment, sources)("URAEDA_CONFIG_DIR");
  return resolve(root ?? process.cwd(), core.configDir(custom));
}

/**
 * A setting by its name: from the environment, else from `<root>/.env` when there is a root and
 * `file` leaves it in.
 */
function settings(
  root: string | null,
  environment: NodeJS.ProcessEnv,
  { file: read = true }: Sources,
) {
  let file: Record<string, string | undefined> = {};
  if (root === null || !read) {
    return (name: string) => environment[name];
  }
  try {
    file = parseEnv(readFileSync(resolve(root, ".env"), "utf8"));
  } catch {
    // No `.env`: the defaults apply.
  }
  return (name: string) => environment[name] ?? file[name];
}
