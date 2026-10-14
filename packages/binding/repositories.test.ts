import { realpathSync } from "node:fs";
import { basename, join } from "node:path";
import { expect, test } from "vite-plus/test";
import {
  addRepository,
  dataDir,
  openRepository,
  readRepositories,
  removeRepository,
} from "./index.js";
import { fixtureRepo, temporaryFolder } from "./test-utils.ts";

const tempDir = () => temporaryFolder("uraeda-data");

test("a repository added through the binding is read back", async () => {
  const data = tempDir();
  const repo = fixtureRepo();

  await addRepository(data, repo);

  expect(await readRepositories(data)).toEqual([
    {
      name: basename(repo),
      path: realpathSync(repo),
      openedAt: expect.any(String),
      missing: false,
    },
  ]);
});

test("adding a listed repository again says it existed", async () => {
  const data = tempDir();
  const repo = fixtureRepo();

  const first = await addRepository(data, repo);
  const second = await addRepository(data, join(repo, "specs"));

  expect([first.existed, second.existed]).toEqual([false, true]);
  expect(second.repository.name).toBe(first.repository.name);
});

test("a folder outside git is refused", async () => {
  const folder = tempDir();

  await expect(addRepository(tempDir(), folder)).rejects.toThrow(
    `refused: Not a git repository: ${folder}. Run git init there first.`,
  );
});

test("a repository removed is no longer listed, and opening it is refused", async () => {
  const data = tempDir();
  const { repository } = await addRepository(data, fixtureRepo());

  await removeRepository(data, repository.name);

  expect(await readRepositories(data)).toEqual([]);
  await expect(openRepository(data, repository.name)).rejects.toThrow(
    `refused: No repository named “${repository.name}”`,
  );
});

test("opening a repository returns it", async () => {
  const data = tempDir();
  const { repository } = await addRepository(data, fixtureRepo());

  expect(await openRepository(data, repository.name)).toEqual({
    ...repository,
    openedAt: expect.any(String),
  });
});

test("the data folder is the override when set, else the system's default", () => {
  expect(dataDir("/data/override")).toBe("/data/override");
  expect(dataDir("")).toBe(dataDir());
  expect(dataDir(null)).toBe(dataDir());
});
