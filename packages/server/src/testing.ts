// What the server's and the UI's tests use: the session manager on the fake adapter, with a cache in
// memory, sign-in on a test's data folder, and settings on a test's config folder.
import { temporaryFolder } from "uraeda-binding/test-utils";
import { createSessions, type HostsOf } from "./live.ts";
import { SessionCache } from "./runner/cache.ts";
import { FakeAdapter } from "./runner/fake.ts";
import { ServerSettings } from "./settings.ts";
import type { SignInOptions } from "./sign-in/check.ts";
import { OneTimeLinks } from "./sign-in/links.ts";
import { SignInStore } from "./sign-in/store.ts";

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

/**
 * Sign-in for a test's app on `dataDir`, as `createApp` takes it: a store with a new access key,
 * returned, and one-time links; a failed sign-in answers at once, and logs nothing.
 */
export function testSignIn(dataDir: string): { key: string; options: SignInOptions } {
  const { key, store } = SignInStore.open(dataDir);
  if (key === undefined) {
    throw new Error(`${dataDir} already has an access key: give the test a new data folder`);
  }
  return {
    key,
    options: { links: new OneTimeLinks(), log: () => {}, store, wait: async () => {} },
  };
}

/**
 * The settings of a test's server, on `dir`, a new empty config folder by default: the host names
 * of `--allowed-hosts` given for the run when `allowedHosts` is, else the file's. The caller
 * closes them, as `startServer`'s `stop` does.
 */
export function testSettings({
  allowedHosts,
  dir = temporaryFolder("uraeda-config"),
}: { allowedHosts?: Array<string>; dir?: string } = {}): Promise<ServerSettings> {
  return ServerSettings.open({
    binding,
    dir,
    options: {
      ...(allowedHosts && { allowedHosts: { name: "--allowed-hosts", value: allowedHosts } }),
      noOpen: false,
    },
  });
}
