// The server API on a started server: an extension's records reach fate, its events reach only
// the repositories it is on in, a runtime of yours reloads once its turns end, and routes stay
// under `/x/<name>/` and behind sign-in.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, expect, test } from "vite-plus/test";
import { commitOnBranch, fixtureRepo, git, temporaryFolder } from "uraeda-binding/test-utils";
import { fateAt, port, signInCookie } from "../../__tests__/helpers.ts";
import { FakeAdapter } from "../../runner/fake.ts";
import { SERVER_PATHS } from "../../server-paths.ts";
import { type Server, startServer } from "../../server.ts";
import { testSettings } from "../../testing.ts";
import type { Registry } from "../api.ts";
import { serverApi } from "../api.ts";
import { Scope } from "../scope.ts";
import { extensionFolder, writeFiles } from "./helpers.ts";

const binding = await import("uraeda-binding");

/** The spec waiting for the human on its branch, in the fixture. */
const FEATURE = "2026-10-06-recurring-tasks";
const SPEC = `specs/${FEATURE}/spec.md`;

const servers: Array<Server> = [];

afterEach(async () => {
  for (const server of servers.splice(0)) {
    await server.stop();
  }
});

/** What extensions under test share with the test: through the module `test/sink`. */
type Sink = {
  activations: number;
  adapter: FakeAdapter;
  changed?: () => void;
  events: Array<Record<string, unknown>>;
};

/**
 * A server on two repositories, `uraeda` and `other`, its config folder holding `extensions` (by
 * name, their files) and `config.toml`, on the fake agent. `prepare` runs on each repository first.
 */
async function serve(
  extensions: Record<string, Record<string, string>>,
  config: string,
  {
    prepare = () => {},
    signIn = false,
  }: { prepare?: (repo: string) => void; signIn?: boolean } = {},
) {
  const configDir = temporaryFolder("uraeda-config");
  for (const [name, files] of Object.entries(extensions)) {
    extensionFolder(configDir, name, files);
  }
  writeFileSync(join(configDir, "config.toml"), config);
  const dataDir = temporaryFolder("uraeda-data");
  const parent = temporaryFolder("uraeda-repos");
  const repos = ["other", "uraeda"].map((name) => fixtureRepo("repo", join(parent, name)));
  repos.forEach(prepare);
  for (const repo of repos) {
    await binding.addRepository(dataDir, repo);
  }
  const sink: Sink = { activations: 0, adapter: new FakeAdapter(), events: [] };
  const server = await startServer({
    agents: { fake: new FakeAdapter() },
    allowOrigins: [],
    binding,
    dataDir,
    extensionModules: { "test/sink": { sink } },
    given: false,
    port,
    repo: repos[1],
    settings: await testSettings({ dir: configDir }),
    ...(!signIn && { signIn: false as const }),
  });
  servers.push(server);
  const [other, uraeda] = repos;
  return { configDir, other, server, sink, uraeda };
}

/** The spec of the fixture's feature, waiting for the human or a draft. */
function setSpec(repo: string, status: "awaiting-human" | "draft") {
  const spec = git(repo, "show", `${FEATURE}:${SPEC}`).replace(
    /^status: .*$/m,
    `status: ${status}`,
  );
  commitOnBranch(repo, FEATURE, { [SPEC]: spec });
}

/** Reads `ExtensionRecord`s on a repository's endpoint. */
async function records(server: Server, repository: string, ids: Array<string>) {
  const [result] = await fateAt(server.app, repository, [
    { ids, kind: "byId", select: ["error", "value"], type: "ExtensionRecord" },
  ]);
  return result.data as Array<{ error: string | null; id: string; value: string }>;
}

/** The extension's row in the `Extensions` record, as the host gives it. */
const stateOf = (server: Server, name: string) =>
  server.extensions.states().extensions.find((one) => one.extension.name === name);

/** An extension's files: it pushes the step events it receives, by its name. */
const listening = (name: string) => ({
  "server.ts": `import { sink } from "test/sink";
export default function activate(api) {
api.on("step-reached", (event) => { sink.events.push({ by: "${name}", ...event }); });
}
`,
});

/** A runtime extension's files, at `version`: it counts its activations. */
const runtime = (version: number) => ({
  "server.ts": `import { sink } from "test/sink";
export default function activate(api) {
sink.activations += 1;
api.runtime(sink.adapter);
}
// version ${version}
`,
});

