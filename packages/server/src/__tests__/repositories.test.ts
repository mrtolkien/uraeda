import { existsSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";
import { expect, test, vi } from "vite-plus/test";
import * as binding from "uraeda-binding";
import { temporaryFolder } from "uraeda-binding/test-utils";
import { live } from "../fate.ts";
import { homePath } from "../folders.ts";
import { Hosts } from "../repositories.ts";
import { fakeSessions } from "../testing.ts";
import {
  byIdAt,
  fateAt,
  fixtureRepo,
  git,
  mutate,
  port,
  testApp,
  testHosts,
  testServer,
} from "./helpers.ts";
import { createApp } from "../app.ts";

const FOLDER = "2026-10-14-dark-mode";

/** A fixture repository whose main branch holds a feature folder, its proposal titled `title`. */
function repoWithFeature(title: string) {
  const repo = fixtureRepo();
  mkdirSync(join(repo, "specs", FOLDER));
  writeFileSync(
    join(repo, "specs", FOLDER, "proposal.md"),
    `# ${title}\n\n## What\n\nDark mode.\n\n## Why\n\nNight.\n`,
  );
  git(repo, "add", "--all");
  git(repo, "commit", "--quiet", "--no-verify", "--message", "proposal: dark mode");
  return repo;
}

/** Two repositories with the same feature folder, under different titles, served by one app. */
async function twoRepositories() {
  const repos = [repoWithFeature("Dark mode in uraeda"), repoWithFeature("Dark mode in todo-app")];
  const opened = await testHosts(repos, { installed: false });
  const app = createApp({
    port,
    allowedHosts: [],
    allowOrigins: [],
    binding,
    sessions: opened.sessions,
    hosts: opened.hosts,
    dataDir: opened.dataDir,
  });
  return { app, ...opened };
}

/** US6.1 */
test("each repository's feature is read from its own endpoint", async () => {
  const { app, names } = await twoRepositories();

  const [a] = await byIdAt(app, names[0], "Feature", [FOLDER], ["title"]);
  const [b] = await byIdAt(app, names[1], "Feature", [FOLDER], ["title"]);

  expect([a.title, b.title]).toEqual(["Dark mode in uraeda", "Dark mode in todo-app"]);
});

test("an unknown name is a 404", async () => {
  const { app } = await testApp();

  const responses = [];
  for (const path of ["fate", "fate/live", "raw/specs/PRIORITIES.md", "mockups/ui.html"]) {
    responses.push(
      await app.request(`http://127.0.0.1:${port}/r/old-site/${path}`, {
        method: path === "fate" ? "POST" : "GET",
      }),
    );
  }

  for (const response of responses) {
    expect([response.status, await response.text()]).toEqual([
      404,
      "No repository named “old-site”",
    ]);
  }
});

/** Review focus 1: a repository removed while its page is open. */
test("a removed repository's endpoint is a 404", async () => {
  const { app, name, hosts, dataDir } = await testApp();
  await binding.removeRepository(dataDir, name);
  await hosts.reload();

  const response = await app.request(`http://127.0.0.1:${port}/r/${name}/fate`, {
    method: "POST",
  });

  expect([response.status, await response.text()]).toEqual([404, `No repository named “${name}”`]);
});

test("a repository's raw file is served under its name", async () => {
  const { app, name } = await testApp();

  const response = await app.request(`http://127.0.0.1:${port}/r/${name}/raw/specs/PRIORITIES.md`);

  expect(response.status).toBe(200);
  expect(await response.text()).toContain("Web UI for the workflow files");
});

/** Review focus 5 */
test("a missing repository's host starts without a watch", async () => {
  const repo = fixtureRepo();
  const dataDir = temporaryFolder("uraeda-data");
  const { repository } = await binding.addRepository(dataDir, repo);
  rmSync(repo, { recursive: true, force: true });
  const watch = vi.fn(binding.watch);
  const { sessions } = fakeSessions({ installed: false });

  const hosts = await Hosts.open({ binding: { ...binding, watch }, dataDir, sessions });
  const host = hosts.get(repository.name);
  sessions.close();
  hosts.close();

  expect(host?.missing).toBe(true);
  expect(watch).not.toHaveBeenCalled();
});

/** Review focus 5 */
test("a watch that fails to start is logged, and the server goes on", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  const repo = fixtureRepo();
  const failing = {
    ...binding,
    watch: () => {
      throw new Error("too many open files");
    },
  };

  const { hosts, names } = await testHosts([repo], { binding: failing, installed: false });

  expect(hosts.get(names[0])?.path).toBe(repo);
  expect(log).toHaveBeenCalledWith(
    "uraeda-server: too many open files; pages refresh when shown again",
  );
  log.mockRestore();
});

