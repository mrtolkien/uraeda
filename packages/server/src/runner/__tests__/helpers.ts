import { vi } from "vite-plus/test";
import { fixtureRepo } from "uraeda-binding/test-utils";
import { SessionCache } from "../cache.ts";
import { FakeAdapter } from "../fake.ts";
import { type SessionChange, Sessions } from "../sessions.ts";

/** The core's binding, as one object: the server takes it whole. */
const binding = await import("uraeda-binding");

/** Lets the session manager read the events emitted so far. */
export function flush() {
  return new Promise<void>((resolve) => setImmediate(resolve));
}

/**
 * A session manager on the fake adapter, an in-memory cache, and the real binding, checked once.
 * Its timers are fake: a test moves them with `vi.advanceTimersByTime`. `binding` replaces the real
 * one, as to hold a call.
 */
export async function testSessions(repo = fixtureRepo(), { binding: through = binding } = {}) {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  const adapter = new FakeAdapter();
  const cache = SessionCache.open(":memory:");
  const changes: Array<SessionChange> = [];
  const sessions = new Sessions({
    adapter,
    binding: through,
    cache,
    onChange: (change) => changes.push(change),
  });
  await sessions.check();
  return { adapter, cache, changes, repo, sessions };
}
