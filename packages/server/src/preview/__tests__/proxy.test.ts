// The preview proxy: the server on a port, its upgrades too, with the fake preview behind it.
import { createServer, type IncomingHttpHeaders, request as httpRequest } from "node:http";
import { basename, join } from "node:path";
import { getRequestListener } from "@hono/node-server";
import { expect, onTestFinished, test } from "vite-plus/test";
import {
  addStoryFeature,
  type FakeMode,
  fixtureRepo,
  previewStarts,
  STORY_FEATURE,
  temporaryFolder,
} from "uraeda-binding/test-utils";
import { FakeAdapter } from "../../runner/fake.ts";
import { startServer } from "../../server.ts";
import { SANDBOX } from "../proxy.ts";
import { checkoutOf, ready, socketOpens, upgradeStatus, WAIT } from "./helpers.ts";

const binding = await import("uraeda-binding");

/**
 * The server on a free port, its requests and upgrades, in a repository with the test feature,
 * whose Storybook, the fake preview in `mode`, is viewed and ready: its base path, its origin, the
 * fake's log of starts, and the server's runner. Everything is closed after the test.
 */
async function runningPreview(mode: FakeMode = "ok") {
  const repo = fixtureRepo();
  const { log } = addStoryFeature(repo, { preview: { mode } });
  const http = createServer();
  await new Promise<void>((resolve) => http.listen(0, "127.0.0.1", resolve));
  const { port } = http.address() as { port: number };
  const server = await startServer({
    adapter: new FakeAdapter(),
    allowedHosts: [],
    allowOrigins: [],
    binding,
    dataDir: temporaryFolder("uraeda-data"),
    given: false,
    port,
    repo,
  });
  http.on("request", getRequestListener(server.app.fetch));
  http.on("upgrade", server.upgrade);
  onTestFinished(async () => {
    http.closeAllConnections();
    await new Promise<void>((resolve) => http.close(() => resolve()));
    await server.stop();
  });
  const base = `/r/${basename(repo)}/preview/${STORY_FEATURE}/`;
  const checkout = await checkoutOf(join(repo, ".worktrees", STORY_FEATURE), base);
  server.previews.view(checkout);
  await ready(server.previews, checkout);
  return {
    base,
    log: log!,
    name: basename(repo),
    origin: `http://127.0.0.1:${port}`,
    previews: server.previews,
  };
}

/** A GET of `url` with `headers`, through Node's client, which sends `Connection` as given. */
function get(
  url: string,
  headers: Record<string, string> = {},
): Promise<{ body: string; headers: IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    const request = httpRequest(url, { headers }, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk: string) => (body += chunk));
      response.on("end", () => resolve({ body, headers: response.headers }));
    });
    request.on("error", reject);
    request.end();
  });
}

test("a read reaches Storybook without the path, with its own Host", async () => {
  const { base, origin } = await runningPreview();

  const echo = (await (
    await fetch(`${origin}${base}__echo`, { headers: { origin: "null" } })
  ).json()) as { host: string; path: string };

  expect(echo.path).toBe("/__echo");
  expect(echo.host).toMatch(/^127\.0\.0\.1:\d+$/);
  expect(echo.host).not.toBe(new URL(origin).host);
});

test("every response allows any origin, and is sandboxed", async () => {
  const { base, origin } = await runningPreview();

  const response = await fetch(
    `${origin}${base}iframe.html?id=sidebarhandle--dragging&viewMode=story`,
  );

  expect(response.status).toBe(200);
  expect(await response.text()).toContain("<h1>Dragging</h1>");
  expect(response.headers.get("access-control-allow-origin")).toBe("*");
  // No `frame-ancestors`: Storybook's own interface, sandboxed, frames its story, and `'self'`
  // refuses a sandboxed ancestor (R29).
  expect(response.headers.get("content-security-policy")).toBe(
    "sandbox allow-scripts allow-popups",
  );
});

test("Storybook's channel goes without the path or Origin; Vite's socket keeps its path", async () => {
  const { base, origin } = await runningPreview();

  expect(await socketOpens(`${origin}${base}storybook-server-channel`, { origin: "null" })).toBe(
    true,
  );
  expect(await socketOpens(`${origin}${base}`, { origin: "null", protocol: "vite-hmr" })).toBe(
    true,
  );
});

test("a write is refused", async () => {
  const { base, origin } = await runningPreview();

  for (const method of ["POST", "PUT"]) {
    const response = await fetch(`${origin}${base}__echo`, { body: "{}", method });
    expect(response.status).toBe(405);
  }
});

