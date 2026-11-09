// What the server's and the UI's tests use: the session manager on the fake adapter, with a cache in
// memory, sign-in on a test's data folder, and settings and themes on a test's config folder.
import { randomUUID } from "node:crypto";
import { realpathSync } from "node:fs";
import { join } from "node:path";
import { temporaryFolder } from "uraeda-binding/test-utils";
import { ExtensionsHost } from "./extensions/server.ts";
import type { Binding } from "./fate/context.ts";
import { createSessions, type HostsOf } from "./live.ts";
import type { Hosts } from "./repositories.ts";
import { SessionCache } from "./runner/cache.ts";
import { CONTINUES_OFF, type ContinueSettings } from "./runner/continuer.ts";
import type { TokenCounts } from "./runner/events.ts";
import { FakeAdapter } from "./runner/fake.ts";
import { runtimesOf } from "./runner/runtimes.ts";
import type { Sessions } from "./runner/sessions.ts";
import { ServerSettings, type SettingsEnvironment } from "./settings.ts";
import { ServerThemes } from "./themes.ts";
import type { SignInOptions } from "./sign-in/check.ts";
import { OneTimeLinks } from "./sign-in/links.ts";
import { SignInStore } from "./sign-in/store.ts";

/** The core's binding, as one object: the server takes it whole. */
const binding = await import("uraeda-binding");

export { FakeAdapter, type Sessions };

/**
 * A session manager on the fake adapter, `adapter` or a new one, registered as `fake`, publishing live updates to `hosts`,
 * and not checked yet: it reads unavailable until `sessions.check()`, which finds the agent when
 * `installed`. Its cache is in memory, or in the file `cache`, which the caller closes. `binding`
 * replaces the core's, as to hold a call. Its automatic continues are off, unless `runs` turns them
 * on (R4).
 */
export function fakeSessions<T extends FakeAdapter = FakeAdapter>({
  adapter = new FakeAdapter() as T,
  binding: using = binding,
  cache = ":memory:",
  hosts = () => undefined,
  installed = true,
  runs = () => CONTINUES_OFF,
}: {
  adapter?: T;
  binding?: Binding;
  cache?: string;
  hosts?: HostsOf;
  installed?: boolean;
  runs?: () => ContinueSettings;
} = {}): {
  adapter: T;
  sessions: Sessions;
} {
  adapter.installed = installed;
  const sessions = createSessions({
    binding: using,
    cache: SessionCache.open(cache),
    hosts,
    runs,
    runtimes: runtimesOf({ fake: adapter }),
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
 * of `--allowed-hosts` given for the run when `allowedHosts` is, else the file's, and the variables
 * of `environment`, none by default, not the developer's. The caller closes them, as `startServer`'s `stop` does.
 */
export function testSettings({
  allowedHosts,
  dir = temporaryFolder("uraeda-config"),
  environment = {},
}: {
  allowedHosts?: Array<string>;
  dir?: string;
  environment?: SettingsEnvironment;
} = {}): Promise<ServerSettings> {
  return ServerSettings.open({
    binding,
    dir,
    environment,
    options: {
      ...(allowedHosts && { allowedHosts: { name: "--allowed-hosts", value: allowedHosts } }),
      noOpen: false,
    },
  });
}

/**
 * The colour themes of a test's server, on the config folder `dir`: the shipped ones, and the
 * files the test writes in its `themes` folder. The caller closes them, as `startServer`'s `stop`
 * does.
 */
export function testThemes(dir: string): Promise<ServerThemes> {
  return ServerThemes.open({ binding, dir });
}

/**
 * The extensions of a test's server, on the config folder of `settings`: the built-ins with no
 * agent of their own, and yours loaded from its `extensions` folder, over `hosts`. The caller
 * closes them, as `startServer`'s `stop` does.
 */
export async function testExtensions({
  dataDir,
  hosts,
  sessions,
  settings,
}: {
  dataDir: string;
  hosts: Hosts;
  sessions: Sessions;
  settings: ServerSettings;
}): Promise<ExtensionsHost> {
  const extensions = await ExtensionsHost.open({
    agents: {},
    binding,
    configDir: settings.dir,
    dataDir,
    settings,
  });
  await extensions.start({ hosts, sessions, warm: () => {} });
  return extensions;
}

/**
 * Records a feature's past run in the runner's cache of `dataDir`, as the runner stores one on the
 * fake agent: a workflow turn of the feature's session, from `at` to `ended`, with its own token
 * counts. `repo` is the repository's main checkout, which keys its sessions. What the stories' and
 * screenshots' servers read as a feature's tokens.
 */
export function recordRun(
  dataDir: string,
  repo: string,
  folder: string,
  { at, ended, step, tokens }: { at: string; ended: string; step: string; tokens: TokenCounts },
) {
  const cache = SessionCache.open(join(dataDir, "runner.sqlite"));
  try {
    const repoRoot = realpathSync(repo);
    const session =
      cache.latestSession(repoRoot, folder) ??
      cache.createSession({
        agent: "fake",
        folder,
        nativeId: randomUUID(),
        repo: repoRoot,
        title: null,
      });
    const id = cache.addTurn({
      allowed: null,
      kind: "workflow",
      sessionId: session.id,
      state: "running",
      step,
      trigger: "manual",
    });
    cache.addTurnTokens(id, tokens);
    cache.endTurn(id, { state: "done" });
    cache.db
      .prepare("UPDATE turns SET started_at = ?, ended_at = ? WHERE id = ?")
      .run(at, ended, id);
  } finally {
    cache.db.close();
  }
}
