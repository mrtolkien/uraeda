import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, expect, onTestFinished, test, vi } from "vite-plus/test";
import {
  addPreview,
  fixtureRepo,
  git,
  previewStarts,
  temporaryFolder,
} from "uraeda-binding/test-utils";
import { type GroupsFile, groupsFolder, startTime } from "../preview/groups.ts";
import { FakeAdapter } from "../runner/fake.ts";
import { startServer, SWEEP_EVERY_MS } from "../server.ts";
import { SIGN_IN_FILE, SignInStore } from "../sign-in/store.ts";

/** The core's binding, as one object: the server takes it whole. */
const binding = await import("uraeda-binding");

/** The servers of a test, stopped after it. */
const started: Array<{ stop: () => Promise<void> }> = [];

afterEach(async () => {
  for (const server of started.splice(0)) {
    await server.stop();
  }
  vi.restoreAllMocks();
});

/**
 * A server started in `repo`, on the fake agent and the data folder, stopped after the test;
 * without sign-in unless `signIn`.
 */
async function start(repo: string, dataDir: string, given = false, signIn = false) {
  const server = await startServer({
    adapter: new FakeAdapter(),
    allowedHosts: [],
    allowOrigins: [],
    binding,
    dataDir,
    given,
    port: 4310,
    repo,
    ...(!signIn && { signIn: false as const }),
  });
  started.push(server);
  return server;
}

/** A list in the data folder, written as by hand, its repositories opened in 2020 in order. */
function list(dataDir: string, repositories: Array<[name: string, path: string]>) {
  writeFileSync(
    join(dataDir, "repositories.json"),
    JSON.stringify({
      repositories: repositories.map(([name, path], index) => ({
        name,
        openedAt: `2020-01-0${index + 1}T00:00:00Z`,
        path,
      })),
      version: 1,
    }),
  );
}

/** US3.1 */
test("starting in a repository adds it, opened first", async () => {
  const repo = fixtureRepo();
  const dataDir = temporaryFolder("uraeda-data");

  const { hosts } = await start(repo, dataDir);

  expect(hosts.rows().map((row) => row.path)).toEqual([repo]);
  expect(hosts.mostRecent()?.path).toBe(repo);
});

test("starting in a listed repository opens it first", async () => {
  const repo = fixtureRepo();
  const other = fixtureRepo();
  const dataDir = temporaryFolder("uraeda-data");
  list(dataDir, [
    ["repo", repo],
    ["other", other],
  ]);

  const { hosts, url } = await start(join(repo, "specs"), dataDir);

  expect(hosts.rows().map((row) => row.name)).toEqual(["repo", "other"]);
  expect(hosts.mostRecent()?.path).toBe(repo);
  // The page `main.ts` opens.
  expect(url).toBe("/r/repo/");
});

/** US3.2 */
test("starting outside git keeps the list's most recent", async () => {
  const todo = fixtureRepo();
  const dataDir = temporaryFolder("uraeda-data");
  list(dataDir, [["todo-app", todo]]);
  const folder = temporaryFolder("uraeda-home");
  const log = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

  const { hosts, url } = await start(folder, dataDir);

  expect(hosts.mostRecent()?.name).toBe("todo-app");
  expect(hosts.rows()).toHaveLength(1);
  expect(url).toBe("/");
  expect(log).toHaveBeenCalledWith(
    `uraeda: ${folder} is not in a git repository: add one from the web UI\n`,
  );
});

/** US3.4 */
test("a given folder outside git stops the start", async () => {
  const folder = temporaryFolder("uraeda-tools");
  const dataDir = temporaryFolder("uraeda-data");

  await expect(start(folder, dataDir, true)).rejects.toThrow(`${folder} is not a git repository`);
});

/** A git repository with one commit and no specs/ folder. */
function repoWithoutSpecs(): string {
  const repo = temporaryFolder("uraeda-plain");
  git(repo, "init", "--quiet", "--initial-branch", "main");
  writeFileSync(join(repo, "README.md"), "# Plain\n");
  git(repo, "add", "--all");
  git(
    repo,
    "-c",
    "user.name=Test",
    "-c",
    "user.email=test@example.com",
    "commit",
    "--quiet",
    "--no-verify",
    "--message",
    "chore: start",
  );
  return repo;
}

