// `vp dev` at the root: Vite serves the UI, and this handler serves the server's routes in Vite's
// own process (see the web package's `vite.config.ts`).
import type { IncomingMessage, ServerResponse } from "node:http";
import { resolve } from "node:path";
import { getRequestListener } from "@hono/node-server";
import { createApp } from "./app.ts";
import { checkBinding, loadBinding } from "./binding.ts";
import { type Env, loadDataDir, loadEnv } from "./env.ts";
import type { Binding } from "./fate/context.ts";
import type { Adapter } from "./runner/adapter.ts";
import { ClaudeAdapter, PLUGIN_DIR } from "./runner/claude.ts";
import { type Server, startServer } from "./server.ts";

export { checkBinding, loadEnv };

/** Vite's server options from the settings: 127.0.0.1 only, on its port, with the allowed hosts. */
export function devServer(env: Env) {
  return {
    host: "127.0.0.1",
    port: env.port,
    strictPort: true,
    allowedHosts: env.allowedHosts,
  };
}

/** The paths the server answers, a repository's and the global ones; Vite serves everything else. */
const SERVER_PATHS = /^\/(r\/[^/?]+\/)?(fate|raw|mockups)(\/|\?|$)/;

type Listener = (req: IncomingMessage, res: ServerResponse) => Promise<void>;

/** A started server of the dev server, and its app as a Node listener. */
type Started = { server: Server; binding: Binding; dataDir: string; listener: Listener };

/**
 * The dev server's servers, by port: one per Vite server, started with its first request, which
 * gives the port the guard takes, Vite's own.
 */
const servers = new Map<number, Promise<Started>>();

/**
 * TEMPORARY (task 9): the apps of the repositories the browser tests name in `URAEDA_REPO`, by
 * port and repository, on their port's server. Task 9 opens each test's repository at
 * `/r/<name>/` instead.
 */
const apps = new Map<string, Listener>();

/**
 * Stops the turns of the dev server's sessions and closes their processes and watches, as Vite's
 * server closes. A server Vite starts again starts a new session manager.
 */
export async function stopDevRuns(): Promise<void> {
  const stopping = [...servers.values()];
  servers.clear();
  apps.clear();
  await Promise.all(
    stopping.map(async (started) => (await started.catch(() => undefined))?.server.stop()),
  );
}

/**
 * TEMPORARY (task 9): forgets a repository the browser tests are done with: its apps, and its
 * entry in the list, whose host closes the watch of its files, which would otherwise go on for as
 * long as the server runs.
 */
export async function forgetRepo(repo: string): Promise<void> {
  for (const key of apps.keys()) {
    if (key.endsWith(` ${repo}`)) {
      apps.delete(key);
    }
  }
  for (const pending of servers.values()) {
    const started = await pending.catch(() => undefined);
    const host = started?.server.hosts.byPath(repo);
    if (started && host) {
      await started.binding.removeRepository(started.dataDir, host.name);
      await started.server.hosts.reload();
    }
  }
}

/**
 * A Connect middleware serving the server's routes, on the server `startServer` starts with the
 * first request to its port, in the repository of the settings, on Claude Code unless `adapter`
 * says otherwise. A start that fails answers 500 with its reason, and the next request tries again.
 */
export function devHandler(root: string, { adapter }: { adapter?: Adapter } = {}) {
  const env = loadEnv(root);
  const start = async (port: number): Promise<Started> => {
    const binding = await loadBinding();
    const dataDir = loadDataDir(root);
    const server = await startServer({
      ...env,
      port,
      allowOrigins: [],
      binding,
      dataDir,
      adapter: adapter ?? new ClaudeAdapter({ pluginDir: PLUGIN_DIR }),
    });
    return { server, binding, dataDir, listener: getRequestListener(server.app.fetch) };
  };
  const serverOf = (port: number) => {
    let started = servers.get(port);
    if (!started) {
      started = start(port);
      servers.set(port, started);
      started.catch((error: Error) => {
        servers.delete(port);
        console.error(`uraeda: ${error.message}`);
      });
    }
    return started;
  };
  const listener = async (port: number): Promise<Listener> => {
    const started = await serverOf(port);
    // TEMPORARY (task 9): the browser tests set `URAEDA_REPO` for each test, read at each request.
    const repo = process.env.URAEDA_REPO ? resolve(root, process.env.URAEDA_REPO) : env.repo;
    if (repo === env.repo) {
      return started.listener;
    }
    const key = `${port} ${repo}`;
    let app = apps.get(key);
    if (!app) {
      const { server, binding, dataDir } = started;
      try {
        await binding.addRepository(dataDir, repo);
        await server.hosts.reload();
      } catch (error) {
        console.error(`uraeda: ${(error as Error).message.replace(/^refused: /, "")}`);
      }
      app = getRequestListener(
        createApp({
          ...env,
          port,
          repo,
          allowOrigins: [],
          binding,
          sessions: server.sessions,
          hosts: server.hosts,
          dataDir,
        }).fetch,
      );
      apps.set(key, app);
    }
    return app;
  };
  return (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    if (!SERVER_PATHS.test(req.url ?? "")) {
      next();
      return;
    }
    const port = req.socket.localPort ?? env.port;
    void listener(port).then(
      (app) => app(req, res),
      (error: Error) => {
        res.statusCode = 500;
        res.end(error.message);
      },
    );
  };
}
