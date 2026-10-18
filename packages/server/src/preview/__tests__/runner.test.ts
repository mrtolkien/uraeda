// The runner on the fake preview, with a clock the test moves: `previews()` stops what it started
// after each test.
import { spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:net";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, onTestFinished, test } from "vite-plus/test";
import {
  addPreview,
  fixtureRepo,
  git,
  previewStarts,
  temporaryFolder,
} from "uraeda-binding/test-utils";
import { freePort, type PreviewState } from "../runner.ts";
import { alive, checkoutOf, fakeClock, previews, ready, storyCheckout, WAIT } from "./helpers.ts";

/** A port of 127.0.0.1 the test holds until it ends. */
async function heldPort(): Promise<number> {
  const server: Server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  onTestFinished(() => new Promise<void>((resolve) => server.close(() => resolve())));
  return (server.address() as { port: number }).port;
}

/** How many requests for the index the fake preview of `log` got; 0 until it listens. */
async function indexReads(log: string): Promise<number> {
  const [start] = previewStarts(log);
  try {
    const response = await fetch(`http://127.0.0.1:${start!.port}/__index-reads`);
    return Number(await response.text());
  } catch {
    return 0;
  }
}

test("a view starts the command in the checkout's folder, on a free port, under its path (US1.1)", async () => {
  const { checkout, log } = await storyCheckout();
  const runner = previews();

  expect(runner.view(checkout)).toEqual({ state: "starting" });

  await ready(runner, checkout);
  const [start] = previewStarts(log);
  expect(start!.cwd).toBe(join(checkout.dir, "packages/web"));
  expect(start!.base).toBe("/r/repo/preview/2026-10-20-sidebar-resize/");
  expect(runner.state(checkout.base)).toEqual({ port: start!.port, state: "ready" });
});

test("two views at once start one Storybook (review focus 3)", async () => {
  const { checkout, log } = await storyCheckout();
  const runner = previews();

  runner.view(checkout);
  runner.view(checkout);
  await ready(runner, checkout);
  runner.view(checkout);

  expect(previewStarts(log)).toHaveLength(1);
});

test.each([
  [
    "a command that fails",
    "fail",
    "Storybook did not start: Error: Cannot find module 'storybook'",
  ],
  ["an index that is not JSON", "bad-index", "Storybook's index could not be read."],
] as const)("%s is failed, with why", async (_, mode, error) => {
  const { checkout } = await storyCheckout({ mode });
  const runner = previews();

  runner.view(checkout);

  await expect.poll(() => runner.state(checkout.base), WAIT).toEqual({ error, state: "failed" });
});

test("a preview folder missing from the checkout is failed, with why", async () => {
  const repo = fixtureRepo();
  const log = addPreview(repo, { folder: "storybook" });
  const checkout = await checkoutOf(repo, "/r/repo/preview/main/");
  const runner = previews();

  runner.view(checkout);

  await expect
    .poll(() => runner.state(checkout.base), WAIT)
    .toEqual({
      error: "Storybook did not start: storybook is not a folder of this checkout.",
      state: "failed",
    });
  expect(previewStarts(log)).toEqual([]);
});

test("a Storybook not ready after 2 minutes is failed", async () => {
  const { checkout, log } = await storyCheckout({ mode: "hang" });
  const clock = fakeClock();
  const runner = previews({ now: clock.now });
  runner.view(checkout);
  // A read of the index is pending, and never answers: the timeout does not wait for it.
  await expect.poll(() => indexReads(log), WAIT).toBeGreaterThan(0);

  clock.advance(120_001);

  await expect
    .poll(() => runner.state(checkout.base), WAIT)
    .toEqual({ error: "Storybook did not start within 2 minutes.", state: "failed" });
  await expect.poll(() => alive(previewStarts(log)[0]!.pid), WAIT).toBe(false);
});

test("30 minutes without a view stops its process group (SC-005)", async () => {
  const { checkout, log } = await storyCheckout();
  const clock = fakeClock();
  const runner = previews({ now: clock.now });
  runner.view(checkout);
  await ready(runner, checkout);

  clock.advance(29 * 60_000);
  runner.view(checkout);
  clock.advance(29 * 60_000);
  runner.sweep();
  expect(runner.state(checkout.base)?.state).toBe("ready");
  clock.advance(60_001);
  runner.sweep();

  expect(runner.state(checkout.base)).toBeUndefined();
  await expect.poll(() => alive(previewStarts(log)[0]!.pid), WAIT).toBe(false);
});

test("a process that exits after it was ready is failed, with its last line (review focus 7)", async () => {
  const { checkout, log } = await storyCheckout();
  const runner = previews();
  runner.view(checkout);
  await ready(runner, checkout);
  const [start] = previewStarts(log);

  process.kill(start!.pid, "SIGKILL");

  await expect
    .poll(() => runner.state(checkout.base), WAIT)
    .toEqual({
      error: `Storybook did not start: Storybook ready on http://127.0.0.1:${start!.port}/`,
      state: "failed",
    });
});

test("a taken port is tried once more", async () => {
  const { checkout, log } = await storyCheckout();
  const ports = [await heldPort()];
  const runner = previews({ freePort: async () => ports.shift() ?? (await freePort()) });

  runner.view(checkout);

  await ready(runner, checkout);
  expect(previewStarts(log)).toHaveLength(2);
});

test("no free port after one retry is failed", async () => {
  const { checkout, log } = await storyCheckout();
  const ports = [await heldPort(), await heldPort()];
  const runner = previews({ freePort: async () => ports.shift() ?? (await freePort()) });

  runner.view(checkout);

  await expect
    .poll(() => runner.state(checkout.base), WAIT)
    .toEqual({ error: "No free port for Storybook.", state: "failed" });
  expect(previewStarts(log)).toHaveLength(2);
});

test("a removed worktree stops its Storybook (ura clean)", async () => {
  const { checkout, log, repo } = await storyCheckout();
  const runner = previews();
  runner.view(checkout);
  await ready(runner, checkout);

  git(repo, "worktree", "remove", "--force", checkout.dir);
  runner.sweep();

  expect(runner.state(checkout.base)).toBeUndefined();
  await expect.poll(() => alive(previewStarts(log)[0]!.pid), WAIT).toBe(false);
});

test("stopping the server stops every Storybook", async () => {
  const { checkout, log, repo } = await storyCheckout();
  const main = await checkoutOf(repo, "/r/repo/preview/main/");
  const runner = previews();
  runner.view(checkout);
  runner.view(main);
  await ready(runner, checkout);
  await ready(runner, main);

  await runner.stopAll();

  expect(runner.state(checkout.base)).toBeUndefined();
  expect(runner.state(main.base)).toBeUndefined();
  for (const { pid } of previewStarts(log)) {
    await expect.poll(() => alive(pid), WAIT).toBe(false);
  }
});

/**
 * A process that runs the runner, views `checkout`, and crashes with an uncaught error once its
 * Storybook is ready: resolves with its exit code.
 */
function crashOnceReady(checkout: unknown): Promise<number | null> {
  const runner = fileURLToPath(new URL("../runner.ts", import.meta.url));
  const script = `
    const { Previews } = await import(${JSON.stringify(runner)});
    const checkout = JSON.parse(process.argv[1]);
    const previews = new Previews();
    previews.view(checkout);
    setInterval(() => {
      if (previews.state(checkout.base)?.state === "ready") throw new Error("crash");
    }, 50);
  `;
  const child = spawn(
    process.execPath,
    ["--input-type=module", "-e", script, JSON.stringify(checkout)],
    {
      stdio: "ignore",
    },
  );
  return new Promise((resolve) => child.once("exit", resolve));
}

test("a server that crashes kills its Storybooks' groups", async () => {
  const { checkout, log } = await storyCheckout();

  expect(await crashOnceReady(checkout)).toBe(1);

  const [start] = previewStarts(log);
  expect(start).toBeDefined();
  await expect.poll(() => alive(start!.pid), WAIT).toBe(false);
});

test("restart starts a failed Storybook again", async () => {
  const { checkout, log } = await storyCheckout({ mode: "fail" });
  const runner = previews();
  runner.view(checkout);
  await expect.poll(() => runner.state(checkout.base)?.state, WAIT).toBe("failed");
  const decision = join(checkout.dir, "specs/decisions/preview.md");
  writeFileSync(decision, readFileSync(decision, "utf8").replace("--mode fail", "--mode ok"));

  const state = runner.restart(await checkoutOf(checkout.dir, checkout.base));

  expect(state).toEqual({ state: "starting" });
  await ready(runner, checkout);
  expect(previewStarts(log)).toHaveLength(2);
});

test("a view keeps a failed Storybook failed until it is restarted", async () => {
  const { checkout, log } = await storyCheckout({ mode: "fail" });
  const runner = previews();
  runner.view(checkout);
  await expect.poll(() => runner.state(checkout.base)?.state, WAIT).toBe("failed");

  expect(runner.view(checkout).state).toBe("failed");
  expect(previewStarts(log)).toHaveLength(1);
});

test("a view at a new commit starts a failed Storybook again; one at an unknown commit does not", async () => {
  const { checkout, log } = await storyCheckout({ mode: "fail" });
  const runner = previews();
  runner.view({ ...checkout, commit: "a" });
  await expect.poll(() => runner.state(checkout.base)?.state, WAIT).toBe("failed");

  expect(runner.view(checkout).state).toBe("failed");
  expect(runner.view({ ...checkout, commit: "b" }).state).toBe("starting");
  await expect.poll(() => previewStarts(log).length, WAIT).toBe(2);
});

test("a view at a known commit starts a Storybook whose first commit read failed, once", async () => {
  const { checkout, log } = await storyCheckout({ mode: "fail" });
  const runner = previews();
  runner.view(checkout);
  await expect.poll(() => runner.state(checkout.base)?.state, WAIT).toBe("failed");

  expect(runner.view({ ...checkout, commit: "a" }).state).toBe("starting");
  await expect.poll(() => runner.state(checkout.base)?.state, WAIT).toBe("failed");
  expect(runner.view({ ...checkout, commit: "a" }).state).toBe("failed");
  expect(runner.view(checkout).state).toBe("failed");
  expect(previewStarts(log)).toHaveLength(2);
});

test("a view whose commit was read before the Storybook started does not restart it", async () => {
  const { checkout, log } = await storyCheckout({ mode: "fail" });
  const runner = previews();
  const older = runner.read();
  runner.view({ ...checkout, commit: "a", read: older });
  await expect.poll(() => previewStarts(log).length, WAIT).toBe(1);
  runner.view({ ...checkout, commit: "b", read: runner.read() });
  await expect.poll(() => previewStarts(log).length, WAIT).toBe(2);
  await expect.poll(() => runner.state(checkout.base)?.state, WAIT).toBe("failed");

  // The older read arrives last, as two views racing the commit's move can: it is not a move back.
  expect(runner.view({ ...checkout, commit: "a", read: older }).state).toBe("failed");
  expect(runner.view({ ...checkout, commit: "b", read: runner.read() }).state).toBe("failed");
  expect(previewStarts(log)).toHaveLength(2);
});

test("a read begun before the Storybook started, even the latest, does not restart it", async () => {
  const { checkout, log } = await storyCheckout({ mode: "fail" });
  const runner = previews();
  const [first, second] = [runner.read(), runner.read()];
  runner.view({ ...checkout, commit: "a", read: first });
  await expect.poll(() => runner.state(checkout.base)?.state, WAIT).toBe("failed");

  expect(runner.view({ ...checkout, commit: "b", read: second }).state).toBe("failed");
  expect(previewStarts(log)).toHaveLength(1);
});

test("each checkout has its own Storybook", async () => {
  const { checkout, log, repo } = await storyCheckout();
  const main = await checkoutOf(repo, "/r/repo/preview/main/");
  const runner = previews();

  runner.view(checkout);
  runner.view(main);
  await ready(runner, checkout);
  await ready(runner, main);

  const starts = previewStarts(log);
  expect(
    starts.map(({ base, cwd }) => ({ base, cwd })).sort((a, b) => a.cwd.localeCompare(b.cwd)),
  ).toEqual([
    { base: "/r/repo/preview/2026-10-20-sidebar-resize/", cwd: join(checkout.dir, "packages/web") },
    { base: "/r/repo/preview/main/", cwd: join(repo, "packages/web") },
  ]);
  expect(new Set(starts.map(({ port }) => port)).size).toBe(2);
});

test("a view under a base whose Storybook runs in another folder stops it and starts one there", async () => {
  // A repository removed from the list, and another of the same folder name added: the same base.
  const { checkout, log, repo } = await storyCheckout();
  const other = await checkoutOf(repo, checkout.base);
  const runner = previews();
  runner.view(checkout);
  await ready(runner, checkout);
  const [first] = previewStarts(log);

  expect(runner.view(other)).toEqual({ state: "starting" });

  await ready(runner, other);
  const starts = previewStarts(log);
  expect(starts).toHaveLength(2);
  expect(starts[1]!.cwd).toBe(join(repo, "packages/web"));
  expect(runner.state(other.base)).toEqual({ port: starts[1]!.port, state: "ready" });
  await expect.poll(() => alive(first!.pid), WAIT).toBe(false);
});

test("a ready Storybook's index is read", async () => {
  const { checkout } = await storyCheckout();
  const runner = previews();
  expect(await runner.index(checkout.base)).toBeUndefined();
  runner.view(checkout);
  await ready(runner, checkout);

  const index = await runner.index(checkout.base);

  expect(Object.keys(index?.entries ?? {}).sort()).toEqual([
    "sidebarhandle--dragging",
    "sidebarhandle--grip",
    "sidebarhandle--thinline",
  ]);
});

test("a state change is told", async () => {
  const { checkout } = await storyCheckout();
  const told: Array<[string, PreviewState["state"] | undefined]> = [];
  const runner = previews({
    onChange: (base) => told.push([base, runner.state(base)?.state]),
  });

  runner.view(checkout);
  await ready(runner, checkout);
  await runner.stopAll();

  expect(told).toEqual([
    [checkout.base, "starting"],
    [checkout.base, "ready"],
    [checkout.base, undefined],
  ]);
});

test("a command that exits by itself leaves no process of its group behind (SC-005)", async () => {
  const dir = temporaryFolder("uraeda-preview");
  const pidFile = join(dir, "grandchild.pid");
  // The shell starts a process that keeps none of its output, and exits at once.
  const command = `sleep 600 > /dev/null 2>&1 & echo $! > ${pidFile}; echo gone`;
  const runner = previews();

  runner.view({ base: "/r/repo/preview/main/", command, dir, folder: "." });

  await expect
    .poll(() => runner.state("/r/repo/preview/main/"), WAIT)
    .toEqual({ error: "Storybook did not start: gone", state: "failed" });
  expect(existsSync(pidFile)).toBe(true);
  await expect.poll(() => alive(Number(readFileSync(pidFile, "utf8"))), WAIT).toBe(false);
});

test("a ready Storybook that holds its index open is read as no index", async () => {
  const { checkout } = await storyCheckout({ mode: "hang-later" });
  const runner = previews({ indexMs: 100 });
  runner.view(checkout);
  await ready(runner, checkout);

  expect(await runner.index(checkout.base)).toBeUndefined();
});

test("once stopped, a runner starts nothing", async () => {
  const { checkout, log } = await storyCheckout();
  const runner = previews();
  await runner.stopAll();

  expect(runner.view(checkout)).toEqual({
    error: "Storybook is not running for this branch.",
    state: "failed",
  });
  expect(runner.restart(checkout)).toEqual({
    error: "Storybook is not running for this branch.",
    state: "failed",
  });
  expect(runner.state(checkout.base)).toBeUndefined();
  expect(previewStarts(log)).toEqual([]);
});
