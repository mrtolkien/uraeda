import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { byId, type Data, mutate, testApp, testServer } from "./helpers.ts";

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

// Break caught: an undo or a redo that skips the refusal the review's writes give while the
// feature's agent works, rewriting its review file under the agent.
test("an undo or a redo of a feature's file is refused while its agent works", async () => {
  const server = await testServer();
  const folder = "2026-10-06-recurring-tasks";
  const file = { file: "spec.md", folder };
  const commented = await mutate(server.app, "review.comment", { ...file, text: "Why?" }, [
    "id",
    "change",
  ]);
  const { change } = commented.data;
  const [path] = change.files.map((one: { path: string }) => one.path);
  expect(path).toMatch(new RegExp(`^specs/${folder}/`));
  const sent = await mutate(server.app, "session.send", { folder, text: "Look at it" }, [
    "id",
    "turns",
  ]);
  expect(sent.error).toBeUndefined();
  const session = sent.data as Record<string, Data>;

  for (const direction of ["undo", "redo"]) {
    const refused = await mutate(server.app, "undo.apply", { change, direction, subject: "Why?" }, [
      "id",
      "commit",
    ]);
    expect(refused.error).toEqual({
      code: "BAD_REQUEST",
      message: "refused: An agent is working on this feature. Stop it first, or wait for it.",
    });
  }

  await server.sessions.mainRoot(server.repo);
  server.sessions.stop(server.repo, session.id as string);
  await server.sessions.settled(Number((session.turns as Array<Data>).at(-1)));
  // Nothing was written: once the agent stopped, the comment's file still holds what the undo
  // expects.
  const undone = await mutate(
    server.app,
    "undo.apply",
    { change, direction: "undo", subject: "Why?" },
    ["id", "commit"],
  );
  expect(undone.error).toBeUndefined();
});
