// Who may reach the server: the sign-in decision's "every request carries a session" and the stack
// decision's "only Uraeda's own pages and the frames it gave a secret". Statuses only: no text.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { temporaryFolder } from "uraeda-binding/test-utils";
import { port, testApp } from "../__tests__/helpers.ts";

const HOST_TOKEN = "the-host-token";
const TAILNET = "mac.tail1234.ts.net";
const OWN = `127.0.0.1:${port}`;

/** A signed-in app serving a built UI, with a host token. */
async function closedApp(options: Parameters<typeof testApp>[1] = {}) {
  const webRoot = temporaryFolder("uraeda-web");
  writeFileSync(join(webRoot, "index.html"), "<!doctype html><title>Uraeda</title>");
  return testApp(undefined, { ...options, hostToken: HOST_TOKEN, signIn: true, webRoot });
}

type Served = Awaited<ReturnType<typeof closedApp>>;

const send = (
  { app }: Served,
  method: string,
  path: string,
  headers: Record<string, string> = {},
  host = OWN,
) =>
  app.request(`http://${host}${path}`, {
    body: method === "GET" ? undefined : JSON.stringify({ operations: [], version: 1 }),
    headers: { "content-type": "application/json", ...headers },
    method,
  });

/** Every route the app answers, as a request path: parameters and wildcards stand for a segment. */
function routePaths({ app, name }: Served): Array<string> {
  const paths = app.routes
    .map((route) => route.path)
    .filter((path) => !["*", "/*"].includes(path))
    .map((path) =>
      path
        .replaceAll(":name", name)
        .replaceAll(/:[^/]+/g, "x")
        .replaceAll("*", "x"),
    );
  return [...new Set(paths)];
}

/** The sign-in routes answer the signed out by their own rules: the sign-in flow checks them. */
const signInRoute = (path: string) => /^\/sessions?(\/|$)/.test(path);

const METHODS = ["GET", "POST", "PUT", "DELETE"];

test("every route of the app is closed to a request without a session", async () => {
  const served = await closedApp();
  const paths = routePaths(served).filter((path) => !signInRoute(path));
  expect(paths.length).toBeGreaterThan(10);

  const open: Array<string> = [];
  for (const path of paths) {
    for (const method of METHODS) {
      if ((await send(served, method, path)).status !== 401) {
        open.push(`${method} ${path}`);
      }
    }
  }

  expect(open, "a route a request without a session reaches").toEqual([]);
});

test("every closed route is reached by a request with a session", async () => {
  const served = await closedApp();
  const cookie = await served.signIn.signedIn();
  const paths = routePaths(served).filter((path) => !signInRoute(path));

  const refused: Array<string> = [];
  for (const path of paths) {
    for (const method of METHODS) {
      const { status } = await send(served, method, path, { cookie });
      if (status === 401 || status === 403) {
        refused.push(`${method} ${path}`);
      }
    }
  }

  expect(refused, "a route a signed-in request does not reach").toEqual([]);
});

test("the built UI, the host's own routes, and frames with the secret need no session", async () => {
  const served = await closedApp();
  const { frames, name } = served;

  // The UI's files, and every page route of the single-page app.
  expect((await send(served, "GET", "/")).status).toBe(200);
  expect((await send(served, "GET", `/r/${name}/f/anything`)).status).toBe(200);
  // The host's `uraeda`, with its token: past the check, to its own answer.
  const handed = await send(served, "POST", "/open", { authorization: `Bearer ${HOST_TOKEN}` });
  expect(handed.status).not.toBe(401);
  // A sandboxed frame has no cookie: the secret in its path is its session.
  const frame = (secret: string) =>
    send(served, "GET", `/r/${name}/preview/${secret}/folder/iframe.html`, { origin: "null" });
  expect((await frame(frames.current())).status).not.toBe(401);
  expect((await frame(frames.current())).status).not.toBe(404);
  expect((await frame("an-old-secret")).status).toBe(404);
});

