import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { loadDataDir, loadEnv } from "../env.ts";
import { parseOptions } from "../options.ts";

function root(env?: string) {
  const dir = mkdtempSync(join(tmpdir(), "uraeda-env-"));
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
    port: 4999,
    repo: join(dir, "../todo"),
  });
});

test("defaults to port 4310 and the root itself", () => {
  const dir = root();

  expect(loadEnv(dir, {})).toEqual({ allowedHosts: [], port: 4310, repo: dir });
});

test("the environment wins over .env, and the command line over both", () => {
  const dir = root("URAEDA_PORT=4999\n");

  const env = loadEnv(dir, { URAEDA_PORT: "5000" });
  expect(env.port).toBe(5000);
  expect(parseOptions(["--port", "5001"], env).port).toBe(5001);
});

test("the data folder comes from .env, then the environment, then the system's default", () => {
  const dir = root("URAEDA_DATA_DIR=/data/from-env-file\n");

  expect(loadDataDir(dir, {}, "linux", "/home/me")).toBe("/data/from-env-file");
  expect(loadDataDir(dir, { URAEDA_DATA_DIR: "/data/env" }, "linux", "/home/me")).toBe("/data/env");
  expect(loadDataDir(root(), {}, "linux", "/home/me")).toBe("/home/me/.local/share/uraeda");
  expect(loadDataDir(root(), { XDG_DATA_HOME: "/xdg" }, "linux", "/home/me")).toBe("/xdg/uraeda");
});
