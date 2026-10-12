// The runner the server's and the UI's tests use: the fake adapter, and a cache in memory.
import * as binding from "uraeda-binding";
import { createRunner } from "./live.ts";
import { RunCache } from "./runner/cache.ts";
import { FakeAdapter } from "./runner/fake.ts";

export { FakeAdapter };

/**
 * A runner on the fake adapter, publishing live updates, and not checked yet: it reads unavailable
 * until `runner.check()`, which finds the agent when `installed`.
 */
export function fakeRunner({ installed = true }: { installed?: boolean } = {}) {
  const adapter = new FakeAdapter();
  adapter.installed = installed;
  const runner = createRunner({
    adapter,
    cache: RunCache.open(":memory:"),
    binding,
    pluginDir: "/plugin",
  });
  return { runner, adapter };
}
