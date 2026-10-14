import { expect, test } from "vite-plus/test";
import { readRepositories, version } from "uraeda-binding";
import { temporaryFolder } from "uraeda-binding/test-utils";
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
  expect(await response.json()).toEqual({ uraeda: version(), url: `/r/${listed!.name}/` });
  // Served at once: the hosts were reloaded before the answer.
  expect((await app.request(`${url}/r/${listed!.name}/fate`, fateList())).status).toBe(200);
});

/** Edge case: the repository is already listed. */
test("a listed repository is opened without changing the list", async () => {
  const { app, dataDir, name, repo } = await testApp();
  const before = await readRepositories(dataDir);

  const response = await app.request(`${url}/open`, post({ folder: repo, given: true }));

  expect(await response.json()).toEqual({ uraeda: version(), url: `/r/${name}/` });
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
  expect(await response.json()).toEqual({ uraeda: version(), url: "/" });
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
