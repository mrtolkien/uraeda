import { expect, test } from "vite-plus/test";
import { port, testApp } from "../../__tests__/helpers.ts";

const tailnet = "mac.tail1234.ts.net";
const local = `127.0.0.1:${port}`;

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** A signed-in app, its tailnet name listed. */
const signedApp = () => testApp(undefined, { allowedHosts: [tailnet], signIn: true });

type App = Awaited<ReturnType<typeof signedApp>>["app"];

/** A request to the app on `host`, the server's address by default, with a cookie if given. */
function send(
  app: App,
  method: string,
  path: string,
  {
    body,
    cookie,
    headers = {},
    host = local,
  }: Partial<Record<"cookie" | "host", string>> & {
    body?: unknown;
    headers?: Record<string, string>;
  } = {},
) {
  return app.request(`http://${host}${path}`, {
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: {
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...(cookie === undefined ? {} : { cookie }),
      ...headers,
    },
    method,
  });
}

/** An empty read of a repository's fate endpoint. */
const readFate = (app: App, name: string, cookie?: string, host?: string) =>
  send(app, "POST", `/r/${name}/fate`, { body: { operations: [], version: 1 }, cookie, host });

/** The `Cookie` header a `Set-Cookie` header sets. */
const cookieOf = (response: Response) => response.headers.get("set-cookie")!.split(";")[0];

/** US1.2 */
test("a request without a session gets 401 and no data", async () => {
  const { app, name } = await signedApp();

  const response = await readFate(app, name);

  expect(response.status).toBe(401);
  expect(await response.json()).toEqual({ error: "Sign in to Uraeda." });
});

/** US1.3, US1.7 */
test("the key signs in, with the cookie's attributes", async () => {
  const { app, name, signIn } = await signedApp();

  const secure = await send(app, "POST", "/session", { body: { key: signIn.key }, host: tailnet });
  const plain = await send(app, "POST", "/session", { body: { key: signIn.key } });

  expect(secure.status).toBe(204);
  expect(secure.headers.get("set-cookie")).toMatch(
    /^__Host-uraeda=[\w-]+\.[\w-]+; Max-Age=2592000; Path=\/; HttpOnly; Secure; SameSite=Lax$/,
  );
  expect(plain.status).toBe(204);
  expect(plain.headers.get("set-cookie")).toMatch(
    /^uraeda=[\w-]+\.[\w-]+; Max-Age=2592000; Path=\/; HttpOnly; SameSite=Lax$/,
  );
  expect((await readFate(app, name, cookieOf(plain))).status).toBe(200);
  expect((await readFate(app, name, cookieOf(secure), tailnet)).status).toBe(200);
  // Each name is read on its own kind of host only.
  expect((await readFate(app, name, cookieOf(secure))).status).toBe(401);
});

/** US1.4 */
test("a wrong key waits a second, and is logged without the key", async () => {
  const { app, signIn } = await signedApp();

  const response = await send(app, "POST", "/session", {
    body: { key: "ura_wrong" },
    headers: { "x-forwarded-for": "100.101.102.103, 10.0.0.1" },
    host: tailnet,
  });
  // On the server's own address, no proxy sent the header: it is not believed.
  await send(app, "POST", "/session", {
    body: { key: "ura_wrong" },
    headers: { "x-forwarded-for": "100.101.102.103" },
  });

  expect(response.status).toBe(401);
  expect(await response.json()).toEqual({ error: "This is not Uraeda's access key." });
  expect(response.headers.get("set-cookie")).toBeNull();
  expect(signIn.waits).toEqual([1000, 1000]);
  expect(signIn.lines).toEqual([
    "uraeda: failed sign-in from 100.101.102.103",
    "uraeda: failed sign-in from unknown",
  ]);
  expect(signIn.lines.join("\n")).not.toContain("ura_wrong");
});

/** US1.6 */
test("a session refreshed after a day sets its cookie again", async () => {
  const { app, name, signIn } = await signedApp();
  const cookie = await signIn.signedIn();

  signIn.clock.now += DAY + MINUTE;
  const refreshed = await readFate(app, name, cookie);
  signIn.clock.now += HOUR;
  const again = await readFate(app, name, cookie);

  expect(refreshed.status).toBe(200);
  expect(refreshed.headers.get("set-cookie")).toBe(
    `${cookie}; Max-Age=2592000; Path=/; HttpOnly; SameSite=Lax`,
  );
  expect(again.status).toBe(200);
  expect(again.headers.get("set-cookie")).toBeNull();
});

/** Edge case, review focus 1 */
test("a cookie whose session ended gets 401, and is cleared", async () => {
  const { app, name, signIn } = await signedApp();
  const [cookie, other] = [await signIn.signedIn(), await signIn.signedIn()];
  signIn.store.endSession(cookie.split("=")[1].split(".")[0]);
  // A day later, a session is refreshed: one that ends during the request never is.
  signIn.clock.now += DAY + MINUTE;

  const response = await readFate(app, name, cookie);
  const signedOut = await send(app, "DELETE", "/session", { cookie: other });

  expect(response.status).toBe(401);
  expect(await response.json()).toEqual({ error: "Sign in to Uraeda." });
  expect(response.headers.getSetCookie()).toEqual([
    "uraeda=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax",
  ]);
  expect(signedOut.headers.getSetCookie()).toEqual([
    "uraeda=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax",
  ]);
});

