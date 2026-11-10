import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseEnv } from "node:util";

/** A value given for one run, with the name of the variable or flag that gave it. */
export type Given<T, N extends string = string> = { name: N; value: T };

/** The flag and the variable giving the allowed host names. */
export type HostsName = "--allowed-hosts" | "URAEDA_ALLOWED_HOSTS";

/** The flag and the variable giving the port. */
export type PortName = "--port" | "URAEDA_PORT";

/** The flag and the variable turning off the continue after a server restart. */
export type RestartName = "--no-continue-after-restart" | "URAEDA_CONTINUE_AFTER_RESTART";

/** The flag and the variable turning off the continue after a usage limit's reset. */
export type LimitName = "--no-continue-after-limit" | "URAEDA_CONTINUE_AFTER_LIMIT";

/**
 * The flag and the variable turning on the catch-up of open pull requests behind the default
 * branch.
 */
export type CatchUpName = "--catch-up-pull-requests" | "URAEDA_CATCH_UP_PULL_REQUESTS";

/** The flag and the variable turning off the scheduled jobs. */
export type ScheduledJobsName = "--no-scheduled-jobs" | "URAEDA_SCHEDULED_JOBS";

/** The flag and the variable giving the automatic continues in a row. */
export type ContinuesName = "--automatic-continues" | "URAEDA_AUTOMATIC_CONTINUES";

/**
 * A switch given for one run: a `--no-…` flag's `false`, `--catch-up-pull-requests`'s `true`, or
 * its variable as typed, which the settings unit checks with the port, after `--help` and
 * `--version` (R13).
 */
export type Switch<N extends string> = Given<boolean | string, N>;

/** Every flag and variable giving a setting's value for one run. */
export type GivenName =
  | HostsName
  | PortName
  | RestartName
  | LimitName
  | CatchUpName
  | ContinuesName
  | ScheduledJobsName;

/**
 * The variables of the server's settings, from the process's environment, then `.env` at the
 * checkout's root, if any: each with its variable's name, absent when no variable gives it. The
 * settings unit applies the file and the defaults over them (see `settings.ts`).
 */
export type Env = {
  /** Host names accepted besides 127.0.0.1 and localhost, like `mac.tail1234.ts.net`. */
  allowedHosts?: Given<Array<string>, HostsName>;
  /** The automatic continues in a row as typed: the settings unit checks it with the core's rule. */
  automaticContinues?: Given<string, ContinuesName>;
  /** Whether an open pull request behind the default branch is caught up by itself. */
  catchUpPullRequests?: Switch<CatchUpName>;
  /** Whether a run a usage limit stopped continues at its reset. */
  continueAfterLimit?: Switch<LimitName>;
  /** Whether a run the server's restart cut continues. */
  continueAfterRestart?: Switch<RestartName>;
  /** Whether `URAEDA_REPO` named the repository, which must then be in git. */
  given: boolean;
  /** The port as typed: the settings unit checks it with the core's rule. */
  port?: Given<string, PortName>;
  /** The repository to open first: `URAEDA_REPO`, or else the folder the server starts in. */
  repo: string;
  /** Whether the scheduled jobs start at their times. */
  scheduledJobs?: Switch<ScheduledJobsName>;
};

/**
 * Where the settings are read: `<root>/.env` too unless `file` is false, as for the web configs'
 * tests, which must not take a developer's `.env`.
 */
export type Sources = { file?: boolean };

/**
 * Reads `URAEDA_ALLOWED_HOSTS`, `URAEDA_PORT`, `URAEDA_REPO`, and the continues' variables from
 * `<root>/.env` and the environment, an empty variable as unset. Without a root, as in the package,
 * only the environment, and the repository is resolved from the current folder. A switch's variable
 * is kept as typed: the settings unit checks it, so a bad one does not break `--help`.
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
  const continues = value("URAEDA_AUTOMATIC_CONTINUES");
  const restart = value("URAEDA_CONTINUE_AFTER_RESTART");
  const limit = value("URAEDA_CONTINUE_AFTER_LIMIT");
  const catchUp = value("URAEDA_CATCH_UP_PULL_REQUESTS");
  const jobs = value("URAEDA_SCHEDULED_JOBS");
  return {
    ...(hosts && { allowedHosts: { name: "URAEDA_ALLOWED_HOSTS", value: hostNames(hosts) } }),
    ...(continues && {
      automaticContinues: { name: "URAEDA_AUTOMATIC_CONTINUES", value: continues },
    }),
    ...(catchUp && {
      catchUpPullRequests: { name: "URAEDA_CATCH_UP_PULL_REQUESTS", value: catchUp },
    }),
    ...(limit && { continueAfterLimit: { name: "URAEDA_CONTINUE_AFTER_LIMIT", value: limit } }),
    ...(restart && {
      continueAfterRestart: { name: "URAEDA_CONTINUE_AFTER_RESTART", value: restart },
    }),
    given: Boolean(repo),
    ...(port && { port: { name: "URAEDA_PORT", value: port } }),
    repo: resolve(root ?? process.cwd(), repo || "."),
    ...(jobs && { scheduledJobs: { name: "URAEDA_SCHEDULED_JOBS", value: jobs } }),
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
 * `file` leaves it in. A variable set but empty is unset, so `.env`'s value applies (R7).
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
  return (name: string) => environment[name] || file[name];
}
