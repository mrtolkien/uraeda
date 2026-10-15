// The preview proxy: the server on a port, its upgrades too, with the fake preview behind it.
import { createServer } from "node:http";
import { basename, join } from "node:path";
import { getRequestListener } from "@hono/node-server";
import { expect, onTestFinished, test } from "vite-plus/test";
import {
  addStoryFeature,
  fixtureRepo,
  previewStarts,
  STORY_FEATURE,
  temporaryFolder,
} from "uraeda-binding/test-utils";
import { FakeAdapter } from "../../runner/fake.ts";
import { startServer } from "../../server.ts";
import { checkoutOf, ready, socketOpens, WAIT } from "./helpers.ts";

const binding = await import("uraeda-binding");

/**
 * The server on a free port, its requests and upgrades, in a repository with the test feature,
 * whose Storybook is viewed and ready: its base path, its origin, and the fake's log of starts.
 * Everything is closed after the test.
 */
async function runningPreview() {
  const repo = fixtureRepo();
  const { log } = addStoryFeature(repo);
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
  return { base, log: log!, name: basename(repo), origin: `http://127.0.0.1:${port}` };
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
  expect(response.headers.get("content-security-policy")).toBe(
    "sandbox allow-scripts allow-popups; frame-ancestors 'self'",
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
