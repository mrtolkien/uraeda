import { vi } from "vite-plus/test";
import type { RunOptions } from "uraeda-binding";
import { fixtureRepo } from "uraeda-binding/test-utils";
import type { Binding } from "../../fate/context.ts";
import type { ServerAddress } from "../../mcp/endpoint.ts";
import type { McpTokens } from "../../mcp/tokens.ts";
import { SessionCache } from "../cache.ts";
import { CONTINUES_OFF, type ContinueSettings } from "../continuer.ts";
import type { Denial, Limit } from "../events.ts";
import { FakeAdapter } from "../fake.ts";
import { type Runtimes, runtimesOf } from "../runtimes.ts";
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
 * `onChange` sees each change as it is published, with the cache as it is then. Its fake adapter is
 * the runtime `fake`, unless `runtimes` gives others. `runOptions` gives each feature's run options,
 * the defaults when left out. `mcp` gives its workflow processes Uraeda's tools.
 */
export async function testSessions(
  repo = fixtureRepo(),
  {
    binding: through = binding,
    mcp,
    onChange,
    runOptions,
    runs = () => CONTINUES_OFF,
    runtimes,
  }: {
    binding?: Binding;
    mcp?: { address: ServerAddress; tokens: McpTokens };
    onChange?: (change: SessionChange, cache: SessionCache) => void;
    runOptions?: (repo: string, folder: string) => RunOptions;
    runs?: () => ContinueSettings;
    runtimes?: Runtimes;
  } = {},
) {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  const adapter = new FakeAdapter();
  const cache = SessionCache.open(":memory:");
  const changes: Array<SessionChange> = [];
  const sessions = new Sessions({
    binding: through,
    cache,
    ...(mcp === undefined ? {} : { mcp }),
    onChange: (change) => {
      changes.push(change);
      onChange?.(change, cache);
    },
    ...(runOptions === undefined ? {} : { runOptions }),
    runs,
    runtimes: runtimes ?? runtimesOf({ fake: adapter }),
  });
  await sessions.check();
  return { adapter, cache, changes, repo, sessions };
}

/**
 * Restarts the session manager, as the server does: stops its turns and clears its timers, then
 * starts a second one on the same cache and agent, checked once, whose continues `runs` sets, and
 * which hosts the repositories `hosted` holds, every one by default.
 */
export async function restart(
  sessions: Sessions,
  {
    hosted,
    runs = () => CONTINUES_OFF,
  }: { hosted?: (root: string) => boolean; runs?: () => ContinueSettings } = {},
): Promise<Sessions> {
  await sessions.closeAll();
  sessions.close();
  const next = new Sessions({
    binding,
    cache: sessions.cache,
    ...(hosted === undefined ? {} : { hosted }),
    onChange: () => {},
    runs,
    runtimes: sessions.runtimes,
  });
  await next.check();
  return next;
}

/**
 * Scripts the next turn to be refused by a usage limit: its `limit` event, then a failed result,
 * with the actions `denials` blocked before.
 */
export function limitTurn(adapter: FakeAdapter, limit: Limit, denials: Array<Denial> = []) {
  adapter.script([
    { limit, type: "limit" },
    {
      denials,
      errors: [limit.text ?? "Usage limit reached."],
      interrupted: false,
      ok: false,
      type: "result",
    },
  ]);
}
