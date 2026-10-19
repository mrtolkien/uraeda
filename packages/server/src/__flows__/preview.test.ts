// The preview: the stack decision's rules that a frame cannot write, the sign-in decision's rule
// that the frame secret changes with every session and reaches no process, and the server's rule
// that it stops what it runs. Real server on a port, real HTTP and sockets, the fake Storybook.
import { execFileSync } from "node:child_process";
import { expect, test } from "vite-plus/test";
import { previewStarts, temporaryFolder } from "uraeda-binding/test-utils";
import {
  alive,
  rawUpgrade,
  socketOpens,
  upgradeEcho,
  upgradeStatus,
  WAIT,
} from "../preview/__tests__/helpers.ts";
import { liveServer } from "./helpers.ts";

type Echo = { headers: Record<string, string>; host: string };

/** A frame's read, as a sandboxed page sends it. */
const frameGet = (url: string, headers: Record<string, string> = {}) =>
  fetch(url, { headers: { origin: "null", ...headers } });

test("a frame reads its Storybook, sandboxed, and the Storybook gets none of Uraeda's credentials", async () => {
  const { origin, view } = await liveServer();
  const base = await view();

  const story = await frameGet(`${origin}${base}iframe.html?id=sidebarhandle--dragging`);
  expect(story.status).toBe(200);
  const policy = story.headers.get("content-security-policy") ?? "";
  expect(policy).toMatch(/\bsandbox\b/);
  expect(policy).not.toMatch(/allow-same-origin/);
  expect(story.headers.get("access-control-allow-origin")).toBe("*");

  const seen = (await (
    await frameGet(`${origin}${base}__echo`, {
      authorization: "Bearer the-owner's-token",
      cookie: "uraeda=the-owner's-session",
    })
  ).json()) as Echo;
  expect(Object.keys(seen.headers)).not.toContain("cookie");
  expect(Object.keys(seen.headers)).not.toContain("authorization");
  expect(seen.host).not.toBe(new URL(origin).host);

  // What Storybook sets never reaches Uraeda's own origin.
  const given = await frameGet(`${origin}${base}__headers`);
  expect(given.headers.get("set-cookie")).toBeNull();
  expect(given.headers.get("clear-site-data")).toBeNull();
});

test("a frame cannot write: no method but a read reaches Storybook", async () => {
  const { origin, view } = await liveServer();
  const base = await view();

  // From a sandboxed frame the guard refuses a write; from anything else with the secret, the
  // proxy itself does: either way Storybook, which trusts what reaches it, never gets one.
  const senders: Array<Record<string, string>> = [{ origin: "null" }, {}];
  for (const headers of senders) {
    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
      const answer = await fetch(`${origin}${base}__echo`, {
        body: method === "DELETE" ? undefined : "{}",
        headers,
        method,
      });
      expect(answer.status, `${method} ${JSON.stringify(headers)}`).toBeGreaterThanOrEqual(403);
      expect(answer.status).toBeLessThan(500);
    }
  }
});

test("Storybook's channel is only ever a preview's, whatever page the frame asks for", async () => {
  const { origin, view } = await liveServer();
  const base = await view();
  const channel = `${origin}${base}storybook-server-channel`;

  for (const query of ["?token=t&page=manager", "?token=t", "?page=preview&token=t&page=manager"]) {
    const reached = await upgradeEcho(`${channel}${query}`);
    expect(reached.query).toEqual({ page: ["preview"], token: ["t"] });
  }
});

test("a socket opens only for a frame with the secret, from no other site, as a read", async () => {
  const { origin, server, view } = await liveServer();
  const base = await view();
  const channel = `${origin}${base}storybook-server-channel`;
  const stranger = channel.replace(server.frames.current(), "not-the-secret");

  expect(await socketOpens(channel, { origin: "null" })).toBe(true);
  expect(await socketOpens(stranger, { origin: "null" })).toBe(false);
  expect(await socketOpens(channel, { origin: "https://evil.example" })).toBe(false);
  expect(await upgradeStatus(channel, { method: "POST", origin: "null" })).not.toBe(101);
  expect(await upgradeStatus(channel, { origin: "null", upgrade: "something-else" })).not.toBe(101);
  // A target that is no URL is refused, and the server keeps answering.
  expect(await rawUpgrade(Number(new URL(origin).port), "//[")).not.toBe("");
  expect((await frameGet(`${origin}${base}__echo`)).status).toBe(200);
});

test("an address without the current secret does not exist", async () => {
  const { name, origin, server, view } = await liveServer();
  const base = await view();
  const secret = server.frames.current();
  const folder = base.split("/").at(-2)!;

  for (const path of [
    `/r/${name}/preview/${folder}/iframe.html`,
    `/r/${name}/preview/another-secret/${folder}/iframe.html`,
    `/r/${name}/mockups/${secret}x/specs/ui.html`,
  ]) {
    expect((await frameGet(`${origin}${path}`)).status, path).toBe(404);
  }
});

test("signing out replaces the secret: the old address ends and Storybook restarts under the new", async () => {
  const { log, name, origin, server, view } = await liveServer({ signIn: true });
  const signedIn = await fetch(`${origin}/session`, {
    body: JSON.stringify({ key: server.key }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  const cookie = signedIn.headers.get("set-cookie")!.split(";")[0]!;
  const before = await view();
  const [first] = previewStarts(log);
  expect((await frameGet(`${origin}${before}__echo`)).status).toBe(200);

  const out = await fetch(`${origin}/session`, { headers: { cookie }, method: "DELETE" });
  expect(out.status).toBe(204);

  const after = await view();
  expect(after).not.toBe(before);
  expect((await frameGet(`${origin}${before}__echo`)).status).toBe(404);
  expect((await frameGet(`${origin}${after}__echo`)).status).toBe(200);
  expect(previewStarts(log).at(-1)!.base).toContain(server.frames.current());
  expect(after).toContain(`/r/${name}/`);
  await expect.poll(() => alive(first!.pid), WAIT).toBe(false);
});

test("stopping the server stops its Storybooks, and every process they started", async () => {
  const { log, origin, server, view } = await liveServer({ mode: "child" });
  const base = await view();
  const group = groupOf(previewStarts(log)[0]!.pid);
  expect((await frameGet(`${origin}${base}__echo`)).status).toBe(200);
  expect(groupAlive(group)).toBe(true);

  await server.stop();

  // The whole group, and so the child the Storybook started, which a signal to the Storybook alone
  // would leave running.
  await expect.poll(() => groupAlive(group), WAIT).toBe(false);
});

test("a start ends the Storybooks a server that was killed left running", async () => {
  const dataDir = temporaryFolder("uraeda-data");
  const killed = await liveServer({ dataDir, mode: "child" });
  await killed.view();
  const group = groupOf(previewStarts(killed.log)[0]!.pid);
  expect(groupAlive(group)).toBe(true);

  // No stop for the first: it is gone as a crash leaves it, and a second start finds its record.
  await liveServer({ dataDir });

  await expect.poll(() => groupAlive(group), WAIT).toBe(false);
});

/** The process group a process belongs to: a Storybook's command runs in a group of its own. */
const groupOf = (pid: number) =>
  Number(execFileSync("ps", ["-o", "pgid=", "-p", String(pid)], { encoding: "utf8" }));

/** Whether any process of the group runs. */
function groupAlive(group: number): boolean {
  try {
    process.kill(-group, 0);
    return true;
  } catch {
    return false;
  }
}