test("hosts follow the list as it reloads, and close the watch of a removed one", async () => {
  const [first, second] = [fixtureRepo(), fixtureRepo()];
  let closed = 0;
  const counting = {
    ...binding,
    watch: (...args: Parameters<typeof binding.watch>) => {
      const handle = binding.watch(...args);
      return {
        close: () => {
          closed++;
          handle.close();
        },
      } as binding.WatchHandle;
    },
  };
  const { hosts, dataDir, names } = await testHosts([first], { binding: counting });

  const { repository } = await binding.addRepository(dataDir, second);
  await hosts.reload();
  const listed = await binding.readRepositories(dataDir);
  expect(hosts.rows()).toEqual(listed);
  expect(listed.map((row) => row.name).sort()).toEqual([names[0], repository.name].sort());
  expect(hosts.byPath(second)?.name).toBe(repository.name);
  expect(hosts.mostRecent()?.name).toBe(listed[0].name);

  await binding.removeRepository(dataDir, names[0]);
  await hosts.reload();
  expect([hosts.get(names[0]), closed]).toEqual([undefined, 1]);
});

test("an invalid list keeps the hosts, with its problem", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  const { hosts, dataDir, names } = await testHosts([fixtureRepo()], { installed: false });
  writeFileSync(join(dataDir, "repositories.json"), "{not json");

  await hosts.reload();

  expect(hosts.get(names[0])).toBeDefined();
  expect(hosts.problem).toMatch(/^repositories\.json could not be read: /);
  log.mockRestore();
});

const LIST = ["id", "rows", "problem", "added"];

type Opened = Awaited<ReturnType<typeof testApp>>;

/** The list, as the `Repositories` record of an endpoint gives it: the global one for null. */
async function list(app: Opened["app"], name: string | null) {
  const [record] = await byIdAt(app, name, "Repositories", ["repositories"], LIST);
  return record;
}

/** A list mutation through the repository's endpoint. */
const change = (opened: Opened, mutation: string, input: unknown) =>
  mutate(opened.app, `repositories.${mutation}`, input, LIST);

/** The calls a bus's `update` gets from now on, as `<type> <id>`. */
function heard(bus: { update: (...args: Array<any>) => void }) {
  const update = vi.spyOn(bus, "update");
  // The global bus's spy is shared by the tests of this file: its earlier calls are not heard.
  const from = update.mock.calls.length;
  return () => update.mock.calls.slice(from).map(([type, id]) => `${String(type)} ${String(id)}`);
}

test("the list is read from every endpoint, each path also from the home folder", async () => {
  const opened = await testApp();
  const path = realpathSync(opened.repo);
  const row = { name: opened.name, path, home: homePath(path, homedir()), missing: false };

  const global = await list(opened.app, null);
  const hosted = await list(opened.app, opened.name);

  expect(global).toEqual({ id: "repositories", rows: [row], problem: null, added: null });
  expect(hosted).toEqual(global);
});