/** The address of a path on the test's server. */
const url = (path: string) => `http://127.0.0.1:${port}${path}`;

test("records reach fate, live", async () => {
  const server = `import { sink } from "test/sink";
export default function activate(api) {
  const pages = api.record("pages", (repository) => ({ pages: ["Home"], repository }));
  sink.changed = () => pages.changed("uraeda");
  api.record("broken", () => { throw new Error("no pages folder"); });
}
`;
  const opened = await serve(
    { wiki: { "server.ts": server } },
    `[extensions.wiki]\non = ["uraeda"]\n`,
  );

  expect(await records(opened.server, "uraeda", ["wiki/pages", "wiki/broken"])).toEqual([
    {
      error: null,
      id: "wiki/pages",
      value: JSON.stringify({ pages: ["Home"], repository: "uraeda" }),
    },
    { error: "no pages folder", id: "wiki/broken", value: "null" },
  ]);
  const host = opened.server.hosts.get("uraeda")!;
  const updated = Promise.withResolvers<void>();
  const stop = new AbortController();
  host.live.listen!("ExtensionRecord", "wiki/pages", () => updated.resolve(), {
    signal: stop.signal,
  });
  opened.sink.changed!();
  await updated.promise;
  stop.abort();

  expect(await records(opened.server, "other", ["wiki/pages"])).toEqual([
    { error: "wiki is off in other", id: "wiki/pages", value: "null" },
  ]);
});

test("events reach only repositories the extension is on in", async () => {
  const opened = await serve(
    { every: listening("every"), wiki: listening("wiki") },
    `[extensions.wiki]\non = ["uraeda"]\n`,
    { prepare: (repo) => setSpec(repo, "draft") },
  );

  setSpec(opened.other, "awaiting-human");
  setSpec(opened.uraeda, "awaiting-human");

  await expect.poll(() => opened.sink.events.filter(({ by }) => by === "every").length).toBe(2);
  const reached = opened.sink.events.filter(({ by }) => by === "wiki");
  expect(reached).toEqual([
    {
      by: "wiki",
      feature: FEATURE,
      repository: "uraeda",
      step: "spec",
      time: expect.stringMatching(/^\d{4}-\d\d-\d\dT/),
      waitsOn: "human",
    },
  ]);
});

test("a runtime reloads once its turns end", async () => {
  const opened = await serve({ durable: runtime(1) }, "");
  const { adapter } = opened.sink;
  const { sessions } = opened.server;
  await sessions.check();
  expect(opened.sink.activations).toBe(1);
  const session = await sessions.featureSession(opened.uraeda, FEATURE, "durable");
  const turnEnds = Promise.withResolvers<void>();
  const started = Promise.withResolvers<void>();
  adapter.script([
    async () => {
      started.resolve();
      await turnEnds.promise;
    },
    { text: "Done.", type: "text" },
    { denials: [], errors: [], interrupted: false, ok: true, type: "result" },
  ]);
  const { turn } = await sessions.send(opened.uraeda, session.id, { text: "Go on" });
  await started.promise;

  writeFiles(join(opened.configDir, "extensions", "durable"), runtime(2));
  await expect.poll(() => stateOf(opened.server, "durable")?.state).toBe("waiting");
  expect(stateOf(opened.server, "durable")?.waitingFor).toBe(FEATURE);
  expect(opened.sink.activations).toBe(1);

  turnEnds.resolve();
  await sessions.settled(turn);
  await expect.poll(() => opened.sink.activations).toBe(2);
  expect(stateOf(opened.server, "durable")?.state).toBe("on");
  expect(sessions.runtimeOf(session.id)).toBe(adapter);
});

/** An extension's files: its manifest, without entries, and one skill. */
const skills = (name: string) => ({
  "extension.toml": `name = "${name}"\ntitle = "${name}"\napi = 1\n`,
  "skills/astryx-docs/SKILL.md": "---\nname: astryx-docs\ndescription: Astryx.\n---\n",
});

