import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, vi } from "vite-plus/test";
import { loadConfigDir, loadDataDir, loadEnv } from "../env.ts";
import { parseOptions } from "../options.ts";
import { configDir, dataDir } from "uraeda-binding";
import { temporaryFolder } from "uraeda-binding/test-utils";

/** The core's default data and config folders, as the binding gives them. */
const core = { configDir, dataDir };

function root(env?: string) {
  const dir = temporaryFolder("uraeda-env");
  if (env !== undefined) {
    writeFileSync(join(dir, ".env"), env);
  }
  return dir;
}

test("reads the allowed hosts, the port, and the repository from .env, with their names", () => {
  const dir = root(
    "URAEDA_ALLOWED_HOSTS=a.ts.net, b.ts.net\nURAEDA_PORT=4999\nURAEDA_REPO=../todo\n",
  );

  expect(loadEnv(dir, {})).toEqual({
    allowedHosts: { name: "URAEDA_ALLOWED_HOSTS", value: ["a.ts.net", "b.ts.net"] },
    given: true,
    port: { name: "URAEDA_PORT", value: "4999" },
    repo: join(dir, "../todo"),
  });
});

test("reports no host names and no port when no variable gives them, and the root itself", () => {
  const dir = root();

  expect(loadEnv(dir, {})).toEqual({ given: false, repo: dir });
  expect(loadEnv(dir, { URAEDA_ALLOWED_HOSTS: "", URAEDA_PORT: "" })).toEqual({
    given: false,
    repo: dir,
  });
});

test("the environment wins over .env, and the command line over both", () => {
  const dir = root("URAEDA_PORT=4999\n");

  const env = loadEnv(dir, { URAEDA_PORT: "5000" });
  expect(env.port).toEqual({ name: "URAEDA_PORT", value: "5000" });
  expect(parseOptions(["--port", "5001"], env).port).toEqual({ name: "--port", value: "5001" });
  expect(parseOptions([], env).port).toEqual({ name: "URAEDA_PORT", value: "5000" });
  expect(parseOptions([], loadEnv(root(), {})).port).toBeUndefined();
});

/** R3, R13 */
test("the continues' variables are kept as typed, and their flags replace them", () => {
  const env = loadEnv(null, {
    URAEDA_AUTOMATIC_CONTINUES: "5",
    URAEDA_CONTINUE_AFTER_LIMIT: "true",
    URAEDA_CONTINUE_AFTER_RESTART: "false",
  });
  expect(env.continueAfterLimit).toEqual({ name: "URAEDA_CONTINUE_AFTER_LIMIT", value: "true" });
  expect(env.continueAfterRestart).toEqual({
    name: "URAEDA_CONTINUE_AFTER_RESTART",
    value: "false",
  });

  const options = parseOptions(["--no-continue-after-limit", "--automatic-continues", "6"], env);

  expect(options.continueAfterLimit).toEqual({ name: "--no-continue-after-limit", value: false });
  expect(options.continueAfterRestart).toEqual(env.continueAfterRestart);
  expect(options.automaticContinues).toEqual({ name: "--automatic-continues", value: "6" });
  expect(parseOptions([], env).automaticContinues).toEqual({
    name: "URAEDA_AUTOMATIC_CONTINUES",
    value: "5",
  });
  // A variable that is neither is checked with the port, after --help: a flag replaces it.
  const bad = loadEnv(null, { URAEDA_CONTINUE_AFTER_LIMIT: "yes" });
  expect(bad.continueAfterLimit).toEqual({ name: "URAEDA_CONTINUE_AFTER_LIMIT", value: "yes" });
  expect(parseOptions(["--no-continue-after-limit"], bad).continueAfterLimit).toEqual({
    name: "--no-continue-after-limit",
    value: false,
  });
});

test("the catch-up's variable is kept as typed, and its flag turns it on over it", () => {
  const env = loadEnv(null, { URAEDA_CATCH_UP_PULL_REQUESTS: "false" });
  expect(env.catchUpPullRequests).toEqual({
    name: "URAEDA_CATCH_UP_PULL_REQUESTS",
    value: "false",
  });

  expect(parseOptions([], env).catchUpPullRequests).toEqual(env.catchUpPullRequests);
  expect(parseOptions(["--catch-up-pull-requests"], env).catchUpPullRequests).toEqual({
    name: "--catch-up-pull-requests",
    value: true,
  });
});

test("the scheduled jobs' variable is kept as typed, and its flag turns them off over it", () => {
  const env = loadEnv(null, { URAEDA_SCHEDULED_JOBS: "true" });
  expect(env.scheduledJobs).toEqual({ name: "URAEDA_SCHEDULED_JOBS", value: "true" });

  expect(parseOptions([], env).scheduledJobs).toEqual(env.scheduledJobs);
  expect(parseOptions(["--no-scheduled-jobs"], env).scheduledJobs).toEqual({
    name: "--no-scheduled-jobs",
    value: false,
  });
  expect(parseOptions([], loadEnv(null, {})).scheduledJobs).toBeUndefined();
});

