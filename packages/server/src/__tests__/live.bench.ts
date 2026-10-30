import { expect, test } from "vite-plus/test";
import { heldHook } from "./held-hook.ts";
import { byId, mutate, testServer } from "./helpers.ts";
import { commitArrival, statusArrival } from "./live-stream.ts";

/**
 * US6.5, with `vp run bench`: the watcher waits 200 ms of quiet, then reads the workspace, well
 * within the 2 seconds.
 */
test("US6.5: a commit on a branch is sent to a live subscription within 2 seconds", async () => {
  const { arrived, started } = await commitArrival();

  expect(arrived, "no live update within 10 seconds").toBeDefined();
  process.stdout.write(`A commit's live update came in ${Math.round(arrived! - started)} ms.\n`);
  expect(arrived! - started).toBeLessThan(2000);
}, 20_000);

/** SC-002, with `vp run bench`: a status change is published at once. */
test("SC-002: a session's status change reaches a subscribed SessionList within a second", async () => {
  const { arrived, started } = await statusArrival();

  expect(arrived, "no live update within 10 seconds").toBeDefined();
  process.stdout.write(
    `A status change's live update came in ${Math.round(arrived! - started)} ms.\n`,
  );
  expect(arrived! - started).toBeLessThan(1000);
}, 20_000);

/**
 * The feature state pass's SC-002, with `vp run bench`: an approval whose commit the hook holds
 * moves its feature's step, from the approval to the workspace's read, within 100 ms. The
 * performance decision measures on a release build: the 100 ms holds on a release binding
 * (`vp run --filter uraeda-binding build:release`), not on the dev one.
 */
test("SC-002: an approval moves its feature's step within 100 ms, its commit still landing", async () => {
  const folder = "2026-10-06-recurring-tasks";
  const server = await testServer();
  const hook = heldHook(server.repo);
  const stepOf = async () => {
    const [workspace] = await byId(server.app, "Workspace", ["workspace"], ["id", "features"]);
    return workspace.features.find((feature: { folder: string }) => feature.folder === folder)?.step
      .name;
  };
  expect(await stepOf()).toBe("human-gate");

  const started = performance.now();
  await mutate(server.app, "review.approve", { file: "spec.md", folder }, ["id"]);
  const step = await stepOf();
  const took = performance.now() - started;

  process.stdout.write(`An approval's step read came in ${Math.round(took)} ms.\n`);
  expect(step).toBe("plan");
  expect(took).toBeLessThan(100);
  hook.release();
  await server.hosts.get(server.name)!.queue.idle();
}, 20_000);