test("nothing running answers 503", async () => {
  const { base, log, name, origin } = await runningPreview();

  const other = await fetch(`${origin}/r/${name}/preview/main/iframe.html`);
  expect(other.status).toBe(503);
  expect(await other.text()).toBe("Storybook is not running for this branch.");

  process.kill(previewStarts(log)[0]!.pid, "SIGKILL");

  await expect.poll(async () => (await fetch(`${origin}${base}__echo`)).status, WAIT).toBe(503);
  const stopped = await fetch(`${origin}${base}__echo`);
  expect(await stopped.text()).toBe("Storybook is not running for this branch.");
});

/** Review focus 5 */
test("a response streams", async () => {
  const { base, origin } = await runningPreview();
  const response = await fetch(`${origin}${base}__events`);
  const reader = response.body!.getReader();

  const { value } = await reader.read();

  expect(new TextDecoder().decode(value)).toBe("data: first\n\n");
  await reader.cancel();
});

test("the path alone is sent to its slash", async () => {
  const { base, origin } = await runningPreview();

  const response = await fetch(`${origin}${base.slice(0, -1)}?x=1`, { redirect: "manual" });

  expect(response.status).toBe(301);
  expect(response.headers.get("location")).toBe(`${base}?x=1`);
});

test("an upgrade outside a preview path is closed", async () => {
  const { name, origin } = await runningPreview();

  expect(await socketOpens(`${origin}/r/${name}/fate/live`, {})).toBe(false);
  expect(await socketOpens(`${origin}/r/${name}/fate/live`, { origin: "null" })).toBe(false);
});

/** SC-004 */
test("an upgrade from another site is refused", async () => {
  const { base, origin } = await runningPreview();

  expect(
    await socketOpens(`${origin}${base}storybook-server-channel`, { origin: "https://evil.com" }),
  ).toBe(false);
});

test("an upgrade is a read only as a WebSocket GET", async () => {
  const { base, origin } = await runningPreview();
  const channel = `${origin}${base}storybook-server-channel`;

  expect(await upgradeStatus(channel, { method: "POST", origin: "null", upgrade: "foo" })).toBe(
    403,
  );
  expect(await upgradeStatus(channel, { method: "POST", upgrade: "websocket" })).not.toBe(101);
  expect(await upgradeStatus(channel, { upgrade: "foo" })).not.toBe(101);
});

test("storybook's cookies and site data stay out", async () => {
  const { base, origin } = await runningPreview();

  const response = await fetch(`${origin}${base}__headers`);

  expect(await response.text()).toBe("headers");
  expect(response.headers.get("set-cookie")).toBeNull();
  expect(response.headers.get("clear-site-data")).toBeNull();
});

test("headers named in Connection are removed", async () => {
  const { base, origin } = await runningPreview();

  const sent = await get(`${origin}${base}__echo`, { connection: "x-custom", "x-custom": "1" });
  const got = await get(`${origin}${base}__headers`);

  expect((JSON.parse(sent.body) as { headers: IncomingHttpHeaders }).headers).not.toHaveProperty(
    "x-custom",
  );
  expect(got.body).toBe("headers");
  expect(got.headers).not.toHaveProperty("x-custom");
});

test("the proxy's own answers are sandboxed", async () => {
  const { base, name, origin } = await runningPreview();

  const answers = [
    await fetch(`${origin}/r/${name}/preview/main/iframe.html`),
    await fetch(`${origin}${base.slice(0, -1)}`, { redirect: "manual" }),
    await fetch(`${origin}${base}__echo`, { body: "{}", method: "POST" }),
  ];

  expect(answers.map((answer) => answer.status)).toEqual([503, 301, 405]);
  for (const answer of answers) {
    expect(answer.headers.get("access-control-allow-origin")).toBe("*");
    expect(answer.headers.get("content-security-policy")).toBe(SANDBOX);
  }
});

test("a storybook that exits is failed at once", async () => {
  const { base, log, origin, previews } = await runningPreview("child");

  process.kill(previewStarts(log)[0]!.pid, "SIGKILL");

  await expect.poll(() => previews.state(base)?.state, WAIT).toBe("failed");
  const response = await fetch(`${origin}${base}__echo`);
  expect(response.status).toBe(503);
  expect(await response.text()).toBe("Storybook is not running for this branch.");
});
