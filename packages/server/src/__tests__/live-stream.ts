import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect } from "vite-plus/test";
import { git, mutate, port, testApp, testServer } from "./helpers.ts";

type App = Awaited<ReturnType<typeof testApp>>["app"];

/**
 * A live connection, its stream read as it comes. `arrival` gives the time a text first came in,
 * taken when its chunk was read: the time a test spends after it, cleaning up, is not counted.
 */
export async function connect(app: App, name: string, connectionId: string) {
  const response = await app.request(
    `http://127.0.0.1:${port}/r/${name}/fate/live?connectionId=${connectionId}`,
    { headers: { accept: "text/event-stream" } },
  );
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let received = "";
  /** The length of the stream after each chunk, and when that chunk was read. */
  const chunks: Array<{ at: number; length: number }> = [];
  const waiting = new Set<() => void>();
  void (async () => {
    for (;;) {
      const { done, value } = await reader.read().catch(() => ({ done: true, value: undefined }));
      if (done) {
        return;
      }
      received += decoder.decode(value, { stream: true });
      chunks.push({ at: performance.now(), length: received.length });
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
    close: () => reader.cancel(),
    /** How much of the stream came so far: what a later `arrival` can start after. */
    mark: () => received.length,
  };
}

/** Subscribes a connection to an entity's live updates, on a repository's endpoint. */
export async function subscribe(
  app: App,
  name: string,
  connectionId: string,
  entity: { entityId: string; select: Array<string>; type: string },
) {
  const response = await app.request(`http://127.0.0.1:${port}/r/${name}/fate/live`, {
    body: JSON.stringify({
      connectionId,
      operations: [{ id: "s1", kind: "subscribe", ...entity }],
      version: 1,
    }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  expect(((await response.json()) as { results: Array<{ ok: boolean }> }).results[0].ok).toBe(true);
}

/**
 * US6.5's scenario: a page subscribed to a feature, then a commit on the feature's branch. Gives
 * when the commit ended, and when its update came in, undefined after 10 seconds without it.
 */
export async function commitArrival() {
  const { app, hosts, name, repo } = await testApp();
  const stream = await connect(app, name, "c1");
  expect(await stream.arrival("connected", 5000)).toBeDefined();
  await subscribe(app, name, "c1", {
    entityId: "2026-10-12-cli-tuis",
    select: ["id", "files"],
    type: "Feature",
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
  const started = performance.now();
  // The plan the commit adds, with its status: before it, the feature lists it as not written.
  const arrived = await stream.arrival("auto-approved", 10_000, before);
  hosts.close();
  await stream.close();
  return { arrived, started };
}

/**
 * SC-002's scenario: a page subscribed to the sessions' list, then a session's turn that ends.
 * Gives when the turn ended, and when its update came in, undefined after 10 seconds without it.
 */
export async function statusArrival() {
  const { adapter, app, name, sessions } = await testServer();
  const stream = await connect(app, name, "c2");
  expect(await stream.arrival("connected", 5000)).toBeDefined();
  await subscribe(app, name, "c2", {
    entityId: "all",
    select: ["id", "rows"],
    type: "SessionList",
  });
  const sent = await mutate(
    app,
    "session.send",
    { folder: "2026-10-12-cli-tuis", text: "Plan it" },
    ["id", "turns"],
  );
  const { turns } = sent.data as { turns: Array<string> };
  const before = stream.mark();

  const started = performance.now();
  adapter.emit({ denials: [], errors: [], interrupted: false, ok: true, type: "result" });
  const arrived = await stream.arrival('"New reply"', 10_000, before);
  await stream.close();
  await sessions.settled(Number(turns[0]));
  return { arrived, started };
}