/** US2.2, US2.4 */
test("adding a folder in a git repository adds its main checkout", async () => {
  const opened = await testApp();
  const other = fixtureRepo();

  const result = await change(opened, "add", { folder: join(other, "specs") });

  const name = basename(other);
  expect(result.error).toBeUndefined();
  expect(result.data.added).toBe(name);
  const rows = result.data.rows.map((row: { name: string; path: string }) => [row.name, row.path]);
  expect(rows).toHaveLength(2);
  expect(rows).toContainEqual([name, realpathSync(other)]);
  expect(opened.hosts.get(name)?.path).toBe(realpathSync(other));
});

test("a folder typed from the home folder is added", async () => {
  const opened = await testApp();
  const other = fixtureRepo();
  vi.stubEnv("HOME", dirname(other));

  const result = await change(opened, "add", { folder: `~/${basename(other)}/` });
  vi.unstubAllEnvs();

  expect(result.error).toBeUndefined();
  expect(result.data.added).toBe(basename(other));
});

/** US2.5 */
test("adding a listed repository again leaves the list as it was, and answers its name", async () => {
  const opened = await testApp();

  const result = await change(opened, "add", { folder: opened.repo });

  expect(result.data.added).toBe(opened.name);
  expect(result.data.rows).toHaveLength(1);
});

/** US2.3 and the add form's edge cases */
test.each([
  [
    "outside git",
    () => temporaryFolder("tools"),
    (folder: string) => `refused: Not a git repository: ${folder}. Run git init there first.`,
  ],
  [
    "missing",
    () => join(temporaryFolder("dev"), "nope"),
    (folder: string) => `refused: No such folder: ${folder}.`,
  ],
  ["relative", () => "dev/todo-app", () => "refused: Type an absolute path, starting with / or ~."],
])("adding a %s folder is refused, the list unchanged", async (_, folder, message) => {
  const opened = await testApp();
  const typed = folder();

  const result = await change(opened, "add", { folder: typed });

  expect(result.error).toEqual({ code: "BAD_REQUEST", message: message(typed) });
  expect((await list(opened.app, null)).rows).toHaveLength(1);
});

/** US5.1 */
test("removing leaves the folder and its sessions", async () => {
  const opened = await testApp();
  const root = realpathSync(opened.repo);
  const session = opened.sessions.cache.createSession({
    repo: root,
    folder: "2026-10-11-web-ui",
    agent: "fake",
    nativeId: "3f2c",
    title: null,
  });

  const result = await change(opened, "remove", { name: opened.name });

  expect(result.error).toBeUndefined();
  expect(result.data.rows).toEqual([]);
  expect(opened.hosts.get(opened.name)).toBeUndefined();
  expect(existsSync(join(opened.repo, "specs"))).toBe(true);
  expect(opened.sessions.cache.featureSession(root, "2026-10-11-web-ui")?.id).toBe(session.id);
});

/** US5.3 */
test("removing while an agent works is refused", async () => {
  const server = await testServer();
  const sent = await mutate(
    server.app,
    "session.send",
    { folder: "2026-10-11-web-ui", text: "Why A?" },
    ["id", "turns"],
  );
  expect(sent.error).toBeUndefined();

  const result = await mutate(server.app, "repositories.remove", { name: server.name }, LIST);

  expect(result.error).toEqual({
    code: "BAD_REQUEST",
    message: `refused: An agent is working in ${server.name}: stop it first.`,
  });
  expect(server.hosts.get(server.name)).toBeDefined();
  server.sessions.stop(server.repo, sent.data.id);
  await server.sessions.settled(Number(sent.data.turns.at(-1)));
});

/** US5.3, for a chat, which has no feature folder */
test("removing while an agent works in a chat is refused", async () => {
  const server = await testServer();
  const chat = await mutate(server.app, "session.newChat", {}, ["id"]);
  const sent = await mutate(
    server.app,
    "session.send",
    { session: chat.data.id, text: "List the open draft files" },
    ["id", "turns"],
  );
  expect(sent.error).toBeUndefined();

  const result = await mutate(server.app, "repositories.remove", { name: server.name }, LIST);

  expect(result.error).toEqual({
    code: "BAD_REQUEST",
    message: `refused: An agent is working in ${server.name}: stop it first.`,
  });
  expect(server.hosts.get(server.name)).toBeDefined();
  server.sessions.stop(server.repo, sent.data.id);
  await server.sessions.settled(Number(sent.data.turns.at(-1)));
});

