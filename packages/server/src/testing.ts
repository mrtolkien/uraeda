// The session manager the server's and the UI's tests use: the fake adapter, and a cache in memory.
import { createSessions, type HostsOf } from "./live.ts";
import { SessionCache } from "./runner/cache.ts";
import { FakeAdapter } from "./runner/fake.ts";

/** The core's binding, as one object: the server takes it whole. */
const binding = await import("uraeda-binding");

export { FakeAdapter };

/**
 * A session manager on the fake adapter, publishing live updates to `hosts`, and not checked yet:
 * it reads unavailable until `sessions.check()`, which finds the agent when `installed`.
 */
export function fakeSessions({
  hosts = () => undefined,
  installed = true,
}: { hosts?: HostsOf; installed?: boolean } = {}) {
  const adapter = new FakeAdapter();
  adapter.installed = installed;
  const sessions = createSessions({
    adapter,
    binding,
    cache: SessionCache.open(":memory:"),
    hosts,
  });
  return { adapter, sessions };
}
