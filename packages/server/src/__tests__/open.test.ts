import { expect, test } from "vite-plus/test";
import { readRepositories, version } from "uraeda-binding";
import { temporaryFolder } from "uraeda-binding/test-utils";
import type { OpenAnswer } from "../open.ts";
import { fixtureRepo, port, testApp } from "./helpers.ts";

/** A JSON `POST` of `body`, with extra headers. */
const post = (body: unknown, headers: Record<string, string> = {}) => ({
  body: JSON.stringify(body),
  headers: { "content-type": "application/json", ...headers },
  method: "POST",
});

const url = `http://127.0.0.1:${port}`;

/** Native fate operations reading the list, through the global endpoint. */
const fateList = () =>
  post({
    operations: [
      { id: "1", ids: ["repositories"], kind: "byId", select: ["rows.name"], type: "Repositories" },
    ],
    version: 1,
  });

/** US2.1 */
test("a repository's folder is added, and its page answered", async () => {
  const { app, dataDir } = await testApp();
  const notes = fixtureRepo();

  const response = await app.request(`${url}/open`, post({ folder: notes, given: false }));

  expect(response.status).toBe(200);
  const listed = (await readRepositories(dataDir)).find((repository) => repository.path === notes);
  expect(listed).toBeDefined();
  expect(await response.json()).toEqual({
    signIn: `/r/${listed!.name}/`,
    uraeda: version(),
    url: `/r/${listed!.name}/`,
  });
  // Served at once: the hosts were reloaded before the answer.
  expect((await app.request(`${url}/r/${listed!.name}/fate`, fateList())).status).toBe(200);
});

/** Edge case: the repository is already listed. */
test("a listed repository is opened without changing the list", async () => {
  const { app, dataDir, name, repo } = await testApp();
  const before = await readRepositories(dataDir);

  const response = await app.request(`${url}/open`, post({ folder: repo, given: true }));

  expect(await response.json()).toEqual({
    signIn: `/r/${name}/`,
    uraeda: version(),
    url: `/r/${name}/`,
  });
  expect((await readRepositories(dataDir)).map(({ name, path }) => ({ name, path }))).toEqual(
    before.map(({ name, path }) => ({ name, path })),
  );
});

/** US2.2 */
test("a folder outside git opens the list's most recent repository", async () => {
  const { app } = await testApp();

  const response = await app.request(
    `${url}/open`,
    post({ folder: temporaryFolder("uraeda-none"), given: false }),
  );

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ signIn: "/", uraeda: version(), url: "/" });
});

/** US2.3 */
test("a given folder outside git answers 400", async () => {
  const { app } = await testApp();
  const folder = temporaryFolder("uraeda-none");

  const response = await app.request(`${url}/open`, post({ folder, given: true }));

  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({ error: `${folder} is not a git repository` });
});

test("a request without an absolute folder answers 400", async () => {
  const { app } = await testApp();

  for (const body of [{ folder: "notes", given: false }, { given: true }, "not json"]) {
    const response = await app.request(`${url}/open`, post(body));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "folder must be an absolute path" });
  }
});

test("a cross-site page cannot hand a folder over", async () => {
  const { app, dataDir } = await testApp();
  const notes = fixtureRepo();

  const response = await app.request(
    `${url}/open`,
    post({ folder: notes, given: false }, { origin: "https://evil.test" }),
  );

  expect(response.status).toBe(403);
  expect((await readRepositories(dataDir)).map(({ path }) => path)).not.toContain(notes);
});

const HOST_TOKEN = "the-host-token";

/** An app with sign-in, which the host's own `uraeda` reaches with its host token. */
const signedApp = () => testApp(undefined, { hostToken: HOST_TOKEN, signIn: true });

/** US4.4 */
test("/open without the host token is refused", async () => {
  const { app, dataDir } = await signedApp();
  const before = await readRepositories(dataDir);

  const tries: Array<Record<string, string>> = [{}, { authorization: "Bearer another-token" }];
  for (const headers of tries) {
    const response = await app.request(
      `${url}/open`,
      post({ folder: fixtureRepo(), given: false }, headers),
    );

    expect(response.status).toBe(401);
  }
  expect(await readRepositories(dataDir)).toEqual(before);
});

/** US4.2 */
test("/open with the host token answers a one-time link to the page", async () => {
  const { app, name, repo } = await signedApp();

  const response = await app.request(
    `${url}/open`,
    post({ folder: repo, given: true, signIn: true }, { authorization: `Bearer ${HOST_TOKEN}` }),
  );

  const answer = (await response.json()) as OpenAnswer;
  expect(answer.url).toBe(`/r/${name}/`);
  expect(answer.signIn).toMatch(new RegExp(`^/session/[\\w-]{43}\\?to=/r/${name}/$`));
  const used = await app.request(`${url}${answer.signIn}`);
  expect(used.status).toBe(303);
  expect(used.headers.get("location")).toBe(`/r/${name}/`);
  expect(used.headers.get("set-cookie")).toMatch(/^uraeda=/);
  const again = await app.request(`${url}${answer.signIn}`);
  expect(again.headers.get("set-cookie")).toBeNull();
});

/** Edge case: a second start with no desktop opens no browser, and asks for no link. */
test("/open makes a one-time link only when asked", async () => {
  const { app, name, repo } = await signedApp();

  const response = await app.request(
    `${url}/open`,
    post({ folder: repo, given: true }, { authorization: `Bearer ${HOST_TOKEN}` }),
  );

  expect(((await response.json()) as OpenAnswer).signIn).toBe(`/r/${name}/`);
});

/** Only the host's own `uraeda` gets a one-time link: a signed-in browser could hand one out. */
test("/open makes no one-time link for a signed-in browser", async () => {
  const { app, name, repo, signIn } = await signedApp();
  const cookie = await signIn.signedIn();

  const response = await app.request(
    `${url}/open`,
    post({ folder: repo, given: true, signIn: true }, { cookie }),
  );

  expect(response.status).toBe(200);
  expect(((await response.json()) as OpenAnswer).signIn).toBe(`/r/${name}/`);
});