/** The workspace of a listed repository, read through its own endpoint. */
async function workspaceOf(app: Awaited<ReturnType<typeof start>>["app"], name: string) {
  const response = await app.request(`http://127.0.0.1:4310/r/${name}/fate`, {
    body: JSON.stringify({
      operations: [
        { id: "1", ids: ["workspace"], kind: "byId", select: ["noSpecs"], type: "Workspace" },
      ],
      version: 1,
    }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  return (await response.json()) as { results: Array<{ data?: unknown; error?: unknown }> };
}

/** A repository without specs/ starts, as before repositories had a list: its home says ura init. */
test.each([false, true])(
  "starting in a repository without specs/ adds it, given: %s",
  async (given) => {
    const repo = repoWithoutSpecs();
    const dataDir = temporaryFolder("uraeda-data");

    const { app, hosts } = await start(repo, dataDir, given);

    expect(hosts.rows().map((row) => [row.path, row.missing])).toEqual([[repo, false]]);
    const name = hosts.rows()[0].name;
    const body = await workspaceOf(app, name);
    expect(body.results[0].error).toBeUndefined();
    expect(JSON.stringify(body.results[0].data)).toContain(`"noSpecs":"${repo}"`);
  },
);

/** Review focus 6: the global endpoint has no repository, whichever the server started in. */
test("the global endpoint serves no repository's records", async () => {
  const repo = fixtureRepo();
  const { app } = await start(repo, temporaryFolder("uraeda-data"));

  const response = await app.request("http://127.0.0.1:4310/fate", {
    body: JSON.stringify({
      operations: [
        { id: "1", ids: ["workspace"], kind: "byId", select: ["root"], type: "Workspace" },
      ],
      version: 1,
    }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });

  const body = (await response.json()) as { results: Array<{ error: { message: string } }> };
  expect(body.results[0].error.message).toBe("refused: no repository");
});

test("stopping closes the hosts and the session manager", async () => {
  const repo = fixtureRepo();
  const server = await start(repo, temporaryFolder("uraeda-data"));
  const close = vi.spyOn(server.hosts, "close");
  const closeAll = vi.spyOn(server.sessions, "closeAll");

  await server.stop();

  expect(close).toHaveBeenCalled();
  expect(closeAll).toHaveBeenCalled();
  expect(server.hosts.all()).toEqual([]);
});

/** SC-005 */
test("stopping stops every Storybook", async () => {
  const repo = fixtureRepo();
  const log = addPreview(repo, { folder: "." });
  const server = await start(repo, temporaryFolder("uraeda-data"));
  const base = "/r/repo/preview/main/";
  server.previews.view({
    base,
    command: (await binding.preview(repo))!.command,
    dir: repo,
    folder: ".",
  });
  await expect.poll(() => server.previews.state(base)?.state, { timeout: 10_000 }).toBe("ready");

  await server.stop();

  expect(server.previews.state(base)).toBeUndefined();
  await expect.poll(() => running(previewStarts(log)[0]!.pid), { timeout: 10_000 }).toBe(false);
});

test("removing a repository from the list stops its Storybooks", async () => {
  const repo = fixtureRepo();
  const log = addPreview(repo, { folder: "." });
  const dataDir = temporaryFolder("uraeda-data");
  const server = await start(repo, dataDir);
  const [{ name }] = server.hosts.all();
  const base = `/r/${encodeURIComponent(name!)}/preview/main/`;
  server.previews.view({
    base,
    command: (await binding.preview(repo))!.command,
    dir: repo,
    folder: ".",
  });
  await expect.poll(() => server.previews.state(base)?.state, { timeout: 10_000 }).toBe("ready");

  await binding.removeRepository(dataDir, name!);
  await server.hosts.reload();

  expect(server.previews.state(base)).toBeUndefined();
  await expect.poll(() => running(previewStarts(log)[0]!.pid), { timeout: 10_000 }).toBe(false);
});

test("the server sweeps its Storybooks every minute", async () => {
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
  onTestFinished(() => {
    vi.useRealTimers();
  });
  const server = await start(fixtureRepo(), temporaryFolder("uraeda-data"));
  const sweep = vi.spyOn(server.previews, "sweep");

  vi.advanceTimersByTime(SWEEP_EVERY_MS);

  expect(sweep).toHaveBeenCalledOnce();
});

/** Whether the process is running. */
function running(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** A process leading a group of its own, as a Storybook does, killed after the test: its pid. */
function groupLeader(): number {
  const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1 << 30)"], {
    detached: true,
    stdio: "ignore",
  });
  child.unref();
  onTestFinished(() => {
    try {
      process.kill(-child.pid!, "SIGKILL");
    } catch {
      // Already killed.
    }
  });
  return child.pid!;
}

/**
 * Writes the record a server leaves, naming `groups`: a server killed past its exit hook, or the
 * running `server`.
 */
function leftRecord(dataDir: string, groups: GroupsFile["groups"], server?: number) {
  const pid = server ?? spawnSync("true").pid;
  const started = server === undefined ? "Thu Oct 15 09:00:00 2026" : startTime(server)!;
  const folder = groupsFolder(dataDir);
  mkdirSync(folder, { recursive: true });
  const record: GroupsFile = { groups, server: { pid, started } };
  writeFileSync(join(folder, `${pid}.json`), JSON.stringify(record));
}

test("a start kills the Storybooks a killed server left, and clears their record", async () => {
  const dataDir = temporaryFolder("uraeda-data");
  const pid = groupLeader();
  leftRecord(dataDir, [{ base: "/r/repo/preview/main/", pid, started: startTime(pid)! }]);

  await start(fixtureRepo(), dataDir);

  await expect.poll(() => running(pid), { timeout: 10_000 }).toBe(false);
  expect(readdirSync(groupsFolder(dataDir))).toEqual([]);
});

test("a start leaves a recorded pid that now names another process", async () => {
  const dataDir = temporaryFolder("uraeda-data");
  const pid = groupLeader();
  leftRecord(dataDir, [
    { base: "/r/repo/preview/main/", pid, started: "Thu Oct 15 09:00:00 2026" },
  ]);

  await start(fixtureRepo(), dataDir);

  expect(running(pid)).toBe(true);
  expect(readdirSync(groupsFolder(dataDir))).toEqual([]);
});

test("a start leaves the Storybooks of another server still running", async () => {
  const dataDir = temporaryFolder("uraeda-data");
  const pid = groupLeader();
  const other = groupLeader();
  leftRecord(dataDir, [{ base: "/r/repo/preview/main/", pid, started: startTime(pid)! }], other);

  await start(fixtureRepo(), dataDir);

  expect(running(pid)).toBe(true);
  expect(readdirSync(groupsFolder(dataDir))).toEqual([`${other}.json`]);
});

test("a running Storybook is recorded until it stops", async () => {
  const repo = fixtureRepo();
  addPreview(repo, { folder: "." });
  const dataDir = temporaryFolder("uraeda-data");
  const server = await start(repo, dataDir);
  const base = "/r/repo/preview/main/";
  server.previews.view({
    base,
    command: (await binding.preview(repo))!.command,
    dir: repo,
    folder: ".",
  });
  await expect.poll(() => server.previews.state(base)?.state, { timeout: 10_000 }).toBe("ready");
  const file = join(groupsFolder(dataDir), `${process.pid}.json`);

  expect(existsSync(file)).toBe(true);
  await server.stop();
  expect(existsSync(file)).toBe(false);
});

/** A server with sign-in, in `repo` on the data folder. */
const signedServer = (repo: string, dataDir: string) => start(repo, dataDir, false, true);

/** Signs in to a server's app with the key: the `Cookie` header of the new session. */
async function signInTo(app: Awaited<ReturnType<typeof start>>["app"], key: string) {
  const response = await app.request("http://127.0.0.1:4310/session", {
    body: JSON.stringify({ key }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  return response.headers.get("set-cookie")!.split(";")[0];
}

/** Whether a `Cookie` header is signed in on a server's app. */
async function signedIn(app: Awaited<ReturnType<typeof start>>["app"], cookie: string) {
  const response = await app.request("http://127.0.0.1:4310/session", { headers: { cookie } });
  return response.status === 204;
}

/** US1.1 */
test("the first start makes the key, and the next one does not", async () => {
  const dataDir = temporaryFolder("uraeda-data");
  const repo = fixtureRepo();

  const first = await signedServer(repo, dataDir);
  await first.stop();
  const second = await signedServer(repo, dataDir);

  expect(first.key).toMatch(/^ura_[\w-]{43}$/);
  expect(second.key).toBeUndefined();
  expect(readFileSync(join(dataDir, SIGN_IN_FILE), "utf8")).not.toContain(first.key);
});

/** SC-004 */
test("a session survives three restarts", async () => {
  const dataDir = temporaryFolder("uraeda-data");
  const repo = fixtureRepo();
  const first = await signedServer(repo, dataDir);
  const cookie = await signInTo(first.app, first.key!);
  await first.stop();

  for (let restart = 0; restart < 3; restart++) {
    const server = await signedServer(repo, dataDir);

    expect(await signedIn(server.app, cookie)).toBe(true);
    await server.stop();
  }
});

/** US3.5 */
test("a new key signs every device out", async () => {
  const server = await signedServer(fixtureRepo(), temporaryFolder("uraeda-data"));
  const cookie = await signInTo(server.app, server.key!);

  const key = server.newKey();

  expect(key).toMatch(/^ura_[\w-]{43}$/);
  expect(key).not.toBe(server.key);
  expect(await signedIn(server.app, cookie)).toBe(false);
  expect(await signedIn(server.app, await signInTo(server.app, key))).toBe(true);
});

/** US4.1 */
test("a one-time link signs the host's browser in once", async () => {
  const server = await signedServer(fixtureRepo(), temporaryFolder("uraeda-data"));

  const link = server.signInLink(server.url);

  expect(link).toMatch(new RegExp(`^/session/[\\w-]{43}\\?to=${server.url}$`));
  const used = await server.app.request(`http://127.0.0.1:4310${link}`);
  expect(used.headers.get("location")).toBe(server.url);
  expect(await signedIn(server.app, used.headers.get("set-cookie")!.split(";")[0])).toBe(true);
  const again = await server.app.request(`http://127.0.0.1:4310${link}`);
  expect(again.headers.get("set-cookie")).toBeNull();
});

test("a server without sign-in links to the page itself, and has no key", async () => {
  const dataDir = temporaryFolder("uraeda-data");
  const server = await start(fixtureRepo(), dataDir);

  expect(server.signInLink("/r/repo/")).toBe("/r/repo/");
  expect(server.key).toBeUndefined();
  expect(existsSync(join(dataDir, SIGN_IN_FILE))).toBe(false);
});

/** Edge case: `sign-in.json` unreadable or invalid. */
test("an invalid sign-in file stops the start, and is left as it is", async () => {
  const dataDir = temporaryFolder("uraeda-data");
  const path = join(dataDir, SIGN_IN_FILE);
  writeFileSync(path, "{ not json");

  await expect(signedServer(fixtureRepo(), dataDir)).rejects.toThrow(
    new RegExp(
      `^cannot read ${path}: .+\\. Fix it, or delete it to make a new access key and sign every device out\\.$`,
    ),
  );
  expect(readFileSync(path, "utf8")).toBe("{ not json");
});

test("the server ends unused sessions every minute", async () => {
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
  onTestFinished(() => {
    vi.useRealTimers();
  });
  const sweep = vi.spyOn(SignInStore.prototype, "sweep");
  await signedServer(fixtureRepo(), temporaryFolder("uraeda-data"));

  vi.advanceTimersByTime(SWEEP_EVERY_MS);

  expect(sweep).toHaveBeenCalledOnce();
});
