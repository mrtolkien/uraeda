// US2: preview and mockup frames load from addresses carrying the frame secret, which only a
// signed-in page receives; other addresses answer 404, and a sign-out replaces the secret.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { previewStarts, STORY_FEATURE, temporaryFolder } from "uraeda-binding/test-utils";
import { type Data, fixtureRepo, port, testApp } from "../../__tests__/helpers.ts";
import {
  type Echo,
  ready,
  runningPreview,
  storyCheckout,
  socketOpens,
  upgradeEcho,
  upgradeStatus,
  WAIT,
} from "../../preview/__tests__/helpers.ts";
import { FrameSecret } from "../frames.ts";
import { SignInStore } from "../store.ts";

const STORY = `${STORY_FEATURE}:packages/web/src/SidebarHandle.stories.tsx#Dragging`;
const MOCKUP = "specs/2026-10-11-web-ui/mockups/ui.html";

/** A repository holding a mockup, `MOCKUP`, in its main checkout. */
function mockupRepo(): string {
  const repo = fixtureRepo();
  mkdirSync(join(repo, "specs/2026-10-11-web-ui/mockups"), { recursive: true });
  writeFileSync(join(repo, MOCKUP), "<p>UI</p>");
  return repo;
}

/** Reads records of a type by id, with the given fields, from the server at `origin`. */
async function byIdAt(
  origin: string,
  name: string,
  type: string,
  ids: Array<string>,
  select: Array<string>,
): Promise<Array<Record<string, Data>>> {
  const response = await fetch(`${origin}/r/${name}/fate`, {
    body: JSON.stringify({
      operations: [{ id: "1", ids, kind: "byId", select, type }],
      version: 1,
    }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  return ((await response.json()) as { results: Array<{ data: Array<Record<string, Data>> }> })
    .results[0]!.data;
}

/** A sandboxed frame's `Origin`, and none. */
const ORIGINS: Array<Record<string, string>> = [{ origin: "null" }, {}];

/** A GET of `url` with `headers`, its redirects not followed. */
const get = (url: string, headers: Record<string, string> = {}) =>
  fetch(url, { headers, redirect: "manual" });

/** US2.1 */
test("another site's frame gets 404 for the old address", async () => {
  const { name, origin, server } = await runningPreview();
  const old = `${origin}/r/${name}/preview/${STORY_FEATURE}/`;
  const wrong = `${origin}/r/${name}/preview/another-secret/${STORY_FEATURE}/`;

  for (const base of [old, wrong]) {
    for (const headers of ORIGINS) {
      expect((await get(`${base}iframe.html`, headers)).status, base).toBe(404);
      const socket = `${base}storybook-server-channel`;
      expect(await upgradeStatus(socket, headers), base).toBe(404);
    }
  }
  // The same paths with the secret are served.
  const base = `${origin}/r/${name}/preview/${server.frames.current()}/${STORY_FEATURE}/`;
  expect((await get(`${base}__echo`, { origin: "null" })).status).toBe(200);
});

/** US2.2 */
test("a story's frame and socket load under the secret, without a cookie", async () => {
  const { base, log, name, origin, server } = await runningPreview();

  const [story] = await byIdAt(origin, name, "Story", [STORY], ["state", "frame"]);

  expect(story).toMatchObject({
    frame: `/r/${name}/preview/${server.frames.current()}/${STORY_FEATURE}/iframe.html?id=sidebarhandle--dragging&viewMode=story`,
    state: "ready",
  });
  const frame = await get(`${origin}${story.frame}`, { origin: "null" });
  expect(frame.status).toBe(200);
  expect(await frame.text()).toContain("<h1>Dragging</h1>");
  expect(await socketOpens(`${origin}${base}storybook-server-channel`, { origin: "null" })).toBe(
    true,
  );
  // Storybook was given the base with the secret.
  expect(previewStarts(log).map((start) => start.base)).toEqual([base]);
});

/** US2.3, review focus 5 */
test("a mockup loads under the secret", async () => {
  const { app, frames, name, signIn } = await testApp(mockupRepo(), { signIn: true });
  const at = (path: string, headers: Record<string, string> = {}) =>
    app.request(`http://127.0.0.1:${port}/r/${name}/mockups/${path}`, { headers });
  const cookie = await signIn.signedIn();

  const framed = await at(`${frames.current()}/${MOCKUP}`, { origin: "null" });
  const redirected = await at(MOCKUP, { cookie });

  expect(framed.status).toBe(200);
  expect(await framed.text()).toBe("<p>UI</p>");
  expect(framed.headers.get("referrer-policy")).toBe("no-referrer");
  expect(redirected.status).toBe(303);
  expect(redirected.headers.get("location")).toBe(
    `/r/${name}/mockups/${frames.current()}/${MOCKUP}`,
  );
  expect(redirected.headers.get("referrer-policy")).toBe("no-referrer");
  for (const path of [`${frames.current()}/`, frames.current()]) {
    expect((await at(path, { cookie })).status, path).toBe(404);
  }
});

/** The headers the fake Storybook got, from its echo. */
const echoed = async (response: Response) => ((await response.json()) as Echo).headers;

/** US2.4, review focus 8 */
test("Storybook never sees Uraeda's credentials", async () => {
  const credentials = { authorization: "Bearer a-token", cookie: "uraeda=a.b; other=1" };
  const { base, origin } = await runningPreview();

  const read = await get(`${origin}${base}__echo`, credentials);
  const upgrade = await upgradeEcho(`${origin}${base}storybook-server-channel`, credentials);

  expect(read.headers.get("referrer-policy")).toBe("no-referrer");
  for (const headers of [await echoed(read), upgrade.headers]) {
    expect(headers).not.toHaveProperty("cookie");
    expect(headers).not.toHaveProperty("authorization");
  }
});

/** Review focus 8: a signed-in browser's frame request is served, without its cookie. */
test("a frame request with a session cookie is served, and the cookie stays", async () => {
  const story = await storyCheckout();
  const { app, frames, name, previews, signIn } = await testApp(story.repo, { signIn: true });
  const checkout = {
    ...story.checkout,
    base: `/r/${name}/preview/${frames.current()}/${STORY_FEATURE}/`,
  };
  previews.view(checkout);
  await ready(previews, checkout);
  const cookie = await signIn.signedIn();

  const response = await app.request(`http://127.0.0.1:${port}${checkout.base}__echo`, {
    headers: { cookie },
  });

  expect(response.status).toBe(200);
  expect(await echoed(response)).not.toHaveProperty("cookie");
});

/** US2.5, and the edge case of a secret replaced while a Storybook starts */
test("a sign-out replaces the secret and restarts the Storybooks", async () => {
  const { base, log, name, origin, previews, server } = await runningPreview();
  const before = server.frames.current();
  // The feature's Storybook, ready, and the main checkout's, starting, each read by a page.
  await byIdAt(origin, name, "Preview", [STORY_FEATURE], ["state"]);
  const [main] = await byIdAt(origin, name, "Preview", ["main"], ["state"]);
  expect(main.state).toBe("starting");
  const sent: Array<string> = [];
  const bus = server.hosts.byPath(server.hosts.get(name)!.path)!.live;
  const listening = new AbortController();
  bus.listen!("Preview", STORY_FEATURE, () => sent.push("Preview"), { signal: listening.signal });
  await expect.poll(() => sent.length, WAIT).toBe(1);

  server.frames.replace();

  const after = server.frames.current();
  expect(after).not.toBe(before);
  await expect.poll(() => sent.length, WAIT).toBe(2);
  listening.abort();
  expect(previews.state(base)).toBeUndefined();
  expect(previews.state(`/r/${name}/preview/${before}/main/`)).toBeUndefined();
  expect((await get(`${origin}${base}__echo`)).status).toBe(404);
  expect(await upgradeStatus(`${origin}${base}storybook-server-channel`, {})).toBe(404);
  // The page reads its record again, at the update: Storybook starts under the new base.
  const [renewed] = await byIdAt(origin, name, "Preview", [STORY_FEATURE], ["state"]);
  expect(renewed.state).toBe("starting");
  const newBase = `/r/${name}/preview/${after}/${STORY_FEATURE}/`;
  await expect.poll(() => previews.state(newBase)?.state, WAIT).toBe("ready");
  expect(previewStarts(log).map((start) => start.base)).toContain(newBase);
  expect((await get(`${origin}${newBase}__echo`)).status).toBe(200);
});

/** Review focus 3 */
test("a right secret on a gone Storybook is 503", async () => {
  const { name, origin, server } = await runningPreview();
  const gone = `${origin}/r/${name}/preview/${server.frames.current()}/main/`;

  const response = await get(`${gone}iframe.html`, { origin: "null" });

  expect(response.status).toBe(503);
  expect(await response.text()).toBe("Storybook is not running for this branch.");
  expect(await upgradeStatus(`${gone}storybook-server-channel`, { origin: "null" })).toBe(503);
});

/** Review focus 4 */
test("two sign-outs at once replace the secret twice, restart once, and nothing throws", async () => {
  const dataDir = temporaryFolder("uraeda-data");
  const { store } = SignInStore.open(dataDir);
  let made = 0;
  const frames = new FrameSecret(() => `secret-${made++}`);
  store.onEnded(() => frames.replace());
  let restarts = 0;
  frames.onReplace(() => restarts++);
  const [one, two] = [store.createSession(), store.createSession()].map(
    (cookie) => cookie.split(".")[0]!,
  );

  store.endSession(one!);
  store.endSession(two!);
  store.endSession(one!);

  expect(frames.current()).toBe("secret-2");
  expect(frames.allows(`/r/todo/preview/secret-1/main/iframe.html`)).toBe(false);
  await Promise.resolve();
  expect(restarts).toBe(1);

  for (let index = 0; index < 5; index++) {
    store.createSession();
  }
  expect(() => store.endAll()).not.toThrow();
  expect(frames.current()).toBe("secret-7");
  await Promise.resolve();
  expect(restarts).toBe(2);
});

/** A preview's or a mockup's path without the current secret: `<name>` is the repository's. */
const withoutSecret = [
  `/r/<name>/preview/${STORY_FEATURE}/iframe.html`,
  `/r/<name>/preview/${STORY_FEATURE}/storybook-server-channel`,
  `/r/<name>/preview/another-secret/${STORY_FEATURE}/iframe.html`,
  `/r/<name>/preview/another-secret/${STORY_FEATURE}/storybook-server-channel`,
  `/r/<name>/mockups/${MOCKUP}`,
  `/r/<name>/mockups/another-secret/${MOCKUP}`,
];

/** SC-002 */
test("no preview or mockup path answers without the current frame secret", async () => {
  const { name, origin, server } = await runningPreview("ok", mockupRepo());
  const secret = server.frames.current();
  const statuses = async (path: string) => {
    const url = `${origin}${path.replace("<name>", name)}`;
    const answers = [];
    for (const headers of ORIGINS) {
      for (const method of ["GET", "HEAD"]) {
        answers.push((await fetch(url, { headers, method, redirect: "manual" })).status);
      }
      answers.push(await upgradeStatus(url, headers));
    }
    return answers;
  };

  for (const path of withoutSecret) {
    const answers = await statuses(path);
    expect(
      answers.filter((status) => status === 200 || status === 101),
      path,
    ).toEqual([]);
  }
  // The same paths with the secret answer.
  const served = await statuses(`/r/<name>/mockups/${secret}/${MOCKUP}`);
  expect(served.filter((status) => status === 200)).toHaveLength(4);
  const opened = await statuses(
    `/r/<name>/preview/${secret}/${STORY_FEATURE}/storybook-server-channel`,
  );
  expect(opened.filter((status) => status === 101)).toHaveLength(2);
});