test("removing an unknown name is refused", async () => {
  const opened = await testApp();

  const result = await change(opened, "remove", { name: "old-site" });

  expect(result.error).toEqual({
    code: "BAD_REQUEST",
    message: "refused: No repository named “old-site”",
  });
});

/** US1.4 */
test("opening a repository moves it first", async () => {
  const opened = await testHosts([fixtureRepo(), fixtureRepo()], { installed: false });
  // Opened at 09:00 and 10:00, long ago: the list's times are to the second, which the adds share.
  const file = join(opened.dataDir, "repositories.json");
  const stored = JSON.parse(readFileSync(file, "utf8"));
  stored.repositories.forEach((entry: { openedAt: string }, index: number) => {
    entry.openedAt = `2020-01-01T${String(9 + index).padStart(2, "0")}:00:00Z`;
  });
  writeFileSync(file, JSON.stringify(stored));
  await opened.hosts.reload();
  const app = createApp({
    port,
    allowedHosts: [],
    allowOrigins: [],
    binding,
    sessions: opened.sessions,
    hosts: opened.hosts,
    dataDir: opened.dataDir,
  });
  const last = opened.hosts.rows().at(-1)!.name;

  const [result] = await fateAt(app, null, [
    { kind: "mutation", name: "repositories.open", input: { name: last }, select: LIST },
  ]);

  expect(result.data.rows[0].name).toBe(last);
  expect(result.data.added).toBeNull();
  expect(opened.hosts.mostRecent()?.name).toBe(last);
});

test("a change of the list is sent on every repository's bus and the global one", async () => {
  const opened = await testApp();
  const buses = [live, opened.hosts.get(opened.name)!.live].map(heard);

  await change(opened, "add", { folder: fixtureRepo() });

  for (const calls of buses) {
    expect(calls()).toContain("Repositories repositories");
  }
});

/** US4.3, SC-004, review focus 2 */
test("ura add reaches a running server within a second", async () => {
  const opened = await testApp();
  const global = heard(live);
  const other = fixtureRepo();

  const { repository } = await binding.addRepository(opened.dataDir, other);
  const start = performance.now();
  await vi.waitFor(() => expect(global()).toContain("Repositories repositories"), {
    timeout: 1000,
    interval: 10,
  });

  expect(performance.now() - start).toBeLessThan(1000);
  expect(opened.hosts.get(repository.name)?.path).toBe(realpathSync(other));
  const names = (await list(opened.app, null)).rows.map((row: { name: string }) => row.name);
  expect(names).toContain(repository.name);
});

/** Review focus 2 */
test("a hand edit removing a repository closes its host", async () => {
  const opened = await testHosts([fixtureRepo(), fixtureRepo()], { installed: false });
  const file = join(opened.dataDir, "repositories.json");
  const stored = JSON.parse(readFileSync(file, "utf8"));
  stored.repositories = stored.repositories.filter(
    (entry: { name: string }) => entry.name !== opened.names[1],
  );

  writeFileSync(file, JSON.stringify(stored));

  await vi.waitFor(() => expect(opened.hosts.get(opened.names[1])).toBeUndefined(), {
    timeout: 1000,
    interval: 10,
  });
  expect(opened.hosts.get(opened.names[0])).toBeDefined();
});

