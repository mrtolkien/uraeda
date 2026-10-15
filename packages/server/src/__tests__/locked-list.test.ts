// A server whose list is locked, as Uraeda's own Storybook starts it: it serves the repositories it
// started with, and refuses to change the list or to suggest folders, on every endpoint.
import { realpathSync } from "node:fs";
import { expect, test } from "vite-plus/test";
import { binding, byIdAt, fateAt, fixtureRepo, testApp } from "./helpers.ts";

const LOCKED = { code: "BAD_REQUEST", message: "refused: this server's list is locked" };

/** The paths of the list, as the binding reads it from the data folder. */
async function listed(dataDir: string) {
  return (await binding.readRepositories(dataDir)).map((row: { path: string }) => row.path);
}

test.each([
  ["the global endpoint", null],
  ["the repository's endpoint", "own"],
])("a locked list refuses every change through %s", async (_, endpoint) => {
  const opened = await testApp(fixtureRepo(), { lockedList: true });
  const other = fixtureRepo();
  const name = endpoint === null ? null : opened.name;

  const results = await fateAt(opened.app, name, [
    { input: { folder: other }, kind: "mutation", name: "repositories.add", select: ["rows.name"] },
    {
      input: { name: opened.name },
      kind: "mutation",
      name: "repositories.remove",
      select: ["rows.name"],
    },
    {
      input: { name: opened.name },
      kind: "mutation",
      name: "repositories.open",
      select: ["rows.name"],
    },
  ]);

  expect(results.map((result) => result.error)).toEqual([LOCKED, LOCKED, LOCKED]);
  expect(await listed(opened.dataDir)).toEqual([realpathSync(opened.repo)]);
});

test("a locked list suggests no folder", async () => {
  const { app } = await testApp(fixtureRepo(), { lockedList: true });

  const [suggestions] = await fateAt(app, null, [
    { ids: ["/"], kind: "byId", select: ["rows.path"], type: "FolderSuggestions" },
  ]);

  expect(suggestions.error).toEqual(LOCKED);
});

test("a locked list still reads the list and the repository", async () => {
  const { app, name } = await testApp(fixtureRepo(), { lockedList: true });

  const [list] = await byIdAt(app, null, "Repositories", ["repositories"], ["rows.name"]);
  const [priorities] = await byIdAt(app, name, "Priorities", ["priorities"], ["id"]);

  expect(list.rows.map((row: { name: string }) => row.name)).toEqual([name]);
  expect(priorities.id).toBe("priorities");
});
