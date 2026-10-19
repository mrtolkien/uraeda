// @vitest-environment node
// Flow: Uraeda's own Storybook, whose stories read a fixture repository through the server's fate
// endpoint. A sandboxed frame's GETs are turned back into the POSTs fate sends, and reach the
// fixture's endpoint alone: another site, another repository, and a write to the list are refused.
import { createServer, request, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { realpathSync } from "node:fs";
import { addRepository, readRepositories } from "uraeda-binding";
import { fixtureRepo } from "uraeda-binding/test-utils";
import { reloadRepositories, stopDevRuns } from "uraeda-server/dev";
import type { ViteDevServer } from "vite-plus";
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { fixtureServer } from "../../.storybook/fixture.ts";

type Middleware = (req: IncomingMessage, res: ServerResponse, next: () => void) => void;

/** A story's sandboxed frame's headers, and another site's. */
const FRAME = { origin: "null", "sec-fetch-site": "cross-site" };
const EVIL = { origin: "https://evil.example", "sec-fetch-site": "cross-site" };

let address = "";
let close = () => {};

beforeAll(async () => {
  // Storybook's server, as far as the fixture's plugins use it: its middlewares, in order.
  const stack: Array<Middleware> = [];
  const vite = { httpServer: null, middlewares: { use: (fn: Middleware) => stack.push(fn) } };
  for (const plugin of fixtureServer()) {
    const hook = plugin.configureServer;
    if (typeof hook === "function") {
      await hook.call({} as never, vite as unknown as ViteDevServer);
    }
  }
  const http = createServer((req, res) => {
    let index = 0;
    const next = () => {
      const middleware = stack[index++];
      if (middleware) {
        middleware(req, res, next);
      } else {
        res.statusCode = 404;
        res.end();
      }
    };
    next();
  });
  await new Promise<void>((resolve) => http.listen(0, "127.0.0.1", resolve));
  address = `http://127.0.0.1:${(http.address() as AddressInfo).port}`;
  close = () => http.close();
});

afterAll(async () => {
  await stopDevRuns();
  close();
});

/** A GET of `path` with `headers`: its status and body; a live stream answers its status alone. */
function get(path: string, headers: Record<string, string> = {}) {
  return new Promise<{ body: string; status: number }>((resolve, reject) => {
    const sent = request(`${address}${path}`, { headers }, (response) => {
      if (response.headers["content-type"]?.includes("text/event-stream")) {
        resolve({ body: "", status: response.statusCode ?? 0 });
        response.destroy();
        return;
      }
      let body = "";
      response.on("data", (chunk: Buffer) => (body += chunk.toString()));
      response.on("end", () => resolve({ body, status: response.statusCode ?? 0 }));
    });
    sent.on("error", reject);
    sent.end();
  });
}

/** fate's operations, as a frame sends them in the query of a GET. */
const asQuery = (operation: Record<string, unknown>) =>
  `?request=${encodeURIComponent(JSON.stringify({ operations: [{ id: "0", ...operation }], version: 1 }))}`;

/** A request to add a repository to the server's list. */
const add = (folder: string) =>
  asQuery({ input: { folder }, kind: "mutation", name: "repositories.add", select: ["rows.name"] });

/** A request to write a priority. */
const write = asQuery({
  input: { hash: "", section: "Now", text: "Reached" },
  kind: "mutation",
  name: "priorities.add",
  select: ["id"],
});

/** The folders of the server's list. */
async function listed(): Promise<Array<string>> {
  return (await readRepositories(process.env.URAEDA_DATA_DIR!)).map((row) => row.path);
}

test("the fixture's endpoint is read through a GET from a sandboxed frame", async () => {
  const read = asQuery({ ids: ["priorities"], kind: "byId", select: ["id"], type: "Priorities" });

  const { body, status } = await get(`/r/fixture/fate${read}`, FRAME);

  expect(status).toBe(200);
  expect((JSON.parse(body) as { results: Array<{ ok: boolean }> }).results.every((r) => r.ok)).toBe(
    true,
  );
});

test("another site's GET adds no repository, and its live stream is refused", async () => {
  const scratch = fixtureRepo();

  expect((await get(`/fate${add(scratch)}`, EVIL)).status).toBe(403);
  expect((await get("/fate/live", EVIL)).status).toBe(403);
  expect(await listed()).not.toContain(realpathSync(scratch));
});

test("the frame cannot change the list, nor reach any endpoint but the fixture's", async () => {
  const scratch = fixtureRepo();
  const { body } = await get(`/r/fixture/fate${add(scratch)}`, FRAME);
  expect((JSON.parse(body) as { results: Array<{ ok: boolean }> }).results.some((r) => r.ok)).toBe(
    false,
  );
  expect(await listed()).not.toContain(realpathSync(scratch));

  // The user's own repository, were it listed in the data folder, is out of the frame's reach.
  const { repository } = await addRepository(process.env.URAEDA_DATA_DIR!, fixtureRepo());
  await reloadRepositories();
  for (const path of [
    `/r/${repository.name}/fate`,
    "/r/%66ixture/fate",
    `/r/${repository.name}/raw/specs/PRIORITIES.md`,
  ]) {
    expect((await get(`${path}${write}`, FRAME)).status, path).toBe(403);
  }
});
