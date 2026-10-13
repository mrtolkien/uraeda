// The session manager the server's and the UI's tests use: the fake adapter, and a cache in memory.
import * as binding from "uraeda-binding";
import { createSessions } from "./live.ts";
import { SessionCache } from "./runner/cache.ts";
import { FakeAdapter } from "./runner/fake.ts";

export { FakeAdapter };

/**
 * A session manager on the fake adapter, publishing live updates, and not checked yet: it reads
 * unavailable until `sessions.check()`, which finds the agent when `installed`.
 */
export function fakeSessions({ installed = true }: { installed?: boolean } = {}) {
  const adapter = new FakeAdapter();
  adapter.installed = installed;
  const sessions = createSessions({ adapter, cache: SessionCache.open(":memory:"), binding });
  return { sessions, adapter };
}