/** The edge case of an invalid `repositories.json`, review focus 2 */
test("an invalid list on disk keeps the hosts, reports the problem, and refuses adding", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  const opened = await testApp();
  const file = join(opened.dataDir, "repositories.json");

  writeFileSync(file, "{not json");
  await vi.waitFor(() => expect(opened.hosts.problem).not.toBeNull(), {
    timeout: 1000,
    interval: 10,
  });
  const record = await list(opened.app, opened.name);
  const result = await change(opened, "add", { folder: fixtureRepo() });

  expect(record.problem).toMatch(/^repositories\.json could not be read: /);
  expect(record.rows.map((row: { name: string }) => row.name)).toEqual([opened.name]);
  expect(opened.hosts.get(opened.name)).toBeDefined();
  expect(result.error).toEqual({ code: "BAD_REQUEST", message: `refused: ${record.problem}` });
  expect(readFileSync(file, "utf8")).toBe("{not json");
  log.mockRestore();
});

test("the hosts watch a data folder that does not exist yet", async () => {
  const dataDir = join(temporaryFolder("uraeda"), "data");
  const { sessions } = fakeSessions({ installed: false });
  const hosts = await Hosts.open({ binding, dataDir, sessions });

  const { repository } = await binding.addRepository(dataDir, fixtureRepo());

  await vi.waitFor(() => expect(hosts.get(repository.name)).toBeDefined(), {
    timeout: 1000,
    interval: 10,
  });
  hosts.close();
  sessions.close();
});

test("closed hosts stop following the file", async () => {
  const opened = await testHosts([fixtureRepo()], { installed: false });
  opened.hosts.close();

  await binding.addRepository(opened.dataDir, fixtureRepo());
  await new Promise((resolve) => setTimeout(resolve, 300));

  expect(opened.hosts.all()).toEqual([]);
});

/** Review focus 6 */
test("the global endpoint refuses a repository's record", async () => {
  const { app } = await testApp();

  const results = await fateAt(app, null, [
    { kind: "byId", type: "Workspace", ids: ["workspace"], select: ["root"] },
    { kind: "mutation", name: "priorities.commit", input: {}, select: ["hash"] },
  ]);

  for (const result of results) {
    expect(result.error).toEqual({ code: "BAD_REQUEST", message: "refused: no repository" });
  }
});

test("the global endpoint still serves the list, suggestions, and the agent", async () => {
  const { app, name } = await testApp();

  const [repositories, suggestions, agent] = await fateAt(app, null, [
    { kind: "byId", type: "Repositories", ids: ["repositories"], select: ["rows.name"] },
    { kind: "byId", type: "FolderSuggestions", ids: ["/"], select: ["rows.path"] },
    { kind: "byId", type: "Agent", ids: ["agent"], select: ["name"] },
  ]);

  expect(repositories.data[0].rows.map((row: { name: string }) => row.name)).toEqual([name]);
  expect(suggestions.ok).toBe(true);
  expect(agent.ok).toBe(true);
});

/** The edge case of old file links */
test("an old raw link redirects to the most recent repository", async () => {
  const { app, name } = await testApp();

  const raw = await app.request(`http://127.0.0.1:${port}/raw/specs/PRIORITIES.md?plain=1`);
  const mockup = await app.request(`http://127.0.0.1:${port}/mockups/specs/x/mockups/ui.html`);

  expect([raw.status, raw.headers.get("location")]).toEqual([
    307,
    `/r/${name}/raw/specs/PRIORITIES.md?plain=1`,
  ]);
  expect([mockup.status, mockup.headers.get("location")]).toEqual([
    307,
    `/r/${name}/mockups/specs/x/mockups/ui.html`,
  ]);
});

test("an old raw link without any repository is not found", async () => {
  const opened = await testHosts([]);
  const app = createApp({
    port,
    allowedHosts: [],
    allowOrigins: [],
    binding,
    sessions: opened.sessions,
    hosts: opened.hosts,
    dataDir: opened.dataDir,
  });

  const response = await app.request(`http://127.0.0.1:${port}/raw/specs/PRIORITIES.md`);

  expect(response.status).toBe(404);
});
