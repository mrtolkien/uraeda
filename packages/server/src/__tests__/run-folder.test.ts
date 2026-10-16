// The data folder's `run/`: the files that live only while a server runs, and the ones an earlier
// version kept in the data folder's root, removed at the first start.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, onTestFinished, test } from "vite-plus/test";
import { addPreview, fixtureRepo, temporaryFolder } from "uraeda-binding/test-utils";
import { type GroupsFile, startTime } from "../preview/groups.ts";
import { removeOldRunFiles, runFolder } from "../run-folder.ts";
import { FakeAdapter } from "../runner/fake.ts";
import { startServer } from "../server.ts";
import { writeHostToken } from "../sign-in/host.ts";
import { testSettings } from "../testing.ts";
import { binding, groupLeader, running } from "./helpers.ts";

/** What the data folder's root may hold: Uraeda's data and cache, SQLite's own files, and `run/`. */
const DATA = [
  "images",
  "repositories.json",
  "run",
  "runner.sqlite",
  "runner.sqlite-shm",
  "runner.sqlite-wal",
  "sign-in.json",
];

/** A server with sign-in on the data folder, in `repo`, on port 4310, stopped after the test. */
async function start(repo: string, dataDir: string) {
  const server = await startServer({
    adapter: new FakeAdapter(),
    allowOrigins: [],
    binding,
    dataDir,
    given: false,
    port: 4310,
    repo,
    settings: await testSettings(),
  });
  onTestFinished(() => server.stop());
  return server;
}

/** The files an earlier version's server, killed on port 4310, left in the data folder's root. */
function oldRunFiles(dataDir: string, groups: GroupsFile["groups"]) {
  const pid = spawnSync("true").pid;
  mkdirSync(join(dataDir, "storybooks"));
  const record: GroupsFile = { groups, server: { pid, started: "Thu Oct 15 09:00:00 2026" } };
  writeFileSync(join(dataDir, "storybooks", `${pid}.json`), JSON.stringify(record));
  writeFileSync(join(dataDir, "server-4310.token"), "an-old-token");
  mkdirSync(join(dataDir, "sign-in-links", "4310"), { recursive: true });
  writeFileSync(join(dataDir, "sign-in-links", "4310", "page.html"), "<p>old</p>\n");
}

test("the run folder is the data folder's run/", () => {
  expect(runFolder("/home/me/.local/share/uraeda")).toBe("/home/me/.local/share/uraeda/run");
});

test("a started server keeps its running files in run/, and nothing new in the root", async () => {
  const repo = fixtureRepo();
  addPreview(repo, { folder: "." });
  const dataDir = temporaryFolder("uraeda-data");
  // As `uraeda` does once it took the port, before the server starts.
  writeHostToken(dataDir, 4310);
  const server = await start(repo, dataDir);
  const base = `/r/repo/preview/${server.frames.current()}/main/`;
  server.previews.view({
    base,
    command: (await binding.preview(repo))!.command,
    dir: repo,
    folder: ".",
  });
  await expect.poll(() => server.previews.state(base)?.state, { timeout: 10_000 }).toBe("ready");
  const page = fileURLToPath(server.signInPage("/"));

  expect(existsSync(join(dataDir, "run", "storybooks", `${process.pid}.json`))).toBe(true);
  expect(existsSync(join(dataDir, "run", "server-4310.token"))).toBe(true);
  expect(dirname(page)).toBe(join(dataDir, "run", "sign-in-links", "4310"));
  expect(readdirSync(dataDir).filter((name) => !DATA.includes(name))).toEqual([]);
  expect(statSync(join(dataDir, "run")).mode & 0o777).toBe(0o700);
});

/** Edge case: process files from before this feature. */
test("a first start kills the Storybooks an earlier version left, and removes its files", async () => {
  const dataDir = temporaryFolder("uraeda-data");
  const first = await start(fixtureRepo(), dataDir);
  await first.stop();
  mkdirSync(join(dataDir, "images"));
  writeFileSync(join(dataDir, "images", "pasted.png"), "an image");
  const kept = readdirSync(dataDir).filter((name) => name !== "run");
  const signIn = readFileSync(join(dataDir, "sign-in.json"), "utf8");
  const pid = groupLeader();
  oldRunFiles(dataDir, [{ pid, started: startTime(pid)! }]);

  await start(fixtureRepo(), dataDir);

  await expect.poll(() => running(pid), { timeout: 10_000 }).toBe(false);
  for (const old of ["storybooks", "server-4310.token", "sign-in-links"]) {
    expect(existsSync(join(dataDir, old)), old).toBe(false);
  }
  expect(readdirSync(dataDir).filter((name) => name !== "run")).toEqual(kept);
  expect(kept).toEqual(expect.arrayContaining(["images", "repositories.json", "sign-in.json"]));
  expect(readFileSync(join(dataDir, "sign-in.json"), "utf8")).toBe(signIn);
  expect(readFileSync(join(dataDir, "images", "pasted.png"), "utf8")).toBe("an image");
});

test("removing the old files keeps the data, run/, and every other file", () => {
  const dataDir = temporaryFolder("uraeda-data");
  oldRunFiles(dataDir, []);
  writeHostToken(dataDir, 4310);
  const data = ["repositories.json", "runner.sqlite", "sign-in.json", "server-notes.txt"];
  for (const name of data) {
    writeFileSync(join(dataDir, name), name);
  }
  mkdirSync(join(dataDir, "images"));

  removeOldRunFiles(dataDir);

  expect(readdirSync(dataDir).sort()).toEqual(["images", "run", ...data].sort());
  expect(readdirSync(join(dataDir, "run"))).toEqual(["server-4310.token"]);
});
