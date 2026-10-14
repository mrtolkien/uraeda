import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, expect, test, vi } from "vite-plus/test";
import * as binding from "uraeda-binding";
import { fixtureRepo, temporaryFolder } from "uraeda-binding/test-utils";
import { FakeAdapter } from "../runner/fake.ts";
import { startServer } from "../server.ts";

/** The servers of a test, stopped after it. */
const started: Array<{ stop: () => Promise<void> }> = [];

afterEach(async () => {
  for (const server of started.splice(0)) {
    await server.stop();
  }
  vi.restoreAllMocks();
});

/** A server started in `repo`, on the fake agent and the data folder, stopped after the test. */
async function start(repo: string, dataDir: string, given = false) {
  const server = await startServer({
    repo,
    given,
    port: 4310,
    allowedHosts: [],
    allowOrigins: [],
    binding,
    dataDir,
    adapter: new FakeAdapter(),
  });
  started.push(server);
  return server;
}

/** A list in the data folder, written as by hand, its repositories opened in 2020 in order. */
function list(dataDir: string, repositories: Array<[name: string, path: string]>) {
  writeFileSync(
    join(dataDir, "repositories.json"),
    JSON.stringify({
      version: 1,
      repositories: repositories.map(([name, path], index) => ({
        name,
        path,
        openedAt: `2020-01-0${index + 1}T00:00:00Z`,
      })),
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

  const { hosts } = await start(join(repo, "specs"), dataDir);

  expect(hosts.rows().map((row) => row.name)).toEqual(["repo", "other"]);
  expect(hosts.mostRecent()?.path).toBe(repo);
});

/** US3.2 */
test("starting outside git keeps the list's most recent", async () => {
  const todo = fixtureRepo();
  const dataDir = temporaryFolder("uraeda-data");
  list(dataDir, [["todo-app", todo]]);
  const folder = temporaryFolder("uraeda-home");
  const log = vi.spyOn(console, "error").mockImplementation(() => {});

  const { hosts } = await start(folder, dataDir);

  expect(hosts.mostRecent()?.name).toBe("todo-app");
  expect(hosts.rows()).toHaveLength(1);
  expect(log).toHaveBeenCalledWith(
    `uraeda-server: ${folder} is not in a git repository: add one from the web UI`,
  );
});

/** US3.4 */
test("a given folder outside git stops the start", async () => {
  const folder = temporaryFolder("uraeda-tools");
  const dataDir = temporaryFolder("uraeda-data");

  await expect(start(folder, dataDir, true)).rejects.toThrow(`${folder} is not a git repository`);
});

test("the global endpoint serves the starting repository until the UI moves", async () => {
  const repo = fixtureRepo();
  const { app } = await start(repo, temporaryFolder("uraeda-data"));

  const response = await app.request("http://127.0.0.1:4310/fate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      version: 1,
      operations: [
        { id: "1", kind: "byId", type: "Workspace", ids: ["workspace"], select: ["root"] },
      ],
    }),
  });

  const body = (await response.json()) as { results: Array<{ data: Array<{ root: string }> }> };
  expect(body.results[0].data[0].root).toBe(repo);
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
