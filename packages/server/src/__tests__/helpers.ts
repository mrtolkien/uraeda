import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach } from "vite-plus/test";
import * as binding from "uraeda-binding";
import { fixture, fixtureRepo, git } from "uraeda-binding/test-utils";
import { createApp } from "../app.ts";
import { SessionCache } from "../runner/cache.ts";
import type { Sessions } from "../runner/sessions.ts";
import { fakeSessions } from "../testing.ts";

export { fixture, fixtureRepo, git };

export const port = 4310;

/** The session managers of a test, whose timers are cleared after it. */
const managers: Array<Sessions> = [];

afterEach(() => {
  for (const sessions of managers.splice(0)) {
    sessions.close();
  }
});

/** The server's app, called in process, on a repository, with sessions that have no agent. */
export function testApp(repo = fixtureRepo(), allowedHosts: Array<string> = []) {
  const { sessions } = fakeSessions({ installed: false });
  managers.push(sessions);
  return app(repo, allowedHosts, sessions);
}

function app(repo: string, allowedHosts: Array<string>, sessions: Sessions) {
  return createApp({
    repo,
    port,
    allowedHosts,
    allowOrigins: ["http://localhost:5173"],
    binding,
    sessions,
  });
}

/** The server's app with sessions on the fake adapter, checked once. */
export async function testServer(repo = fixtureRepo(), { installed = true } = {}) {
  const { sessions, adapter } = fakeSessions({ installed });
  managers.push(sessions);
  await sessions.check();
  return { app: app(repo, [], sessions), adapter, sessions, repo };
}

type App = ReturnType<typeof testApp>;

/** Sends native fate operations, and returns their results in order. */
export async function fate(app: App, operations: Array<Record<string, unknown>>) {
  const response = await app.request(`http://127.0.0.1:${port}/fate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      operations: operations.map((operation, index) => ({ id: String(index), ...operation })),
      version: 1,
    }),
  });
  const body = (await response.json()) as {
    results: Array<{ ok: boolean; data?: any; error?: { code: string; message: string } }>;
  };
  return body.results;
}

/** Reads records of a type by id, with the given fields. */
export async function byId(app: App, type: string, ids: Array<string>, select: Array<string>) {
  const [result] = await fate(app, [{ kind: "byId", type, ids, select }]);
  if (!result.ok) {
    throw new Error(result.error?.message);
  }
  return result.data as Array<Record<string, any>>;
}

/** Runs a mutation, and returns its result. */
export async function mutate(app: App, name: string, input: unknown, select: Array<string>) {
  const [result] = await fate(app, [{ kind: "mutation", name, input, select }]);
  return result;
}

/**
 * A repository with `count` feature branches besides the fixture's, for timing, each holding its
 * own folder's proposal: a branch without its folder is not a feature.
 */
export function repoWithBranches(count: number) {
  const repo = fixtureRepo();
  const proposal = git(repo, "show", "2026-10-11-web-ui:specs/2026-10-11-web-ui/proposal.md");
  for (let n = 0; n < count; n++) {
    const folder = `2026-11-${String(n + 1).padStart(2, "0")}-feature-${n}`;
    git(repo, "switch", "--quiet", "--create", folder, "2026-10-11-web-ui");
    mkdirSync(join(repo, "specs", folder));
    writeFileSync(join(repo, "specs", folder, "proposal.md"), proposal);
    git(repo, "add", "specs");
    git(repo, "commit", "--quiet", "--no-verify", "--message", "chore: proposal");
  }
  git(repo, "switch", "--quiet", "main");
  return repo;
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
      repo: "/repo",
      folder: null,
      agent: "fake",
      nativeId: `native-${n}`,
      title: `Chat ${n}`,
    });
    const turn = cache.addTurn({
      sessionId: session.id,
      kind: "chat",
      trigger: null,
      step: null,
      allowed: null,
      state: "running",
    });
    cache.appendItem(turn, {
      kind: "message",
      id: `message-${n}`,
      text: `Question ${n} about the cache`,
      origin: "human",
      state: "read",
    });
    for (let seq = 1; seq < perSession; seq++) {
      const last = n === sessions / 2 && seq === perSession - 1;
      if (last) {
        needle = session.id;
      }
      cache.appendItem(turn, {
        kind: last || seq % 2 === 0 ? "text" : "system",
        text: last ? "Found the needle in the runner" : `Reply ${seq} of chat ${n}, about WAL mode`,
        streaming: false,
      } as Parameters<SessionCache["appendItem"]>[1]);
    }
  }
  return { cache, needle };
}
