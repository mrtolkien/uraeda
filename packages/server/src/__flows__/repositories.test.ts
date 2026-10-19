// Several repositories on one server: the repositories decision's rules that two never mix, that
// each has its own endpoint, and that removing one leaves its files and sessions.
import { existsSync, mkdirSync, realpathSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { temporaryFolder } from "uraeda-binding/test-utils";
import { createApp } from "../app.ts";
import { suggest } from "../folders.ts";
import {
  appSettings,
  binding,
  byIdAt,
  type Data,
  fateAt,
  fixtureRepo,
  git,
  mutate,
  port,
  testApp,
  testHosts,
  testPreviews,
  testServer,
} from "../__tests__/helpers.ts";

const FEATURE = "2026-10-14-dark-mode";

/** A fixture repository whose main branch holds the same feature folder under its own title. */
function repoWithFeature(title: string) {
  const repo = fixtureRepo();
  mkdirSync(join(repo, "specs", FEATURE));
  writeFileSync(join(repo, "specs", FEATURE, "proposal.md"), `# ${title}\n\n## What\n\nIt.\n`);
  git(repo, "add", "--all");
  git(repo, "commit", "--quiet", "--no-verify", "--message", "proposal");
  return repo;
}

/** Two repositories with the same feature folder, under different titles, served by one app. */
async function twoRepositories() {
  const repos = [
    repoWithFeature("Dark mode in the first"),
    repoWithFeature("Dark mode in the second"),
  ];
  const opened = await testHosts(repos, { installed: false });
  const app = createApp({
    allowOrigins: [],
    binding,
    dataDir: opened.dataDir,
    hosts: opened.hosts,
    port,
    previews: testPreviews(),
    sessions: opened.sessions,
    settings: (await appSettings()).settings,
  });
  return { ...opened, app, repos };
}

const titleAt = async (app: Parameters<typeof fateAt>[0], name: string | null) =>
  (await byIdAt(app, name, "Feature", [FEATURE], ["id", "title"]))[0]?.title;

test("every page and route of a repository answers from that repository alone", async () => {
  const { app, names } = await twoRepositories();

  expect(await titleAt(app, names[0]!)).toBe("Dark mode in the first");
  expect(await titleAt(app, names[1]!)).toBe("Dark mode in the second");

  // A write through one repository's endpoint reaches that repository only.
  const [priorities] = await byIdAt(app, names[0]!, "Priorities", ["priorities"], ["id", "hash"]);
  const [added] = await fateAt(app, names[0]!, [
    {
      input: { hash: priorities.hash, section: "next", text: "Only the first repository" },
      kind: "mutation",
      name: "priorities.add",
      select: ["id"],
    },
  ]);
  expect(added.ok).toBe(true);
  const text = async (name: string) =>
    JSON.stringify(await byIdAt(app, name, "Priorities", ["priorities"], ["sections"]));
  expect(await text(names[0]!)).toContain("Only the first repository");
  expect(await text(names[1]!)).not.toContain("Only the first repository");

  // And so do its files.
  const file = async (name: string) =>
    (
      await app.request(`http://127.0.0.1:${port}/r/${name}/raw/specs/${FEATURE}/proposal.md`)
    ).text();
  expect(await file(names[0]!)).toContain("in the first");
  expect(await file(names[1]!)).toContain("in the second");
});

test("a name that is not listed has no endpoint, no file, and no upload", async () => {
  const { app } = await twoRepositories();
  const request = (method: string, path: string) =>
    app.request(`http://127.0.0.1:${port}${path}`, {
      body: method === "GET" ? undefined : "{}",
      headers: { "content-type": "application/json" },
      method,
    });

  for (const [method, path] of [
    ["POST", "/r/nobody/fate"],
    ["GET", "/r/nobody/raw/specs/PRIORITIES.md"],
    ["POST", "/r/nobody/attach?chat=1"],
    ["GET", "/r/nobody/images/specs/a.png"],
    ["GET", "/r/nobody/chat-images/a.webp"],
  ]) {
    expect((await request(method!, path!)).status, `${method} ${path}`).toBe(404);
  }
});

test("the global endpoint serves the list and refuses a repository's records", async () => {
  const { app, names } = await twoRepositories();

  const [list] = await byIdAt(app, null, "Repositories", ["repositories"], ["rows.name"]);
  const [feature] = await fateAt(app, null, [
    { ids: [FEATURE], kind: "byId", select: ["id", "title"], type: "Feature" },
  ]);

  expect(list.rows.map((row: Data) => row.name).sort()).toEqual([...names].sort());
  expect(feature.ok).toBe(false);
});

test("the list follows `ura add` and a hand edit while the server runs", async () => {
  const { app, dataDir, hosts, names } = await twoRepositories();
  const third = fixtureRepo();

  const { repository } = await binding.addRepository(dataDir, third);
  await expectHost(hosts, repository.name, true);
  expect((await byIdAt(app, repository.name, "Priorities", ["priorities"], ["id"])).length).toBe(1);

  await binding.removeRepository(dataDir, names[0]!);
  await expectHost(hosts, names[0]!, false);
  const gone = await app.request(`http://127.0.0.1:${port}/r/${names[0]}/fate`, { method: "POST" });
  expect(gone.status).toBe(404);
  // The other repositories are served as before.
  expect(await titleAt(app, names[1]!)).toBe("Dark mode in the second");
});

async function expectHost(
  hosts: { get: (name: string) => unknown },
  name: string,
  listed: boolean,
) {
  await expect
    .poll(() => hosts.get(name) !== undefined, { interval: 20, timeout: 10_000 })
    .toBe(listed);
}

test("removing a repository leaves its files and its sessions", async () => {
  const opened = await testApp();
  const root = realpathSync(opened.repo);
  const session = opened.sessions.cache.createSession({
    agent: "fake",
    folder: "2026-10-11-web-ui",
    nativeId: "3f2c",
    repo: root,
    title: null,
  });

  const [removed] = await fateAt(opened.app, opened.name, [
    {
      input: { name: opened.name },
      kind: "mutation",
      name: "repositories.remove",
      select: ["rows.name"],
    },
  ]);

  expect(removed.ok).toBe(true);
  expect(opened.hosts.get(opened.name)).toBeUndefined();
  expect(existsSync(join(opened.repo, "specs"))).toBe(true);
  expect(opened.sessions.cache.featureSession(root, "2026-10-11-web-ui")?.id).toBe(session.id);
});

test("a repository is not removed while an agent works in it", async () => {
  const server = await testServer();
  const sent = await mutate(
    server.app,
    "session.send",
    { folder: "2026-10-11-web-ui", text: "Hi" },
    ["id", "turns"],
  );
  expect(sent.error).toBeUndefined();

  const refused = await mutate(server.app, "repositories.remove", { name: server.name }, [
    "rows.name",
  ]);

  expect(refused.ok).toBe(false);
  expect(server.hosts.get(server.name)).toBeDefined();
  server.sessions.stop(server.repo, sent.data.id);
  await server.sessions.settled(Number(sent.data.turns.at(-1)));
});

test.each<[typed: string, expected: Array<[path: string, git: boolean]>]>([
  [
    "~/dev/to",
    [
      ["~/dev/todo-app/", true],
      ["~/dev/tools/", false],
    ],
  ],
  [
    "~/dev/TO",
    [
      ["~/dev/todo-app/", true],
      ["~/dev/tools/", false],
    ],
  ],
  [
    "~/dev/",
    [
      ["~/dev/other/", false],
      ["~/dev/todo-app/", true],
      ["~/dev/tools/", false],
    ],
  ],
  ["~/dev/.", [["~/dev/.cache/", false]]],
  ["~/dev/todo.txt", []],
  ["~/nothing/", []],
  ["dev/to", []],
])("the add form suggests the folders a typed path starts: %s", async (typed, expected) => {
  const home = temporaryFolder("uraeda-home");
  for (const folder of ["dev/.cache", "dev/other", "dev/todo-app/.git", "dev/tools"]) {
    mkdirSync(join(home, folder), { recursive: true });
  }
  writeFileSync(join(home, "dev/todo.txt"), "not a folder");

  const suggestions = await suggest(typed, home);

  expect(suggestions.map(({ git, path }) => [path, git])).toEqual(expected);
});

test("a locked list refuses every change and every suggestion, and still reads", async () => {
  const opened = await testApp(fixtureRepo(), { lockedList: true });
  const calls = [
    {
      input: { folder: fixtureRepo() },
      kind: "mutation",
      name: "repositories.add",
      select: ["id"],
    },
    { input: { name: opened.name }, kind: "mutation", name: "repositories.remove", select: ["id"] },
    { input: { name: opened.name }, kind: "mutation", name: "repositories.open", select: ["id"] },
    { ids: ["/"], kind: "byId", select: ["rows.path"], type: "FolderSuggestions" },
  ];

  for (const endpoint of [null, opened.name]) {
    const results = await fateAt(opened.app, endpoint, calls);
    expect(results.map((result) => result.ok)).toEqual([false, false, false, false]);
  }

  expect((await binding.readRepositories(opened.dataDir)).map((row) => row.path)).toEqual([
    realpathSync(opened.repo),
  ]);
  const [list] = await byIdAt(opened.app, null, "Repositories", ["repositories"], ["rows.name"]);
  expect(list.rows).toHaveLength(1);
});
