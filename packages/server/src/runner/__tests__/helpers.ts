import { vi } from "vite-plus/test";
import * as binding from "uraeda-binding";
import { fixtureRepo } from "uraeda-binding/test-utils";
import { RunCache, SessionCache } from "../cache.ts";
import { FakeAdapter } from "../fake.ts";
import { Runner, type RunnerChange } from "../runner.ts";
import { type SessionChange, Sessions } from "../sessions.ts";

/** A runner on the fake adapter, an in-memory cache, and the real binding, checked once. */
export async function testRunner(repo = fixtureRepo()) {
  const adapter = new FakeAdapter();
  const cache = RunCache.open(":memory:");
  const changes: Array<RunnerChange> = [];
  const runner = new Runner({
    adapter,
    cache,
    binding,
    pluginDir: "/plugin",
    onChange: (change) => changes.push(change),
  });
  await runner.check();
  return { runner, adapter, cache, repo, changes };
}

/** Waits for the run to end. */
export function settle(runner: Runner, id: number) {
  return runner.settled(id);
}

/** Lets the runner read the events emitted so far. */
export function flush() {
  return new Promise<void>((resolve) => setImmediate(resolve));
}

/**
 * A session manager on the fake adapter, an in-memory cache, and the real binding, checked once.
 * Its timers are fake: a test moves them with `vi.advanceTimersByTime`.
 */
export async function testSessions(repo = fixtureRepo()) {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  const adapter = new FakeAdapter();
  const cache = SessionCache.open(":memory:");
  const changes: Array<SessionChange> = [];
  const sessions = new Sessions({
    adapter,
    cache,
    binding,
    onChange: (change) => changes.push(change),
  });
  await sessions.check();
  return { sessions, adapter, cache, repo, changes };
}
