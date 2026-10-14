import { expect, test } from "vite-plus/test";
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
