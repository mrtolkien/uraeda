// @vitest-environment node
// Uraeda's server in its own Storybook, behind the middleware that turns fate's GETs back into POSTs
// (R4): it reaches the fixture's endpoint only, and its list stays the fixture's (see the rulings).
import { createServer, type IncomingMessage, request, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { realpathSync } from "node:fs";
import { addRepository, readRepositories } from "uraeda-binding";
import { fixtureRepo } from "uraeda-binding/test-utils";
import { reloadRepositories, stopDevRuns } from "uraeda-server/dev";
import type { ViteDevServer } from "vite-plus";
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { fixtureServer } from "../../.storybook/fixture.ts";

type Middleware = (req: IncomingMessage, res: ServerResponse, next: () => void) => void;

/** A sandboxed frame's headers, as a story embedded in Uraeda sends them. */
const FRAME = { origin: "null", "sec-fetch-site": "cross-site" };
/** Another site's headers. */
const EVIL = { origin: "https://evil.example", "sec-fetch-site": "cross-site" };

let address = "";
let close = () => {};

beforeAll(async () => {
  // Storybook's server, as far as the plugins use it: its middlewares, in order.
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

/** A GET of `path` with `headers`: its status and body, or its status alone for a stream. */
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

/** fate's request of one operation, as the preview sends it in `?request=`. */
const asQuery = (operation: Record<string, unknown>) =>
  `?request=${encodeURIComponent(JSON.stringify({ operations: [{ id: "0", ...operation }], version: 1 }))}`;

const add = (folder: string) =>
  asQuery({ input: { folder }, kind: "mutation", name: "repositories.add", select: ["rows.name"] });

/** The folders of the server's list. */
async function listed(): Promise<Array<string>> {
  return (await readRepositories(process.env.URAEDA_DATA_DIR!)).map((row) => row.path);
}

/** The first result of a fate answer. */
const first = (body: string) =>
  (JSON.parse(body) as { results: Array<{ error?: { message: string }; ok: boolean }> }).results[0];

test("the fixture's own endpoint reads through a GET from a sandboxed frame", async () => {
  const read = asQuery({ ids: ["priorities"], kind: "byId", select: ["id"], type: "Priorities" });

  const { body, status } = await get(`/r/fixture/fate${read}`, FRAME);

  expect(status).toBe(200);
  expect(first(body)?.ok).toBe(true);
});

test("a cross-site GET of the global endpoint is refused, and adds no repository", async () => {
  const scratch = fixtureRepo();

  const { status } = await get(`/fate${add(scratch)}`, EVIL);

  expect(status).toBe(403);
  expect(await listed()).not.toContain(realpathSync(scratch));
});

test("the fixture's endpoint cannot change the list", async () => {
  const scratch = fixtureRepo();

  const { body } = await get(`/r/fixture/fate${add(scratch)}`, FRAME);

  expect(first(body)?.error?.message).toBe("refused: this server's list is locked");
  expect(await listed()).not.toContain(realpathSync(scratch));
});

test.each([
  ["another listed repository's endpoint", "/r/<other>/fate"],
  ["the fixture's endpoint, encoded", "/r/%66ixture/fate"],
  ["a path that is not fate's", "/r/<other>/raw/specs/PRIORITIES.md"],
])("a GET carrying a request to %s is refused", async (_, path) => {
  // The user's own repository, were it listed in the data folder.
  const { repository } = await addRepository(process.env.URAEDA_DATA_DIR!, fixtureRepo());
  await reloadRepositories();
  const write = asQuery({
    input: { hash: "", section: "Now", text: "Reached" },
    kind: "mutation",
    name: "priorities.add",
    select: ["id"],
  });

  const { status } = await get(`${path.replace("<other>", repository.name)}${write}`, FRAME);

  expect(status).toBe(403);
});

test("another site's GET of a live stream keeps its Origin, and is refused", async () => {
  const { status } = await get("/fate/live", EVIL);

  expect(status).toBe(403);
});
