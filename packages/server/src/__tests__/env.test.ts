import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, vi } from "vite-plus/test";
import { loadDataDir, loadEnv } from "../env.ts";
import { parseOptions } from "../options.ts";
import { dataDir } from "uraeda-binding";
import { temporaryFolder } from "uraeda-binding/test-utils";

function root(env?: string) {
  const dir = temporaryFolder("uraeda-env");
  if (env !== undefined) {
    writeFileSync(join(dir, ".env"), env);
  }
  return dir;
}

test("reads the allowed hosts, the port, and the repository from .env", () => {
  const dir = root(
    "URAEDA_ALLOWED_HOSTS=a.ts.net, b.ts.net\nURAEDA_PORT=4999\nURAEDA_REPO=../todo\n",
  );

  expect(loadEnv(dir, {})).toEqual({
    allowedHosts: ["a.ts.net", "b.ts.net"],
    given: true,
    port: 4999,
    repo: join(dir, "../todo"),
  });
});

test("defaults to port 4310 and the root itself", () => {
  const dir = root();

  expect(loadEnv(dir, {})).toEqual({
    allowedHosts: [],
    given: false,
    port: 4310,
    repo: dir,
  });
});

test("the environment wins over .env, and the command line over both", () => {
  const dir = root("URAEDA_PORT=4999\n");

  const env = loadEnv(dir, { URAEDA_PORT: "5000" });
  expect(env.port).toBe(5000);
  expect(parseOptions(["--port", "5001"], env).port).toBe(5001);
});

test("the repository is given by URAEDA_REPO or --repo, not by the folder the server starts in", () => {
  const dir = root();

  expect(loadEnv(dir, { URAEDA_REPO: "../todo" }).given).toBe(true);
  expect(loadEnv(dir, { URAEDA_REPO: "" }).given).toBe(false);
  expect(parseOptions([], loadEnv(dir, {})).given).toBe(false);
  expect(parseOptions(["--repo", "../todo"], loadEnv(dir, {})).given).toBe(true);
});

test("the data folder comes from .env, then the environment, then the system's default", () => {
  const dir = root("URAEDA_DATA_DIR=/data/from-env-file\n");

  expect(loadDataDir(dir, {})).toBe("/data/from-env-file");
  expect(loadDataDir(dir, { URAEDA_DATA_DIR: "/data/env" })).toBe("/data/env");
  expect(loadDataDir(root(), {})).toBe(dataDir());
  expect(loadDataDir(root("URAEDA_DATA_DIR=\n"), {})).toBe(dataDir());
});

test("a relative data folder is resolved from the root, as Claude Code runs in another folder", () => {
  const dir = root("URAEDA_DATA_DIR=.uraeda\n");

  expect(loadDataDir(dir, {})).toBe(join(dir, ".uraeda"));
  expect(loadDataDir(dir, { URAEDA_DATA_DIR: "data/uraeda" })).toBe(join(dir, "data/uraeda"));
  // The system's default, from the core, made absolute too.
  vi.stubEnv("URAEDA_DATA_DIR", "");
  vi.stubEnv("XDG_DATA_HOME", "xdg");
  try {
    expect(loadDataDir(root(), {})).toMatch(/^\/.*\/xdg\/uraeda$/);
  } finally {
    vi.unstubAllEnvs();
  }
});
