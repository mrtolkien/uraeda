// The owner's sign-in: the sign-in decision's rules on the key, the sessions, and failures.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { port, signInCookie, testApp } from "../__tests__/helpers.ts";
import { SignInStore } from "../sign-in/store.ts";

const HOST_TOKEN = "the-host-token";
const DAY = 24 * 60 * 60 * 1000;

const served = () => testApp(undefined, { hostToken: HOST_TOKEN, signIn: true });
type Served = Awaited<ReturnType<typeof served>>;

const url = (path: string) => `http://127.0.0.1:${port}${path}`;

/** Whether the cookie is a session: a signed-in request answers 204, a signed-out one 401. */
const signedIn = async ({ app }: Served, cookie: string) =>
  (await app.request(url("/session"), { headers: { cookie } })).status === 204;

const post = ({ app }: Served, path: string, body: unknown, headers: Record<string, string> = {}) =>
  app.request(url(path), {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json", ...headers },
    method: "POST",
  });

const cookieOf = (response: Response) => response.headers.get("set-cookie");

/** The text of every file of a folder, to look for what must never be written there. */
function filesIn(folder: string): Array<string> {
  return readdirSync(folder, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => readFileSync(join(entry.parentPath, entry.name), "latin1"));
}

test("the key signs a device in, and neither the key nor a session is stored as it is", async () => {
  const server = await served();
  const { app, dataDir, signIn } = server;

  const cookie = await signInCookie(app, signIn.key);

  expect(await signedIn(server, cookie)).toBe(true);
  const secret = cookie.split("=")[1]!.split(".")[1]!;
  const stored = filesIn(dataDir);
  expect(stored.length).toBeGreaterThan(0);
  for (const text of stored) {
    expect(text).not.toContain(signIn.key);
    expect(text).not.toContain(secret);
  }
});

test("a session is found again by a store opened on the same file", async () => {
  const server = await served();
  const cookie = await server.signIn.signedIn();

  const reopened = SignInStore.open(server.dataDir, () => server.signIn.clock.now);

  expect(reopened.key).toBeUndefined();
  expect(reopened.store.findSession(cookie.split("=")[1])).toBeDefined();
});

test("a session ends 30 days after its last use, and a use renews it", async () => {
  const server = await served();
  const { clock } = server.signIn;
  const used = await server.signIn.signedIn();
  const idle = await server.signIn.signedIn();

  clock.now += 29 * DAY;
  expect(await signedIn(server, used)).toBe(true);
  clock.now += 29 * DAY;
  // Used 29 days ago, so it lives; the one nobody used for 58 days does not.
  expect(await signedIn(server, used)).toBe(true);
  expect(await signedIn(server, idle)).toBe(false);
});

test("signing out ends the device's session and its live stream, and no other device's", async () => {
  const server = await served();
  const { app, name } = server;
  const mine = await server.signIn.signedIn();
  const other = await server.signIn.signedIn();
  const stream = await app.request(url(`/r/${name}/fate/live?connectionId=c1`), {
    headers: { accept: "text/event-stream", cookie: mine },
  });
  expect(stream.status).toBe(200);
  const reader = stream.body!.getReader();
  await reader.read();

  const out = await app.request(url("/session"), { headers: { cookie: mine }, method: "DELETE" });
  expect(out.status).toBe(204);

  // The stream ends: reading it to its end returns, which it never does while the session lives.
  while (!(await reader.read().catch(() => ({ done: true }))).done) {
    // Drained.
  }
  expect(await signedIn(server, mine)).toBe(false);
  expect(await signedIn(server, other)).toBe(true);
});

test("signing out everywhere, and a new key, end every session", async () => {
  const server = await served();
  const { app, signIn } = server;
  const first = await signIn.signedIn();
  const second = await signIn.signedIn();

  await app.request(url("/sessions"), { headers: { cookie: first }, method: "DELETE" });
  expect([await signedIn(server, first), await signedIn(server, second)]).toEqual([false, false]);

  const device = await signIn.signedIn();
  const renewed = await post(server, "/session/key", {}, { authorization: `Bearer ${HOST_TOKEN}` });
  const { key } = (await renewed.json()) as { key: string };
  expect(await signedIn(server, device)).toBe(false);
  expect((await post(server, "/session", { key: signIn.key })).status).toBe(401);
  expect((await post(server, "/session", { key })).status).toBe(204);
});

test("only the host's token makes a new key", async () => {
  const server = await served();
  const device = await server.signIn.signedIn();

  const answers = await Promise.all([
    post(server, "/session/key", {}),
    post(server, "/session/key", {}, { cookie: device }),
    post(server, "/session/key", {}, { authorization: "Bearer another-token" }),
  ]);

  expect(answers.map((answer) => answer.status)).toEqual([401, 401, 401]);
  expect(await signedIn(server, device)).toBe(true);
});

test("a wrong key is slowed, never locks the owner out, and is logged without the key", async () => {
  const server = await served();
  const { key, lines, waits } = server.signIn;

  for (let attempt = 0; attempt < 8; attempt++) {
    expect((await post(server, "/session", { key: `wrong-${attempt}` })).status).toBe(401);
  }

  // Each failure waited, so a guess is never cheap; the right key still signs in.
  expect(waits).toHaveLength(8);
  expect(waits.every((wait) => wait > 0)).toBe(true);
  expect(lines).toHaveLength(8);
  expect(lines.join("\n")).not.toContain("wrong-0");
  expect((await post(server, "/session", { key })).status).toBe(204);
});

test("a body larger than a key is refused before anyone is signed in", async () => {
  const server = await served();

  const answer = await post(server, "/session", { key: "k".repeat(64 * 1024) });

  expect(answer.status).toBe(413);
  expect(server.signIn.lines).toEqual([]);
});

test("a one-time link signs in once, within its minutes, and leads only to this server", async () => {
  const server = await served();
  const { app, signIn } = server;
  const open = (link: string) => app.request(url(link));

  const first = await open(signIn.links.make("/r/todo/"));
  expect(first.status).toBe(303);
  expect(first.headers.get("location")).toBe("/r/todo/");
  expect(cookieOf(first)).toBeTruthy();

  const link = signIn.links.make("/");
  expect(cookieOf(await open(link))).toBeTruthy();
  expect(cookieOf(await open(link))).toBeNull();

  const stale = signIn.links.make("/");
  signIn.clock.now += 6 * 60 * 1000;
  expect(cookieOf(await open(stale))).toBeNull();

  // A target on another site is never followed, signed in or not.
  for (const to of ["//evil.example", "https://evil.example/", String.raw`/\evil.example`]) {
    const answer = await open(`/session/not-a-link?to=${encodeURIComponent(to)}`);
    expect(answer.headers.get("location")).toBe("/");
  }
});