/** R7 */
test("an empty variable leaves .env's value", () => {
  const dir = root(
    "URAEDA_ALLOWED_HOSTS=a.ts.net\nURAEDA_CONFIG_DIR=/config/from-env-file\nURAEDA_PORT=4999\nURAEDA_REPO=../todo\n",
  );

  expect(loadEnv(dir, { URAEDA_ALLOWED_HOSTS: "", URAEDA_PORT: "", URAEDA_REPO: "" })).toEqual({
    allowedHosts: { name: "URAEDA_ALLOWED_HOSTS", value: ["a.ts.net"] },
    given: true,
    port: { name: "URAEDA_PORT", value: "4999" },
    repo: join(dir, "../todo"),
  });
  expect(loadConfigDir(dir, core, { URAEDA_CONFIG_DIR: "" })).toBe("/config/from-env-file");
});

test("the repository is given by URAEDA_REPO or --repo, not by the folder the server starts in", () => {
  const dir = root();

  expect(loadEnv(dir, { URAEDA_REPO: "../todo" }).given).toBe(true);
  expect(loadEnv(dir, { URAEDA_REPO: "" }).given).toBe(false);
  expect(parseOptions([], loadEnv(dir, {})).given).toBe(false);
  expect(parseOptions(["--repo", "../todo"], loadEnv(dir, {})).given).toBe(true);
});

test("--allowed-hosts replaces URAEDA_ALLOWED_HOSTS", () => {
  const env = loadEnv(null, { URAEDA_ALLOWED_HOSTS: "a.ts.net" });

  expect(env.allowedHosts).toEqual({ name: "URAEDA_ALLOWED_HOSTS", value: ["a.ts.net"] });
  expect(parseOptions(["--allowed-hosts", "b.ts.net, c.ts.net"], env).allowedHosts).toEqual({
    name: "--allowed-hosts",
    value: ["b.ts.net", "c.ts.net"],
  });
  // Given empty, the flag still overrides the file: no host name for this run.
  expect(parseOptions(["--allowed-hosts", ""], env).allowedHosts).toEqual({
    name: "--allowed-hosts",
    value: [],
  });
  expect(parseOptions([], loadEnv(null, {})).allowedHosts).toBeUndefined();
});

test("the data folder comes from .env, then the environment, then the system's default", () => {
  const dir = root("URAEDA_DATA_DIR=/data/from-env-file\n");

  expect(loadDataDir(dir, core, {})).toBe("/data/from-env-file");
  expect(loadDataDir(dir, core, { URAEDA_DATA_DIR: "/data/env" })).toBe("/data/env");
  expect(loadDataDir(root(), core, {})).toBe(dataDir());
  expect(loadDataDir(root("URAEDA_DATA_DIR=\n"), core, {})).toBe(dataDir());
});

test("a relative data folder is resolved from the root, as Claude Code runs in another folder", () => {
  const dir = root("URAEDA_DATA_DIR=.uraeda\n");

  expect(loadDataDir(dir, core, {})).toBe(join(dir, ".uraeda"));
  expect(loadDataDir(dir, core, { URAEDA_DATA_DIR: "data/uraeda" })).toBe(join(dir, "data/uraeda"));
  // The system's default, from the core, made absolute too.
  vi.stubEnv("URAEDA_DATA_DIR", "");
  vi.stubEnv("XDG_DATA_HOME", "xdg");
  try {
    expect(loadDataDir(root(), core, {})).toMatch(/^\/.*\/xdg\/uraeda$/);
  } finally {
    vi.unstubAllEnvs();
  }
});

test("without a checkout, no .env is read", () => {
  const dir = root("URAEDA_PORT=5000\nURAEDA_ALLOWED_HOSTS=evil.test\n");
  const previous = process.cwd();
  process.chdir(dir);
  try {
    expect(loadEnv(null, {})).toEqual({ given: false, repo: dir });
  } finally {
    process.chdir(previous);
  }
});

/** US1.3 of the testing review: the web configs' tests read the environment only. */
test("without .env, the settings come from the environment only", () => {
  const dir = root("URAEDA_DATA_DIR=/tmp/elsewhere\nURAEDA_PORT=9999\nURAEDA_REPO=../todo\n");

  expect(loadEnv(dir, {}, { file: false })).toEqual({ given: false, repo: dir });
  expect(loadEnv(dir, { URAEDA_PORT: "5000" }, { file: false }).port).toEqual({
    name: "URAEDA_PORT",
    value: "5000",
  });
  expect(loadDataDir(dir, core, {}, { file: false })).toBe(dataDir());
});

test("the config folder comes from the environment, then .env, then the core's default", () => {
  const dir = root("URAEDA_CONFIG_DIR=/config/from-env-file\n");

  expect(loadConfigDir(dir, core, {})).toBe("/config/from-env-file");
  expect(loadConfigDir(dir, core, { URAEDA_CONFIG_DIR: "/config/env" })).toBe("/config/env");
  expect(loadConfigDir(dir, core, {}, { file: false })).toBe(configDir());
  // Relative, from the root, as the data folder is.
  expect(loadConfigDir(dir, core, { URAEDA_CONFIG_DIR: "config" })).toBe(join(dir, "config"));
  expect(loadConfigDir(null, core, { URAEDA_CONFIG_DIR: "/config/env" })).toBe("/config/env");
});

test("the tests' config folder is their own, never the developer's", () => {
  expect(configDir()).toBe(join(process.env.TMPDIR!, "config"));
});
