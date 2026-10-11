import { createServer } from "node:http";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "vite-plus/test";
import { devHandler, devServer } from "../dev.ts";
import { loadEnv } from "../env.ts";
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
  writeFileSync(join(root, ".env"), `URAEDA_REPO=${repo}\n`);
  delete process.env.URAEDA_REPO;
  const handler = devHandler(root);
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
      ],
    }),
  });
  const other = await fetch(`http://127.0.0.1:${port}/index.html`);
  server.close();

  const body = (await response.json()) as { results: Array<{ data: Array<{ root: string }> }> };
  expect(body.results[0].data[0].root).toBe(repo);
  expect(await other.text()).toBe("vite");
});
