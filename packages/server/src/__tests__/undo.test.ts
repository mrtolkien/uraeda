import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { byId, mutate, testApp } from "./helpers.ts";

test("a write's change undoes and redoes through the server", async () => {
  const { app, repo } = await testApp();
  const path = join(repo, "specs/PRIORITIES.md");
  const before = readFileSync(path, "utf8");
  const [read] = await byId(app, "Priorities", ["priorities"], ["id", "hash"]);

  const moved = await mutate(
    app,
    "proposals.move",
    { hash: read.hash, index: 0, proposal: "later-1", section: "next" },
    ["id", "hash", "change"],
  );
  const { change } = moved.data;
  expect(change).toBeDefined();
  expect(change.files.map((file: { path: string }) => file.path)).toEqual(["specs/PRIORITIES.md"]);
  const after = readFileSync(path, "utf8");
  expect(after).not.toBe(before);

  const committed = await mutate(app, "undo.committed", { change }, ["id", "committed"]);
  expect(committed.data.committed).toBe(false);

  const undone = await mutate(app, "undo.apply", { change, direction: "undo", subject: "Nix" }, [
    "id",
    "commit",
  ]);
  expect(undone.ok).toBe(true);
  expect(undone.data.commit).toBe(change.commit);
  expect(readFileSync(path, "utf8")).toBe(before);

  await mutate(app, "undo.apply", { change, direction: "redo", subject: "Nix" }, ["id", "commit"]);
  expect(readFileSync(path, "utf8")).toBe(after);

  // A write refused by its own hash check records nothing to undo.
  const refused = await mutate(
    app,
    "proposals.move",
    { hash: read.hash, index: 0, proposal: "next-1", section: "later" },
    ["id", "hash", "change"],
  );
  expect(refused.ok).toBe(false);
  expect(refused.error?.message).toMatch(/^conflict: /);
  expect(refused.data).toBeUndefined();
});

test("an undo of a file changed since is refused with its name", async () => {
  const { app } = await testApp();
  const [read] = await byId(app, "Priorities", ["priorities"], ["id", "hash"]);
  const moved = await mutate(
    app,
    "proposals.move",
    { hash: read.hash, index: 0, proposal: "later-1", section: "next" },
    ["id", "hash", "change"],
  );
  await mutate(app, "proposals.add", { hash: moved.data.hash, section: "next", text: "Later" }, [
    "id",
  ]);

  const undone = await mutate(
    app,
    "undo.apply",
    { change: moved.data.change, direction: "undo", subject: "Nix" },
    ["id", "commit"],
  );
  expect(undone.ok).toBe(false);
  expect(undone.error?.message).toBe(
    "conflict: Could not undo: “Nix” changed since in PRIORITIES.md.",
  );
});
