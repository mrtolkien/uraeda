// SC-001: every route of the app answers 401 without a session, but the sign-in decision's
// exceptions. A route added to the app without a row here is a route the review must place.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { temporaryFolder } from "uraeda-binding/test-utils";
import { port, testApp } from "../../__tests__/helpers.ts";

const HOST_TOKEN = "the-host-token";

/** A signed-in app serving a built UI, with a host token. */
async function closedApp() {
  const webRoot = temporaryFolder("uraeda-web");
  writeFileSync(join(webRoot, "index.html"), "<!doctype html><title>Uraeda</title>");
  return testApp(undefined, { hostToken: HOST_TOKEN, signIn: true, webRoot });
}

type Row = [method: string, path: string, headers?: Record<string, string>];

const fateBody = JSON.stringify({ operations: [], version: 1 });

/** The routes that need a session: `<name>` is the repository's name. */
const closed: Array<Row> = [
  ["POST", "/fate"],
  ["POST", "/fate/live"],
  ["GET", "/fate/live?connectionId=c1"],
  ["POST", "/r/<name>/fate"],
  // The host token opens the host's own routes, and no other.
  ["POST", "/r/<name>/fate", { authorization: `Bearer ${HOST_TOKEN}` }],
  ["POST", "/r/<name>/fate/live"],
  ["GET", "/r/<name>/fate/live?connectionId=c1"],
  ["GET", "/raw/specs/PRIORITIES.md"],
  ["GET", "/r/<name>/raw/specs/PRIORITIES.md"],
  ["GET", "/mockups/specs/ui.html"],
  ["GET", "/r/<name>/mockups/specs/ui.html"],
  ["GET", "/r/<name>/preview/main/iframe.html"],
  ["GET", "/r/<name>/images/specs/desktop.png"],
  ["GET", "/r/<name>/chat-images/image.png"],
  ["DELETE", "/r/<name>/chat-images/image.png"],
  ["POST", "/r/<name>/attach?chat=1"],
  ["POST", "/r/<name>/inbox/note-image"],
  ["POST", "/open"],
  ["POST", "/open", { authorization: "Bearer another-token" }],
  ["POST", "/session/key"],
  ["DELETE", "/sessions"],
];

test.each(closed)("%s %s needs a session", async (method, path, headers = {}) => {
  const { app, name } = await closedApp();

  const response = await app.request(`http://127.0.0.1:${port}${path.replace("<name>", name)}`, {
    body: method === "GET" ? undefined : fateBody,
    headers: { "content-type": "application/json", ...headers },
    method,
  });

  expect(response.status).toBe(401);
  expect(await response.json()).toEqual({ error: "Sign in to Uraeda." });
});

/**
 * The exceptions: the UI's files, the `/session` routes, the host's own `/open`, and frame paths
 * with the frame secret, `<secret>`: a mockup the repository does not have, and a Storybook not
 * running.
 */
const open: Array<[...Row, status: number]> = [
  ["GET", "/", {}, 200],
  ["GET", "/r/<name>/", {}, 200],
  ["GET", "/index.html", {}, 200],
  // 401 here is the answer, "not signed in", which the UI asks.
  ["GET", "/session", {}, 401],
  ["POST", "/session", {}, 204],
  ["DELETE", "/session", {}, 204],
  ["GET", "/session/unknown?to=/r/todo/", {}, 303],
  ["POST", "/open", { authorization: `Bearer ${HOST_TOKEN}` }, 400],
  ["POST", "/session/key", { authorization: `Bearer ${HOST_TOKEN}` }, 200],
  ["GET", "/r/<name>/mockups/<secret>/specs/ui.html", {}, 404],
  ["GET", "/r/<name>/preview/<secret>/main/iframe.html", {}, 503],
];

test.each(open)("%s %s is open", async (method, path, headers, status) => {
  const { app, frames, name, signIn } = await closedApp();
  const target = path.replace("<name>", name).replace("<secret>", frames.current());

  const response = await app.request(`http://127.0.0.1:${port}${target}`, {
    body: method === "POST" ? JSON.stringify({ key: signIn.key }) : undefined,
    headers: { "content-type": "application/json", ...headers },
    method,
  });

  expect(response.status).toBe(status);
});
