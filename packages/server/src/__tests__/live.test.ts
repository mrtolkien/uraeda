import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import * as binding from "uraeda-binding";
import { startLive } from "../live.ts";
import { fixtureRepo, git, mutate, port, testApp, testServer } from "./helpers.ts";

/** US6.5: a commit on a feature's branch reaches a subscribed page. */
test("a commit on a branch is sent to a live subscription", async () => {
  const repo = fixtureRepo();
  const app = testApp(repo);
  const handle = startLive(binding, repo);
  const connectionId = "c1";
  const response = await app.request(
    `http://127.0.0.1:${port}/fate/live?connectionId=${connectionId}`,
    { headers: { accept: "text/event-stream" } },
  );
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let received = "";
  const read = async () => {
    const { value } = await reader.read();
    received += decoder.decode(value);
  };
  await read();
  expect(received).toContain("connected");
  const subscribed = await app.request(`http://127.0.0.1:${port}/fate/live`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      version: 1,
      connectionId,
      operations: [
        {
          id: "s1",
          kind: "subscribe",
          type: "Feature",
          entityId: "2026-10-12-cli-tuis",
          select: ["id", "files"],
        },
      ],
    }),
  });
  expect(((await subscribed.json()) as { results: Array<{ ok: boolean }> }).results[0].ok).toBe(
    true,
  );

  git(repo, "switch", "--quiet", "2026-10-12-cli-tuis");
  writeFileSync(
    join(repo, "specs/2026-10-12-cli-tuis/plan.md"),
    "---\nstatus: auto-approved\nspec-revision: 1\n---\n\n# Plan: CLI TUIs\n",
  );
  git(repo, "add", "--all");
  git(repo, "commit", "--quiet", "--no-verify", "--message", "plan(cli-tuis): plan");
  const start = Date.now();
  while (!received.includes("plan.md") && Date.now() - start < 2000) {
    await Promise.race([read(), new Promise((resolve) => setTimeout(resolve, 100))]);
  }
  handle.close();
  await reader.cancel();

  expect(received).toContain("plan.md");
  expect(Date.now() - start).toBeLessThan(2000);
});

/** Codex review: the watch lives as long as the server, one per repository. */
test("a repository's watch is kept, and started once", () => {
  const repo = fixtureRepo();

  const handle = startLive(binding, repo);

  expect(startLive(binding, repo)).toBe(handle);
  handle.close();
});

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
  const connectionId = "c2";
  const response = await app.request(
    `http://127.0.0.1:${port}/fate/live?connectionId=${connectionId}`,
    { headers: { accept: "text/event-stream" } },
  );
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let received = "";
  const read = async () => {
    const { value } = await reader.read();
    received += decoder.decode(value);
  };
  await read();
  const subscribed = await app.request(`http://127.0.0.1:${port}/fate/live`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      version: 1,
      connectionId,
      operations: [
        { id: "s1", kind: "subscribe", type: "Run", entityId: id, select: ["id", "pages"] },
      ],
    }),
  });
  expect(((await subscribed.json()) as { results: Array<{ ok: boolean }> }).results[0].ok).toBe(
    true,
  );

  const start = Date.now();
  adapter.emit({ type: "text", text: "Reading the answers" });
  while (!received.includes('"pages":1') && Date.now() - start < 1000) {
    await Promise.race([read(), new Promise((resolve) => setTimeout(resolve, 50))]);
  }
  const elapsed = Date.now() - start;
  await reader.cancel();
  runner.stop(Number(id));
  await runner.settled(Number(id));

  expect(received).toContain('"pages":1');
  expect(elapsed).toBeLessThan(1000);
});
