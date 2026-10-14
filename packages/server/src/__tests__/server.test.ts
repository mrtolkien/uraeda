import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, expect, test, vi } from "vite-plus/test";
import { fixtureRepo, git, temporaryFolder } from "uraeda-binding/test-utils";
import { FakeAdapter } from "../runner/fake.ts";
import { startServer } from "../server.ts";

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

/** A server started in `repo`, on the fake agent and the data folder, stopped after the test. */
async function start(repo: string, dataDir: string, given = false) {
  const server = await startServer({
    adapter: new FakeAdapter(),
    allowedHosts: [],
    allowOrigins: [],
    binding,
    dataDir,
    given,
    port: 4310,
    repo,
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
  const log = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

  const { hosts } = await start(folder, dataDir);

  expect(hosts.mostRecent()?.name).toBe("todo-app");
  expect(hosts.rows()).toHaveLength(1);
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
