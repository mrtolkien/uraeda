import { afterEach } from "vite-plus/test";
import {
  addChange,
  addPlan,
  commitOnBranch,
  ELEVEN,
  fixture,
  fixtureRepo,
  git,
  temporaryFolder,
} from "uraeda-binding/test-utils";
import { createApp } from "../app.ts";
import type { Binding } from "../fate/context.ts";
import { livePreviews } from "../live.ts";
import type { Previews } from "../preview/runner.ts";
import { Hosts } from "../repositories.ts";
import { SessionCache } from "../runner/cache.ts";
import type { Sessions } from "../runner/sessions.ts";
import { fakeSessions } from "../testing.ts";

/** The core's binding, as one object: the server takes it whole. */
const binding = await import("uraeda-binding");

export { addChange, addPlan, binding, commitOnBranch, ELEVEN, fixture, fixtureRepo, git };

export const port = 4310;

/** The session managers of a test, whose timers are cleared after it. */
const managers: Array<Sessions> = [];
/** The hosts of a test, whose watches are closed after it. */
const opened: Array<Hosts> = [];
/** The Storybook runners of a test, stopped after it. */
const runners: Array<Previews> = [];

afterEach(async () => {
  for (const sessions of managers.splice(0)) {
    sessions.close();
  }
  for (const hosts of opened.splice(0)) {
    hosts.close();
  }
  await Promise.all(runners.splice(0).map((runner) => runner.stopAll()));
});

/** A Storybook runner for a test's app, stopped after the test. */
export function testPreviews(): Previews {
  const runner = livePreviews();
  runners.push(runner);
  return runner;
}

type App = ReturnType<typeof createApp>;

/** A value of fate's JSON results, which the tests read field by field. */
// oxlint-disable-next-line typescript/no-explicit-any -- before the code quality decision: the tests read untyped fate results by path; typing them means a type per view
export type Data = any;

/** A data folder for a test's server, in a temporary folder removed as the tests exit. */
export const testDataDir = () => temporaryFolder("uraeda-data");

/** The name each test app's `fate` calls go to: its first repository's. */
const names = new WeakMap<App, string>();

/**
 * Hosts on a temporary data folder holding the repositories, added through the binding in order,
 * with a fake session manager whose changes reach them. Closed after the test.
 */
export async function testHosts(
  repos: Array<string>,
  { binding: using = binding, installed = true }: { binding?: Binding; installed?: boolean } = {},
) {
  const dataDir = temporaryFolder("uraeda-data");
  const added = [];
  for (const repo of repos) {
    added.push((await binding.addRepository(dataDir, repo)).repository.name);
  }
  // The session manager may read the hosts while they open: undefined until then.
  const opening: { hosts?: Hosts } = {};
  const { adapter, sessions } = fakeSessions({ hosts: () => opening.hosts, installed });
  managers.push(sessions);
  const hosts = await Hosts.open({ binding: using, dataDir, sessions });
  opening.hosts = hosts;
  opened.push(hosts);
  return { adapter, dataDir, hosts, names: added, sessions };
}

function app(
  allowedHosts: Array<string>,
  { dataDir, hosts, names: [name], sessions }: Awaited<ReturnType<typeof testHosts>>,
  using: Binding = binding,
) {
  const previews = testPreviews();
  const created = createApp({
    allowedHosts,
    allowOrigins: ["http://localhost:5173"],
    binding: using,
    dataDir,
    hosts,
    port,
    previews,
    sessions,
  });
  names.set(created, name);
  return { app: created, previews };
}

/**
 * The server's app, called in process, on a repository added to a temporary list, with sessions
 * that have no agent, on the core's binding or a fake of it. `name` is the repository's in the
 * list, and `previews` the app's Storybook runner.
 */
export async function testApp(
  repo = fixtureRepo(),
  {
    allowedHosts = [],
    binding: using = binding,
  }: { allowedHosts?: Array<string>; binding?: Binding } = {},
) {
  const opened = await testHosts([repo], { binding: using, installed: false });
  return { ...opened, ...app(allowedHosts, opened, using), name: opened.names[0], repo };
}

/** The server's app with sessions on the fake adapter, checked once. */
export async function testServer(repo = fixtureRepo(), { installed = true } = {}) {
  const opened = await testHosts([repo], { installed });
  await opened.sessions.check();
  return { ...opened, ...app([], opened), name: opened.names[0], repo };
}

/**
 * Sends native fate operations to a repository's endpoint, or the global one for a null name, and
 * returns their results in order.
 */
export async function fateAt(
  app: App,
  name: string | null,
  operations: Array<Record<string, unknown>>,
) {
  const base = name === null ? "" : `/r/${name}`;
  const response = await app.request(`http://127.0.0.1:${port}${base}/fate`, {
    body: JSON.stringify({
      operations: operations.map((operation, index) => ({ id: String(index), ...operation })),
      version: 1,
    }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  const body = (await response.json()) as {
    results: Array<{ data?: Data; error?: { code: string; message: string }; ok: boolean }>;
  };
  return body.results;
}

/** Sends native fate operations to the app's repository, and returns their results in order. */
export async function fate(app: App, operations: Array<Record<string, unknown>>) {
  return fateAt(app, names.get(app)!, operations);
}

/** Reads records of a type by id, with the given fields, from a repository's endpoint. */
export async function byIdAt(
  app: App,
  name: string | null,
  type: string,
  ids: Array<string>,
  select: Array<string>,
) {
  const [result] = await fateAt(app, name, [{ ids, kind: "byId", select, type }]);
  if (!result.ok) {
    throw new Error(result.error?.message);
  }
  return result.data as Array<Record<string, Data>>;
}

/** Reads records of a type by id, with the given fields. */
export async function byId(app: App, type: string, ids: Array<string>, select: Array<string>) {
  return byIdAt(app, names.get(app)!, type, ids, select);
}

/** Runs a mutation, and returns its result. */
export async function mutate(app: App, name: string, input: unknown, select: Array<string>) {
  const [result] = await fate(app, [{ input, kind: "mutation", name, select }]);
  return result;
}

/**
 * A cache in memory holding `sessions` chats of `/repo` with `items` items in all, one turn each,
 * for timing the search. Only the middle session's last item says "needle".
 */
export function searchCache(sessions = 500, items = 100_000) {
  const cache = SessionCache.open(":memory:");
  const perSession = items / sessions;
  let needle = "";
  for (let n = 0; n < sessions; n++) {
    const session = cache.createSession({
      agent: "fake",
      folder: null,
      nativeId: `native-${n}`,
      repo: "/repo",
      title: `Chat ${n}`,
    });
    const turn = cache.addTurn({
      allowed: null,
      kind: "chat",
      sessionId: session.id,
      state: "running",
      step: null,
      trigger: null,
    });
    cache.appendItem(turn, {
      id: `message-${n}`,
      kind: "message",
      origin: "human",
      state: "read",
      text: `Question ${n} about the cache`,
    });
    for (let seq = 1; seq < perSession; seq++) {
      const last = n === sessions / 2 && seq === perSession - 1;
      if (last) {
        needle = session.id;
      }
      cache.appendItem(turn, {
        kind: last || seq % 2 === 0 ? "text" : "system",
        streaming: false,
        text: last ? "Found the needle in the runner" : `Reply ${seq} of chat ${n}, about WAL mode`,
      } as Parameters<SessionCache["appendItem"]>[1]);
    }
  }
  return { cache, needle };
}
