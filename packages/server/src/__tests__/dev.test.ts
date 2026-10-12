import { createServer } from "node:http";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "vite-plus/test";
import { devHandler, devServer, stopDevRuns } from "../dev.ts";
import { loadEnv } from "../env.ts";
import { FakeAdapter } from "../runner/fake.ts";
import { fixtureRepo } from "./helpers.ts";

const saved = process.env.URAEDA_REPO;
afterEach(() => {
  if (saved === undefined) {
    delete process.env.URAEDA_REPO;
  } else {
    process.env.URAEDA_REPO = saved;
  }
});

/** US6.3 */
test("vp dev listens on 127.0.0.1:4310 only, by default", () => {
  const root = mkdtempSync(join(tmpdir(), "uraeda-dev-"));

  expect(devServer(loadEnv(root, {}))).toEqual({
    host: "127.0.0.1",
    port: 4310,
    strictPort: true,
    allowedHosts: [],
  });
});

test("vp dev accepts the hosts listed in .env", () => {
  const root = mkdtempSync(join(tmpdir(), "uraeda-dev-"));
  writeFileSync(join(root, ".env"), "URAEDA_ALLOWED_HOSTS=mac.tail1234.ts.net\n");

  expect(devServer(loadEnv(root, {})).allowedHosts).toEqual(["mac.tail1234.ts.net"]);
});

/** US6.4 */
test("the server in vp dev reads URAEDA_REPO", async () => {
  const repo = fixtureRepo();
  const root = mkdtempSync(join(tmpdir(), "uraeda-dev-"));
  const data = mkdtempSync(join(tmpdir(), "uraeda-data-"));
  writeFileSync(join(root, ".env"), `URAEDA_REPO=${repo}\nURAEDA_DATA_DIR=${data}\n`);
  delete process.env.URAEDA_REPO;
  const handler = devHandler(root, { adapter: new FakeAdapter() });
  const server = createServer((req, res) => handler(req, res, () => res.end("vite")));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as { port: number };

  const response = await fetch(`http://127.0.0.1:${port}/fate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      version: 1,
      operations: [
        { id: "1", kind: "byId", type: "Workspace", ids: ["workspace"], select: ["root"] },
        { id: "2", kind: "byId", type: "Runner", ids: ["runner"], select: ["available"] },
      ],
    }),
  });
  const other = await fetch(`http://127.0.0.1:${port}/index.html`);
  server.close();
  await stopDevRuns();

  const body = (await response.json()) as {
    results: Array<{ data: Array<{ root?: string; available?: boolean }> }>;
  };
  expect(body.results[0].data[0].root).toBe(repo);
  // The runner, shared by the dev server's apps, keeps its cache in the data folder.
  expect(body.results[1].data[0].available).toBe(true);
  expect(existsSync(join(data, "runner.sqlite"))).toBe(true);
  expect(await other.text()).toBe("vite");
});
