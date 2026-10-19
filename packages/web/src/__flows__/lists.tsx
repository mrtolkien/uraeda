// What the repository, notifier, and sign-in flows share beyond the harness: a server over a list of
// several repositories written as by hand, with its data folder in reach of the test, so a flow
// changes the list behind the page's back, as `ura add` would.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { act, cleanup, render } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach } from "vite-plus/test";
import { temporaryFolder } from "uraeda-binding/test-utils";
import { createApp, Hosts, livePreviews } from "uraeda-server";
import { fakeSessions, testSettings } from "uraeda-server/testing";
import { App } from "../App.tsx";
import { ServerFetch } from "../attach/ServerFetch.tsx";
import { fateClients } from "../clients.ts";
import { forgetUnsaved } from "../fields/unsaved.ts";
import { forgetUndoToasts } from "../layout/useUndoToast.ts";
import { forgetSignedOut } from "../sign-in/signedOut.ts";

const binding = await import("uraeda-binding");
const origin = "http://127.0.0.1:4310";

/** happy-dom has no EventSource: live views receive nothing. */
class SilentEventSource {
  readyState = 0;
  addEventListener() {}
  removeEventListener() {}
  close() {}
}

/**
 * Writes a list of repositories in a data folder, as by hand, each opened a minute before the one
 * above it, all long ago, so a repository the flow opens moves first.
 */
export function writeList(dataDir: string, repositories: Array<[name: string, path: string]>) {
  writeFileSync(
    join(dataDir, "repositories.json"),
    JSON.stringify({
      repositories: repositories.map(([name, path], index) => ({
        name,
        openedAt: `2000-01-01T10:${String(59 - index).padStart(2, "0")}:00Z`,
        path,
      })),
      version: 1,
    }),
  );
}

/** What a flow gets of its server over a list. */
export type ListApp = {
  /** The fake agent, installed or not. */
  agent: ReturnType<typeof fakeSessions>["adapter"];
  dataDir: string;
  fetch: typeof globalThis.fetch;
  /** The page at an address as given, `/` or `/r/old-site/`. */
  open: (path: string, options?: { reload?: boolean }) => Promise<ReturnType<typeof render>>;
  sessions: ReturnType<typeof fakeSessions>["sessions"];
  /** Waits until the server answered every request the page sent, those sent meanwhile too. */
  settle: () => Promise<void>;
};

/** Waits until every request in `pending` is answered, those sent meanwhile too. */
async function settled(pending: Set<Promise<unknown>>) {
  do {
    // A request the page queued as it went is sent at the next turn of the event loop.
    await new Promise((resolve) => setImmediate(resolve));
    await Promise.allSettled(pending);
  } while (pending.size > 0);
}

/** The server over the list `repositories` makes, closed after the file's last test. */
export function startListApp(
  repositories: () => Array<[name: string, path: string]>,
  { agent = false }: { agent?: boolean } = {},
): ListApp {
  const app = {} as ListApp;
  const pending = new Set<Promise<unknown>>();
  const closers: Array<() => Promise<void> | void> = [];
  const settle = () => settled(pending);
  beforeAll(async () => {
    const dataDir = temporaryFolder("uraeda-data");
    writeList(dataDir, repositories());
    const fake = fakeSessions({ installed: agent });
    if (agent) {
      await fake.sessions.check();
    }
    const hosts = await Hosts.open({ binding, dataDir, sessions: fake.sessions });
    const settings = await testSettings();
    const previews = livePreviews();
    const created = createApp({
      allowOrigins: [],
      binding,
      dataDir,
      hosts,
      port: 4310,
      previews,
      sessions: fake.sessions,
      settings,
    });
    closers.push(
      () => hosts.close(),
      () => settings.close(),
      () => fake.sessions.close(),
      () => previews.stopAll(),
    );
    const fetch: typeof globalThis.fetch = (input, init) => {
      const response = (async () => {
        const url = new URL(
          typeof input === "object" && "url" in input ? input.url : input.toString(),
          origin,
        ).href;
        const request = new Request(url, {
          body: init?.body as string,
          headers: { "content-type": "application/json" },
          method: init?.method,
        });
        const answer = await created.request(request);
        const text = await answer.text();
        return new Response(answer.status === 204 ? null : text, {
          headers: { "content-type": answer.headers.get("content-type") ?? "application/json" },
          status: answer.status,
        });
      })();
      pending.add(response);
      const done = () => pending.delete(response);
      void response.then(done, done);
      return response;
    };
    Object.assign(app, {
      agent: fake.adapter,
      dataDir,
      fetch,
      open: async (path: string, options: { reload?: boolean } = {}) => {
        if (options.reload) {
          cleanup();
        } else {
          window.history.replaceState(null, "", path);
        }
        return act(async () =>
          render(
            <ServerFetch fetch={fetch}>
              <App clientFor={fateClients({ fetch, origin })} />
            </ServerFetch>,
          ),
        );
      },
      sessions: fake.sessions,
      settle,
    });
  }, 60_000);
  beforeEach(() => {
    (globalThis as { EventSource?: unknown }).EventSource = SilentEventSource;
    forgetUndoToasts();
    forgetUnsaved();
    forgetSignedOut();
    window.localStorage.clear();
  });
  afterEach(async () => {
    cleanup();
    await settle();
  });
  afterAll(async () => {
    for (const close of closers) {
      await close();
    }
  }, 60_000);
  return app;
}