test("a session gets the skills of the extensions on in its repository only", async () => {
  const opened = await serve(
    { "docs-ext": skills("docs-ext"), durable: runtime(1), "off-ext": skills("off-ext") },
    `[extensions.docs-ext]\non = ["uraeda"]\n\n[extensions.off-ext]\non = []\n`,
  );
  const { adapter } = opened.sink;
  const { sessions } = opened.server;
  await sessions.check();
  const sent = async (repo: string) => {
    const session = await sessions.featureSession(repo, FEATURE, "durable");
    adapter.script([{ denials: [], errors: [], interrupted: false, ok: true, type: "result" }]);
    const { turn } = await sessions.send(repo, session.id, { text: "Go on" });
    await sessions.settled(turn);
    return adapter.opens.at(-1)?.skills;
  };

  expect(await sent(opened.uraeda)).toEqual([
    join(opened.configDir, "extensions", "docs-ext", "skills"),
  ]);
  expect(await sent(opened.other)).toEqual([]);
});

/** A registry that records nothing: the route's check comes first. */
const nothing = new Proxy({} as Registry, { get: () => () => () => {} });

test("a route outside /x/<name>/ is refused", () => {
  const api = serverApi(new Scope("wiki"), nothing);

  expect(() => api.route("/api/x", () => new Response("no"))).toThrow(
    "wiki: routes must be under /x/wiki/",
  );
  expect(() => api.route("/x/other/hello", () => new Response("no"))).toThrow(
    "wiki: routes must be under /x/wiki/",
  );
});

test("an extension's route needs a session, and answers where its extension is on", async () => {
  const server = `export default function activate(api) {
  api.route("/x/wiki/hello", (c, repository) => c.text("hello from " + (repository ?? "everywhere")));
  api.route("/x/wiki/fails", () => { throw new Error("boom"); });
}
`;
  const opened = await serve(
    { wiki: { "server.ts": server } },
    `[extensions.wiki]\non = ["uraeda"]\n`,
    {
      signIn: true,
    },
  );
  const { app } = opened.server;

  expect((await app.request(url("/x/wiki/hello"))).status).toBe(401);
  expect((await app.request(url("/r/uraeda/x/wiki/hello"))).status).toBe(401);
  const cookie = await signInCookie(app, opened.server.key!);
  const get = (path: string) => app.request(url(path), { headers: { cookie } });

  expect(await (await get("/x/wiki/hello")).text()).toBe("hello from everywhere");
  expect(await (await get("/r/uraeda/x/wiki/hello")).text()).toBe("hello from uraeda");
  expect((await get("/r/other/x/wiki/hello")).status).toBe(404);
  expect((await get("/x/wiki/fails")).status).toBe(500);
  expect((await get("/x/wiki/missing")).status).toBe(404);
  // Every route the app has, the extensions' too, is closed by the session check.
  const uncovered = app.routes
    .map((route) => route.path)
    .filter((path) => path !== "/*")
    .map((path) => path.replaceAll(/:[^/]+/g, "x").replaceAll("*", "x"))
    .filter((path) => !SERVER_PATHS.test(path));
  expect(uncovered).toEqual([]);
});

test("settings written from the page reach the extension, and turning it off unloads it", async () => {
  const manifest = `name = "wiki"\ntitle = "Wiki"\napi = 1\nserver = "server.ts"\n\n[settings.folder]\ntype = "string"\ndefault = "docs"\nlabel = "Folder"\nhelp = "Where the pages are."\n`;
  const server = `export default function activate(api) {
  api.record("folder", (repository) => api.settings(repository).folder);
}
`;
  const opened = await serve({ wiki: { "extension.toml": manifest, "server.ts": server } }, "");
  const folder = async () => (await records(opened.server, "uraeda", ["wiki/folder"]))[0];
  expect(await folder()).toMatchObject({ value: '"docs"' });

  const mutate = (name: string, input: unknown) =>
    fateAt(opened.server.app, null, [{ input, kind: "mutation", name, select: ["extensions"] }]);
  const [written] = await mutate("extensions.setSetting", {
    key: "folder",
    name: "wiki",
    repository: "uraeda",
    valueJson: '"wiki"',
  });
  expect(written.ok).toBe(true);
  await expect.poll(async () => (await folder()).value).toBe('"wiki"');
  expect((await records(opened.server, "other", ["wiki/folder"]))[0]).toMatchObject({
    value: '"docs"',
  });

  const [off] = await mutate("extensions.setOn", { name: "wiki", on: [] });
  expect(off.ok).toBe(true);
  await expect.poll(() => stateOf(opened.server, "wiki")?.state).toBe("off");
  expect((await folder()).error).toBe("wiki is off in uraeda");
});
