// The server API on a started server: an extension's records and actions reach fate, its events
// reach only the repositories it is on in, and its routes stay under `/x/<name>/`, behind sign-in,
// and closed to other sites.
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { fixtureRepo, temporaryFolder } from "uraeda-binding/test-utils";
import { fateAt, signInCookie } from "../../__tests__/helpers.ts";
import { SERVER_PATHS } from "../../server-paths.ts";
import type { Registry } from "../api.ts";
import { serverApi } from "../api.ts";
import { Scope } from "../scope.ts";
import { binding, FEATURE, mutate, records, serve, setSpec, stateOf, url } from "./serve.ts";

/** An extension's files: it pushes the step events it receives, by its name. */
const listening = (name: string) => ({
  "server.ts": `import { sink } from "test/sink";
export default function activate(api) {
api.on("step-reached", (event) => { sink.events.push({ by: "${name}", ...event }); });
}
`,
});

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

test("session-started reaches extensions once the session is recorded, until the server stops", async () => {
  const server = `import { sink } from "test/sink";
export default function activate(api) {
api.on("session-started", (event) => { sink.events.push(event); });
}
`;
  const opened = await serve({ every: { "server.ts": server } }, "");
  const { cache } = opened.server.sessions;
  const row = { agent: "fake", folder: null, nativeId: "n1", repo: opened.uraeda, title: null };

  const created = cache.createSession(row);
  expect(opened.sink.events).toEqual([]);
  await expect
    .poll(() => opened.sink.events)
    .toMatchObject([{ repository: "uraeda", runtime: "fake", session: created.id }]);

  opened.server.extensions.close();
  cache.createSession({ ...row, nativeId: "n2" });
  await new Promise((resolve) => setImmediate(resolve));
  expect(opened.sink.events).toHaveLength(1);
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

test("an extension's route refuses other sites, and answers GET, HEAD, and POST", async () => {
  const server = `export default function activate(api) {
  api.route("/x/deploy/run", (c) => c.text("ran " + c.req.method));
  api.route("/x/deploy/status", (c) => c.text("status"), "GET");
  api.route("/x/deploy/files/*", (c) => c.text("file"));
}
`;
  const opened = await serve(
    { deploy: { "server.ts": server } },
    `[extensions.deploy]\non = ["uraeda"]\n`,
    { signIn: true },
  );
  const { app } = opened.server;
  const cookie = await signInCookie(app, opened.server.key!);
  const send = (path: string, method = "GET", site?: string) =>
    app.request(url(path), {
      headers: { cookie, ...(site !== undefined && { "sec-fetch-site": site }) },
      method,
    });

  // A link on another site, followed with the session's cookie, runs nothing.
  for (const site of ["cross-site", "same-site"]) {
    expect((await send("/x/deploy/run", "GET", site)).status).toBe(403);
    expect((await send("/r/uraeda/x/deploy/run", "GET", site)).status).toBe(403);
  }
  expect(await (await send("/x/deploy/run", "GET", "same-origin")).text()).toBe("ran GET");
  expect(await (await send("/x/deploy/run", "POST", "same-origin")).text()).toBe("ran POST");
  expect(await (await send("/x/deploy/run", "GET", "none")).text()).toBe("ran GET");
  // A route without a method answers GET and POST only; a GET route answers HEAD too.
  expect((await send("/x/deploy/run", "PUT")).status).toBe(404);
  expect((await send("/x/deploy/run", "DELETE")).status).toBe(404);
  expect((await send("/x/deploy/status", "HEAD")).status).toBe(200);
  expect((await send("/x/deploy/run", "HEAD")).status).toBe(200);
  expect((await send("/x/deploy/status", "POST")).status).toBe(404);
  // A trailing slash is the same route.
  expect(await (await send("/x/deploy/run/")).text()).toBe("ran GET");
  expect(await (await send("/r/uraeda/x/deploy/status/")).text()).toBe("status");
  expect(await (await send("/x/deploy/files/")).text()).toBe("file");
});

test("an action runs where its extension is on, and is refused off or on input not JSON", async () => {
  const server = `export default function activate(api) {
  api.action("double", (input, repository) => ({ doubled: input.n * 2, repository }));
}
`;
  const opened = await serve(
    { wiki: { "server.ts": server } },
    `[extensions.wiki]\non = ["uraeda"]\n`,
  );
  const act = async (repository: string, inputJson: string) => {
    const [result] = await fateAt(opened.server.app, repository, [
      {
        input: { extension: "wiki", inputJson, name: "double" },
        kind: "mutation",
        name: "extensions.act",
        select: ["outputJson"],
      },
    ]);
    return result;
  };

  expect((await act("uraeda", '{"n":2}')).data).toMatchObject({
    outputJson: JSON.stringify({ doubled: 4, repository: "uraeda" }),
  });
  const off = await act("other", '{"n":2}');
  expect(off.ok).toBe(false);
  expect(off.error?.message).toBe("refused: wiki is off in other");
  const garbled = await act("uraeda", "{n:2");
  expect(garbled.ok).toBe(false);
  expect(garbled.error?.message).toBe("refused: wiki: the input of double is not JSON");
});

test("an extension reads no settings of a repository it is off in", async () => {
  const manifest = `name = "wiki"\ntitle = "Wiki"\napi = 1\nserver = "server.ts"\n\n[settings.folder]\ntype = "string"\ndefault = "docs"\nlabel = "Folder"\nhelp = "Where the pages are."\n`;
  const server = `import { sink } from "test/sink";
export default function activate(api) {
  sink.settings = (repository) => api.settings(repository);
}
`;
  const opened = await serve(
    { wiki: { "extension.toml": manifest, "server.ts": server } },
    `[extensions.wiki]\non = ["uraeda"]\n`,
  );

  expect(opened.sink.settings!("uraeda")).toEqual({ folder: "docs" });
  expect(opened.sink.settings!(null)).toEqual({ folder: "docs" });
  expect(opened.sink.settings!("other")).toEqual({});
  // A main checkout no repository of the list has is named for no one.
  expect(await opened.server.extensions.readRecord("wiki/pages", "/home/someone/secret")).toEqual({
    error: "wiki is off in this repository",
    id: "wiki/pages",
    value: "null",
  });
});

test("a repository added after the start reads its own settings", async () => {
  const manifest = `name = "wiki"\ntitle = "Wiki"\napi = 1\nserver = "server.ts"\n\n[settings.folder]\ntype = "string"\ndefault = "docs"\nlabel = "Folder"\nhelp = "Where the pages are."\n`;
  const server = `import { sink } from "test/sink";
export default function activate(api) {
  sink.settings = (repository) => api.settings(repository);
}
`;
  const opened = await serve(
    { wiki: { "extension.toml": manifest, "server.ts": server } },
    `[extensions.wiki.repositories.third]\nfolder = "notes"\n`,
  );
  const third = fixtureRepo("repo", join(temporaryFolder("uraeda-repos"), "third"));
  await binding.addRepository(opened.dataDir, third);
  await opened.server.hosts.reload();

  await expect.poll(() => opened.sink.settings!("third")).toEqual({ folder: "notes" });
  expect(opened.sink.settings!("uraeda")).toEqual({ folder: "docs" });
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

  const [written] = await mutate(opened.server, "extensions.setSetting", {
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
  // The settings form reads each repository's own values on the global endpoint.
  const wikiRow = (result: typeof written) =>
    (
      result.data as { extensions: Array<{ name: string; repositoryValues: string }> }
    ).extensions.find((row) => row.name === "wiki");
  expect(wikiRow(written)?.repositoryValues).toBe('{"uraeda":{"folder":"wiki"}}');
  // `null` clears it back to the shared value.
  const [cleared] = await mutate(opened.server, "extensions.setSetting", {
    key: "folder",
    name: "wiki",
    repository: "uraeda",
    valueJson: "null",
  });
  expect(wikiRow(cleared)?.repositoryValues).toBe("{}");
  await expect.poll(async () => (await folder()).value).toBe('"docs"');

  const [off] = await mutate(opened.server, "extensions.setOn", { name: "wiki", on: [] });
  expect(off.ok).toBe(true);
  await expect.poll(() => stateOf(opened.server, "wiki")?.state).toBe("off");
  expect((await folder()).error).toBe("wiki is off in uraeda");
});
