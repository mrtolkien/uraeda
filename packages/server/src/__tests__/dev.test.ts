import { createServer } from "node:http";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "vite-plus/test";
import { devHandler, devServer, stopDevRuns } from "../dev.ts";
import { loadEnv } from "../env.ts";
import { FakeAdapter } from "../runner/fake.ts";
import { fixture, fixtureRepo } from "./helpers.ts";
import { temporaryFolder } from "uraeda-binding/test-utils";

// The browser project's setup sets both for the whole test run.
const saved = {
  URAEDA_DATA_DIR: process.env.URAEDA_DATA_DIR,
  URAEDA_REPO: process.env.URAEDA_REPO,
};
afterEach(() => {
  for (const [name, value] of Object.entries(saved)) {
    if (value === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = value;
    }
  }
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
  delete process.env.URAEDA_REPO;
  delete process.env.URAEDA_DATA_DIR;
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

test("the dev server's apps share the data folder of their session manager", async () => {
  const [first, second] = [fixtureRepo(), fixtureRepo()];
  const root = mkdtempSync(join(tmpdir(), "uraeda-dev-"));
  const [data, later] = [
    mkdtempSync(join(tmpdir(), "uraeda-data-")),
    mkdtempSync(join(tmpdir(), "uraeda-data-")),
  ];
  process.env.URAEDA_REPO = first;
  process.env.URAEDA_DATA_DIR = data;
  const handler = devHandler(root, { adapter: new FakeAdapter() });
  const server = createServer((req, res) => handler(req, res, () => res.end("vite")));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as { port: number };
  const url = `http://127.0.0.1:${port}`;
  const started = await fetch(`${url}/raw/specs/drafts/git-listener.md`);
  // A second repository's app, created after the data folder's setting changed.
  process.env.URAEDA_REPO = second;
  process.env.URAEDA_DATA_DIR = later;
  const body = new FormData();
  body.set("file", new File([readFileSync(fixture("images/desktop.png"))], "desktop.png"));

  const response = await fetch(`${url}/attach?name=desktop.png&chat=1`, { method: "POST", body });
  server.close();
  await stopDevRuns();

  expect(started.status).toBe(200);
  const { id } = (await response.json()) as { id: string };
  expect(existsSync(join(data, "images", id))).toBe(true);
  expect(existsSync(join(later, "images"))).toBe(false);
});