test("another token, an address, or a proxy header is no session", async () => {
  const served = await closedApp();
  const { name } = served;

  const others: Array<Record<string, string>> = [
    { authorization: "Bearer another-token" },
    { "x-forwarded-for": "127.0.0.1" },
    { forwarded: "for=127.0.0.1", "x-forwarded-host": OWN },
    { authorization: `Bearer ${HOST_TOKEN}` },
  ];
  for (const headers of others) {
    // The host token opens the host's own routes and no other, `/fate` included.
    expect((await send(served, "POST", `/r/${name}/fate`, headers)).status).toBe(401);
  }
  expect(
    (await send(served, "POST", "/open", { authorization: "Bearer another-token" })).status,
  ).toBe(401);
});

/** What the guard answers on a signed-in request: refused, or let through to the route. */
const refusal = (status: number) => status === 403 || status === 404;

type Row = [what: string, host: string, headers: Record<string, string>, refused: boolean];

const ROWS: Array<Row> = [
  ["the server's address", OWN, {}, false],
  ["localhost", `localhost:${port}`, {}, false],
  ["its own origin", OWN, { origin: `http://${OWN}` }, false],
  ["a dev server's origin, allowed at start", OWN, { origin: "http://localhost:5173" }, false],
  ["its own page, with no origin", OWN, { "sec-fetch-site": "same-origin" }, false],
  ["a typed address", OWN, { "sec-fetch-site": "none" }, false],
  ["another host name", `evil.example:${port}`, {}, true],
  ["the address without its port", "127.0.0.1", {}, true],
  ["another origin", OWN, { origin: "https://evil.example" }, true],
  ["the null origin of a sandboxed page", OWN, { origin: "null" }, true],
  ["a cross-site request with no origin", OWN, { "sec-fetch-site": "cross-site" }, true],
  ["a sibling site's request with no origin", OWN, { "sec-fetch-site": "same-site" }, true],
  ["a host name not allowed", TAILNET, { origin: `https://${TAILNET}` }, true],
];

for (const [method, path] of [
  ["POST", "/fate"],
  ["POST", "/r/<name>/fate"],
  ["POST", "/r/<name>/attach?chat=1"],
] as const) {
  test.each(ROWS)(`${method} ${path} from %s`, async (_, host, headers, refused) => {
    const served = await closedApp();
    const cookie = await served.signIn.signedIn();

    const { status } = await send(
      served,
      method,
      path.replace("<name>", served.name),
      { cookie, ...headers },
      host,
    );

    // A signed-in request is refused by the guard alone: a request it passes is the route's.
    expect(refusal(status)).toBe(refused);
  });
}

test("a read from another site is no write: the guard refuses a write without an origin only", async () => {
  const served = await closedApp();
  const cookie = await served.signIn.signedIn();
  const headers = { cookie, "sec-fetch-site": "cross-site" };

  const read = await send(served, "GET", `/r/${served.name}/raw/specs/PRIORITIES.md`, headers);
  const write = await send(served, "POST", `/r/${served.name}/fate`, headers);

  expect(read.status).not.toBe(403);
  expect(write.status).toBe(403);
});

/** Runs a settings mutation as the signed-in owner. */
const mutate = (served: Served, cookie: string, name: string, host: string) =>
  served.app.request(`http://${OWN}/fate`, {
    body: JSON.stringify({
      operations: [{ id: "0", input: { name: host }, kind: "mutation", name, select: ["id"] }],
      version: 1,
    }),
    headers: { "content-type": "application/json", cookie },
    method: "POST",
  });

test("a host name allowed in the settings passes from the next request, until it is removed", async () => {
  const served = await closedApp();
  const cookie = await served.signIn.signedIn();
  const call = (host: string) => send(served, "POST", "/fate", {}, host);
  expect((await call(TAILNET)).status).toBe(403);

  // Past the guard it meets the session check: no cookie, no answer.
  expect((await mutate(served, cookie, "settings.addHost", TAILNET)).status).toBe(200);
  expect((await call(TAILNET)).status).toBe(401);
  expect((await call("evil.example")).status).toBe(403);

  expect((await mutate(served, cookie, "settings.removeHost", TAILNET)).status).toBe(200);
  expect((await call(TAILNET)).status).toBe(403);
});
