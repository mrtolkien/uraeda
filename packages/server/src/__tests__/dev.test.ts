import { createServer } from "node:http";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { afterEach, expect, onTestFinished, test, vi } from "vite-plus/test";
import { devFrames, devHandler, devPreviews, devServer, devUpgrade, stopDevRuns } from "../dev.ts";
import { loadEnv } from "../env.ts";
import { FakeAdapter } from "../runner/fake.ts";
import { checkoutOf, rawUpgrade, ready, socketOpens } from "../preview/__tests__/helpers.ts";
import { fixture, fixtureRepo } from "./helpers.ts";
import { addStoryFeature, STORY_FEATURE, temporaryFolder } from "uraeda-binding/test-utils";

// The tests set the server's variables for its handler: the next tests get the process's back.
afterEach(() => {
  vi.unstubAllEnvs();
});

/** US6.3 */
test("vp dev listens on 127.0.0.1:4310 only, by default", () => {
  const root = temporaryFolder("uraeda-dev");

  expect(devServer(loadEnv(root, {}))).toEqual({
    allowedHosts: [],
    host: "127.0.0.1",
    port: 4310,
    strictPort: true,
  });
});

test("vp dev accepts the hosts listed in .env", () => {
  const root = temporaryFolder("uraeda-dev");
  writeFileSync(join(root, ".env"), "URAEDA_ALLOWED_HOSTS=mac.tail1234.ts.net\n");

  expect(devServer(loadEnv(root, {})).allowedHosts).toEqual(["mac.tail1234.ts.net"]);
});