/** Reads a stream until it ends, or `timeout` ms pass: whether it ended. */
async function ends(body: ReadableStream<Uint8Array>, timeout: number) {
  const reader = body.getReader();
  const deadline = new Promise<false>((resolve) => setTimeout(() => resolve(false), timeout));
  const read = async () => {
    for (;;) {
      if ((await reader.read()).done) {
        return true;
      }
    }
  };
  const ended = await Promise.race([read(), deadline]);
  if (!ended) {
    await reader.cancel();
  }
  return ended;
}

/** US3.1 */
test("signing out ends the session and its live stream", async () => {
  const { app, name, signIn } = await signedApp();
  const cookie = await signIn.signedIn();
  const live = await send(app, "GET", `/r/${name}/fate/live?connectionId=c1`, {
    cookie,
    headers: { accept: "text/event-stream" },
  });
  expect(live.status).toBe(200);

  const response = await send(app, "DELETE", "/session", { cookie });

  expect(response.status).toBe(204);
  expect(response.headers.get("set-cookie")).toMatch(/^uraeda=; Max-Age=0; Path=\/; /);
  expect(await ends(live.body!, 5000)).toBe(true);
  expect(signIn.store.findSession(cookie.split("=")[1])).toBeUndefined();
  expect((await readFate(app, name, cookie)).status).toBe(401);
});

/** US3.3 */
test("signing out everywhere ends every session", async () => {
  const { app, name, signIn } = await signedApp();
  const [laptop, phone] = [await signIn.signedIn(), await signIn.signedIn()];

  const response = await send(app, "DELETE", "/sessions", { cookie: laptop });

  expect(response.status).toBe(204);
  expect(response.headers.get("set-cookie")).toMatch(/^uraeda=; Max-Age=0; /);
  expect((await readFate(app, name, laptop)).status).toBe(401);
  expect((await readFate(app, name, phone)).status).toBe(401);
});

/** Edge case */
test("signing in again replaces the device's session", async () => {
  const { app, name, signIn } = await signedApp();
  const old = await signIn.signedIn();

  const response = await send(app, "POST", "/session", { body: { key: signIn.key }, cookie: old });

  expect(response.status).toBe(204);
  expect((await readFate(app, name, old)).status).toBe(401);
  expect((await readFate(app, name, cookieOf(response))).status).toBe(200);
});

/** US4.1, US4.3 */
test("a one-time link signs in once, within 5 minutes", async () => {
  const { app, name, signIn } = await signedApp();
  const link = signIn.links.make("/r/todo/");
  expect(link).toMatch(/^\/session\/[\w-]{43}\?to=\/r\/todo\/$/);

  const first = await send(app, "GET", link);
  const second = await send(app, "GET", link);
  const late = signIn.links.make("/r/todo/");
  signIn.clock.now += 5 * MINUTE + 1000;
  const expired = await send(app, "GET", late);

  expect(first.status).toBe(303);
  expect(first.headers.get("location")).toBe("/r/todo/");
  expect(first.headers.get("set-cookie")).toMatch(/^uraeda=[\w-]+\.[\w-]+; Max-Age=2592000; /);
  expect((await readFate(app, name, cookieOf(first))).status).toBe(200);
  for (const response of [second, expired]) {
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/r/todo/");
    expect(response.headers.get("set-cookie")).toBeNull();
  }
});

/** Review focus 6 */
test("a one-time link never leaves the server", async () => {
  const { app, signIn } = await signedApp();

  for (const to of [
    "//evil.com",
    "https://evil.com",
    String.raw`/\evil.com`,
    "/\t/evil.com",
    "evil.com",
  ]) {
    const used = await send(app, "GET", signIn.links.make(to));
    const unknown = await send(app, "GET", `/session/unknown?to=${encodeURIComponent(to)}`);

    expect([used.headers.get("location"), unknown.headers.get("location")]).toEqual(["/", "/"]);
  }
});

test("the session routes are never cached", async () => {
  const { app, signIn } = await signedApp();
  const cookie = await signIn.signedIn();

  const responses = [
    await send(app, "POST", "/session", { body: { key: signIn.key } }),
    await send(app, "POST", "/session", { body: { key: "ura_wrong" } }),
    await send(app, "GET", "/session", { cookie }),
    await send(app, "GET", "/session"),
    await send(app, "GET", `${signIn.links.make("/")}`),
    await send(app, "DELETE", "/sessions"),
    await send(app, "DELETE", "/session", { cookie }),
    await send(app, "DELETE", "/sessions", { cookie: await signIn.signedIn() }),
  ];

  expect(responses.map((response) => response.headers.get("cache-control"))).toEqual(
    responses.map(() => "no-store"),
  );
});

test("Uraeda's pages refuse other sites' frames", async () => {
  const { app, frames, name, signIn } = await signedApp();
  const cookie = await signIn.signedIn();

  const signed = await readFate(app, name, cookie);
  const refused = await readFate(app, name);
  // A Storybook's answer is framed by Uraeda's own pages, from a sandbox.
  const preview = await send(
    app,
    "GET",
    `/r/${name}/preview/${frames.current()}/main/iframe.html`,
    {
      cookie,
    },
  );

  expect(signed.headers.get("x-frame-options")).toBe("SAMEORIGIN");
  expect(refused.headers.get("x-frame-options")).toBe("SAMEORIGIN");
  expect(preview.status).toBe(503);
  expect(preview.headers.get("x-frame-options")).toBeNull();
});
