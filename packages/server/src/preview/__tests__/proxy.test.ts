// The preview proxy: the server on a port, its upgrades too, with the fake preview behind it.
import { type IncomingHttpHeaders, request as httpRequest } from "node:http";
import { expect, test } from "vite-plus/test";
import { previewStarts } from "uraeda-binding/test-utils";
import { SANDBOX } from "../proxy.ts";
import {
  rawUpgrade,
  runningPreview,
  socketOpens,
  upgradeEcho,
  upgradeStatus,
  WAIT,
} from "./helpers.ts";

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

test("Storybook's channel is only ever opened as a preview's, with its token", async () => {
  const { base, origin } = await runningPreview();
  const channel = `${origin}${base}storybook-server-channel`;

  for (const query of ["?token=t&page=manager", "?token=t", "?page=preview&token=t&page=manager"]) {
    const echo = await upgradeEcho(`${channel}${query}`);
    expect(echo.query).toEqual({ page: ["preview"], token: ["t"] });
  }
});

test("a write is refused", async () => {
  const { base, origin } = await runningPreview();

  for (const method of ["POST", "PUT"]) {
    const response = await fetch(`${origin}${base}__echo`, { body: "{}", method });
    expect(response.status).toBe(405);
  }
});

test("nothing running answers 503", async () => {
  const { base, log, name, origin, server } = await runningPreview();

  const other = await fetch(
    `${origin}/r/${name}/preview/${server.frames.current()}/main/iframe.html`,
  );
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

test("an upgrade to a target that is not a URL is refused, and the server keeps answering", async () => {
  const { base, origin, port } = await runningPreview();

  const answer = await rawUpgrade(port, "//[");

  expect(answer).toMatch(/^HTTP\/1\.1 400 /);
  expect((await fetch(`${origin}${base}__echo`, { headers: { origin: "null" } })).status).toBe(200);
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
  const { base, name, origin, server } = await runningPreview();

  const answers = [
    await fetch(`${origin}/r/${name}/preview/${server.frames.current()}/main/iframe.html`),
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