/** US6.4 */
test("the server in vp dev reads URAEDA_REPO", async () => {
  const repo = fixtureRepo();
  const root = temporaryFolder("uraeda-dev");
  const data = temporaryFolder("uraeda-data");
  writeFileSync(join(root, ".env"), `URAEDA_REPO=${repo}\nURAEDA_DATA_DIR=${data}\n`);
  vi.stubEnv("URAEDA_REPO", undefined);
  vi.stubEnv("URAEDA_DATA_DIR", undefined);
  const handler = devHandler(root, { adapter: new FakeAdapter() });
  const server = createServer((req, res) => handler(req, res, () => res.end("vite")));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as { port: number };

  /** Native fate operations, sent to the endpoint at `base`. */
  const fate = (base: string, operations: Array<Record<string, unknown>>) =>
    fetch(`http://127.0.0.1:${port}${base}/fate`, {
      body: JSON.stringify({ operations, version: 1 }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
  const list = (await (
    await fate("", [
      { id: "1", ids: ["repositories"], kind: "byId", select: ["rows.name"], type: "Repositories" },
    ])
  ).json()) as { results: Array<{ data: Array<{ rows: Array<{ name: string }> }> }> };
  const [{ name }] = list.results[0].data[0].rows;
  const response = await fate(`/r/${name}`, [
    { id: "1", ids: ["workspace"], kind: "byId", select: ["root"], type: "Workspace" },
    { id: "2", ids: ["agent"], kind: "byId", select: ["available"], type: "Agent" },
  ]);
  const other = await fetch(`http://127.0.0.1:${port}/index.html`);
  server.close();
  await stopDevRuns();

  const body = (await response.json()) as {
    results: Array<{ data: Array<{ available?: boolean; root?: string }> }>;
  };
  expect(body.results[0].data[0].root).toBe(repo);
  // The session manager, shared by the dev server's apps, keeps its cache in the data folder.
  expect(body.results[1].data[0].available).toBe(true);
  expect(existsSync(join(data, "runner.sqlite"))).toBe(true);
  expect(await other.text()).toBe("vite");
});

/** Edge case: the running server is `vp dev`. */
test("the dev server answers a handoff on Vite's port", async () => {
  const root = temporaryFolder("uraeda-dev");
  process.env.URAEDA_REPO = fixtureRepo();
  process.env.URAEDA_DATA_DIR = temporaryFolder("uraeda-data");
  const handler = devHandler(root, { adapter: new FakeAdapter() });
  const server = createServer((req, res) => handler(req, res, () => res.end("vite")));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as { port: number };

  const response = await fetch(`http://127.0.0.1:${port}/open`, {
    body: JSON.stringify({ folder: temporaryFolder("uraeda-none"), given: false }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  const text = await response.text();
  server.close();
  await stopDevRuns();

  expect(response.status).toBe(200);
  expect((JSON.parse(text) as { url: string }).url).toBe("/");
});

/** An upload's body, as the UI sends it. */
function upload() {
  const body = new FormData();
  body.set("file", new File([readFileSync(fixture("images/desktop.png"))], "desktop.png"));
  return body;
}

test("the dev server serves a repository's image routes, its uploads in the data folder", async () => {
  const repo = fixtureRepo();
  const root = temporaryFolder("uraeda-dev");
  const data = temporaryFolder("uraeda-data");
  vi.stubEnv("URAEDA_REPO", repo);
  vi.stubEnv("URAEDA_DATA_DIR", data);
  const handler = devHandler(root, { adapter: new FakeAdapter() });
  const server = createServer((req, res) => handler(req, res, () => res.end("vite")));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as { port: number };
  const url = `http://127.0.0.1:${port}`;
  // Listed under its folder's name as the server starts in it.
  const started = await fetch(`${url}/raw/specs/drafts/git-listener.md`);
  const name = basename(repo);

  const response = await fetch(`${url}/r/${name}/attach?name=desktop.png&chat=1`, {
    body: upload(),
    method: "POST",
  });
  const outside = await fetch(`${url}/attach?name=desktop.png&chat=1`, {
    body: upload(),
    method: "POST",
  });
  server.close();
  await stopDevRuns();

  expect(started.status).toBe(200);
  const { id } = (await response.json()) as { id: string };
  expect(existsSync(join(data, "images", id))).toBe(true);
  // Outside a repository's prefix, the path is Vite's.
  expect(await outside.text()).toBe("vite");
});

test("vp dev sends preview paths and their sockets to the server", async () => {
  const repo = fixtureRepo();
  addStoryFeature(repo);
  vi.stubEnv("URAEDA_REPO", repo);
  vi.stubEnv("URAEDA_DATA_DIR", temporaryFolder("uraeda-data"));
  const handler = devHandler(temporaryFolder("uraeda-dev"), { adapter: new FakeAdapter() });
  const server = createServer((req, res) => handler(req, res, () => res.end("vite")));
  server.on("upgrade", devUpgrade());
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  // Its Storybook stops even when the test fails.
  onTestFinished(async () => {
    server.closeAllConnections();
    server.close();
    await stopDevRuns();
  });
  const { port } = server.address() as { port: number };
  const url = `http://127.0.0.1:${port}`;
  // The first request starts the dev server's server, whose runner then views the checkout.
  await fetch(`${url}/r/${basename(repo)}/raw/specs/README.md`);
  const previews = (await devPreviews(port))!;
  const base = `/r/${basename(repo)}/preview/${(await devFrames(port))!.current()}/${STORY_FEATURE}/`;
  const checkout = await checkoutOf(join(repo, ".worktrees", STORY_FEATURE), base);
  previews.view(checkout);
  await ready(previews, checkout);

  const echo = await fetch(`${url}${base}__echo`, { headers: { origin: "null" } });

  expect(((await echo.json()) as { path: string }).path).toBe("/__echo");
  expect(await socketOpens(`${url}${base}storybook-server-channel`, { origin: "null" })).toBe(true);
});

test("vp dev refuses an upgrade to a target that is not a URL, and keeps answering", async () => {
  const server = createServer((_req, res) => res.end("vite"));
  server.on("upgrade", devUpgrade());
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  onTestFinished(() => {
    server.closeAllConnections();
    server.close();
  });
  const { port } = server.address() as { port: number };

  const answer = await rawUpgrade(port, "//[");

  expect(answer).toMatch(/^HTTP\/1\.1 400 /);
  expect(await (await fetch(`http://127.0.0.1:${port}/`)).text()).toBe("vite");
});
