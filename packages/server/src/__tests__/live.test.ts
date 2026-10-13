import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import * as binding from "uraeda-binding";
import { startLive, stopLive } from "../live.ts";
import { fixtureRepo, git, mutate, port, testApp, testServer } from "./helpers.ts";

type App = ReturnType<typeof testApp>;

/**
 * A live connection, its stream read as it comes. `arrival` gives the time a text first came in,
 * taken when its chunk was read: the time a test spends after it, cleaning up, is not counted.
 */
async function connect(app: App, connectionId: string) {
  const response = await app.request(
    `http://127.0.0.1:${port}/fate/live?connectionId=${connectionId}`,
    { headers: { accept: "text/event-stream" } },
  );
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let received = "";
  /** The length of the stream after each chunk, and when that chunk was read. */
  const chunks: Array<{ length: number; at: number }> = [];
  const waiting = new Set<() => void>();
  void (async () => {
    for (;;) {
      const { value, done } = await reader.read().catch(() => ({ value: undefined, done: true }));
      if (done) {
        return;
      }
      received += decoder.decode(value, { stream: true });
      chunks.push({ length: received.length, at: performance.now() });
      for (const wake of waiting) {
        wake();
      }
    }
  })();
  const arrivedAt = (text: string, from: number) =>
    chunks.find((chunk) => received.slice(from, chunk.length).includes(text))?.at;
  return {
    /**
     * When `text` came in the stream, after the `from` first characters, or undefined when it has
     * not within `timeout` ms.
     */
    arrival(text: string, timeout: number, from = 0): Promise<number | undefined> {
      return new Promise((resolve) => {
        const wake = () => {
          const at = arrivedAt(text, from);
          if (at !== undefined) {
            waiting.delete(wake);
            clearTimeout(timer);
            resolve(at);
          }
        };
        const timer = setTimeout(() => {
          waiting.delete(wake);
          resolve(undefined);
        }, timeout);
        waiting.add(wake);
        wake();
      });
    },
    /** How much of the stream came so far: what a later `arrival` can start after. */
    mark: () => received.length,
    close: () => reader.cancel(),
  };
}

/** Subscribes a connection to an entity's live updates. */
async function subscribe(
  app: App,
  connectionId: string,
  entity: { type: string; entityId: string; select: Array<string> },
) {
  const response = await app.request(`http://127.0.0.1:${port}/fate/live`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      version: 1,
      connectionId,
      operations: [{ id: "s1", kind: "subscribe", ...entity }],
    }),
  });
  expect(((await response.json()) as { results: Array<{ ok: boolean }> }).results[0].ok).toBe(true);
}

/**
 * US6.5: a commit on a feature's branch reaches a subscribed page within 2 seconds. The watcher
 * waits 200 ms of quiet, then reads the workspace: the rest of the budget is the margin for a
 * machine running the other test projects at the same time.
 */
test("a commit on a branch is sent to a live subscription within 2 seconds", async () => {
  const repo = fixtureRepo();
  const app = testApp(repo);
  startLive(binding, repo);
  const stream = await connect(app, "c1");
  expect(await stream.arrival("connected", 5000)).toBeDefined();
  await subscribe(app, "c1", {
    type: "Feature",
    entityId: "2026-10-12-cli-tuis",
    select: ["id", "files"],
  });
  // The subscription is sent the feature as it is first: the commit's update comes after it.
  expect(await stream.arrival('"kind":"next"', 5000)).toBeDefined();
  const before = stream.mark();

  git(repo, "switch", "--quiet", "2026-10-12-cli-tuis");
  writeFileSync(
    join(repo, "specs/2026-10-12-cli-tuis/plan.md"),
    "---\nstatus: auto-approved\nspec-revision: 1\n---\n\n# Plan: CLI TUIs\n",
  );
  git(repo, "add", "--all");
  git(repo, "commit", "--quiet", "--no-verify", "--message", "plan(cli-tuis): plan");
  const committed = performance.now();
  // The plan the commit adds, with its status: before it, the feature lists it as not written.
  const arrived = await stream.arrival("auto-approved", 10_000, before);
  stopLive(repo);
  await stream.close();

  expect(arrived, "no live update within 10 seconds").toBeDefined();
  expect(arrived! - committed).toBeLessThan(2000);
}, 20_000);

/**
 * A view reads its data, then subscribes: a change made between the two is sent at once, as the
 * subscription sends the data as it is when it starts, with no change made since.
 */
test("a subscription is sent its entity's data once it starts", async () => {
  const repo = fixtureRepo();
  const app = testApp(repo);
  const stream = await connect(app, "c3");
  expect(await stream.arrival("connected", 5000)).toBeDefined();
  await subscribe(app, "c3", {
    type: "Feature",
    entityId: "2026-10-12-cli-tuis",
    select: ["id", "files"],
  });

  const arrived = await stream.arrival("proposal.md", 5000);
  await stream.close();

  expect(arrived, "no data within 5 seconds of subscribing").toBeDefined();
});

/**
 * The dev server makes an app for each port a repository is served on, and each
 * starts its live updates. The repository is watched once, so no change is sent twice, and until
 * it is stopped.
 */
test("a repository is watched once, until stopped", () => {
  const repo = fixtureRepo();
  let watches = 0;
  const counting = {
    ...binding,
    watch: (...args: Parameters<typeof binding.watch>) => {
      watches++;
      return binding.watch(...args);
    },
  };

  startLive(counting, repo);
  startLive(counting, repo);
  expect(watches).toBe(1);

  stopLive(repo);
  startLive(counting, repo);
  expect(watches).toBe(2);
  stopLive(repo);
});

/**
 * SC-002: an event shows in an open page within a second. A run's updates go out at most every
 * 250 ms, which the second includes, with the rest as the margin for a loaded machine.
 */
test("SC-002: a run's events reach a subscribed Run within a second", async () => {
  const { app, adapter, runner } = await testServer();
  const started = await mutate(
    app,
    "run.start",
    { folder: "2026-10-12-cli-tuis", trigger: "manual" },
    ["id", "pages"],
  );
  const id = started.data.id as string;
  expect(started.data.pages).toBe(0);
  const stream = await connect(app, "c2");
  expect(await stream.arrival("connected", 5000)).toBeDefined();
  await subscribe(app, "c2", { type: "Run", entityId: id, select: ["id", "pages"] });

  const emitted = performance.now();
  adapter.emit({ type: "text", text: "Reading the answers" });
  const arrived = await stream.arrival('"pages":1', 10_000);
  await stream.close();
  runner.stop(Number(id));
  await runner.settled(Number(id));

  expect(arrived, "no live update within 10 seconds").toBeDefined();
  expect(arrived! - emitted).toBeLessThan(1000);
}, 20_000);
