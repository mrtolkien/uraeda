import { vi } from "vite-plus/test";
import { fixtureRepo } from "uraeda-binding/test-utils";
import type { Binding } from "../../fate/context.ts";
import { SessionCache } from "../cache.ts";
import { CONTINUES_OFF, type ContinueSettings } from "../continuer.ts";
import type { Limit } from "../events.ts";
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
 * one, as to hold a call. Its automatic continues are off, unless `runs` turns them on (R4);
 * `onChange` sees each change as it is published, with the cache as it is then.
 */
export async function testSessions(
  repo = fixtureRepo(),
  {
    binding: through = binding,
    onChange,
    runs = () => CONTINUES_OFF,
  }: {
    binding?: Binding;
    onChange?: (change: SessionChange, cache: SessionCache) => void;
    runs?: () => ContinueSettings;
  } = {},
) {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  const adapter = new FakeAdapter();
  const cache = SessionCache.open(":memory:");
  const changes: Array<SessionChange> = [];
  const sessions = new Sessions({
    adapter,
    binding: through,
    cache,
    onChange: (change) => {
      changes.push(change);
      onChange?.(change, cache);
    },
    runs,
  });
  await sessions.check();
  return { adapter, cache, changes, repo, sessions };
}

/**
 * Restarts the session manager, as the server does: stops its turns and clears its timers, then
 * starts a second one on the same cache and agent, checked once, whose continues `runs` sets.
 */
export async function restart(
  sessions: Sessions,
  { runs = () => CONTINUES_OFF }: { runs?: () => ContinueSettings } = {},
): Promise<Sessions> {
  await sessions.closeAll();
  sessions.close();
  const next = new Sessions({
    adapter: sessions.adapter,
    binding,
    cache: sessions.cache,
    onChange: () => {},
    runs,
  });
  await next.check();
  return next;
}

/** Scripts the next turn to be refused by a usage limit: its `limit` event, then a failed result. */
export function limitTurn(adapter: FakeAdapter, limit: Limit) {
  adapter.script([
    { limit, type: "limit" },
    {
      denials: [],
      errors: [limit.text ?? "Usage limit reached."],
      interrupted: false,
      ok: false,
      type: "result",
    },
  ]);
}
