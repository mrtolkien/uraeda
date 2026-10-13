// `vp dev` at the root: Vite serves the UI, and this handler serves the server's routes in Vite's
// own process (see the web package's `vite.config.ts`).
import type { IncomingMessage, ServerResponse } from "node:http";
import { resolve } from "node:path";
import { getRequestListener } from "@hono/node-server";
import { createApp } from "./app.ts";
import { checkBinding, loadBinding } from "./binding.ts";
import { type Env, loadDataDir, loadEnv } from "./env.ts";
import { startLive, startSessions, stopLive } from "./live.ts";
import type { Adapter } from "./runner/adapter.ts";
import { ClaudeAdapter, PLUGIN_DIR } from "./runner/claude.ts";
import type { Sessions } from "./runner/sessions.ts";

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

/** The paths the server answers; Vite serves everything else. */
const SERVER_PATHS = /^\/(fate|raw|mockups)(\/|\?|$)/;

/**
 * The process's one session manager, shared by the dev server's apps, started with the first
 * request.
 */
let shared: Promise<{ sessions: Sessions; stop: () => Promise<void> }> | undefined;

/**
 * Stops the turns of the dev server's sessions and closes their processes, as Vite's server
 * closes. A server Vite starts again starts a new session manager.
 */
export async function stopDevRuns(): Promise<void> {
  const stopping = shared;
  shared = undefined;
  await (await stopping)?.stop();
}

/** The dev server's apps, by port and repository. */
const apps = new Map<string, (req: IncomingMessage, res: ServerResponse) => Promise<void>>();

/**
 * Forgets a repository the tests are done with: its apps, and the watch of its files, which would
 * otherwise go on for as long as the server runs.
 */
export function forgetRepo(repo: string): void {
  for (const key of apps.keys()) {
    if (key.endsWith(` ${repo}`)) {
      apps.delete(key);
    }
  }
  stopLive(repo);
}

/**
 * A Connect middleware serving the server's routes for the repository of the settings, or of
 * `URAEDA_REPO` when it is set in the environment later, as tests do. The guard takes the port the
 * request came in on, Vite's own. The core's watcher starts with the first request to each
 * repository, and the session manager with the first request, on Claude Code unless `adapter` says otherwise.
 */
export function devHandler(root: string, { adapter }: { adapter?: Adapter } = {}) {
  const env = loadEnv(root);
  const listener = async (repo: string, port: number) => {
    const key = `${port} ${repo}`;
    let app = apps.get(key);
    if (!app) {
      const binding = await loadBinding();
      shared ??= startSessions({
        adapter: adapter ?? new ClaudeAdapter({ pluginDir: PLUGIN_DIR }),
        binding,
        dataDir: loadDataDir(root),
      });
      const { sessions } = await shared;
      try {
        startLive(binding, repo);
      } catch (error) {
        console.error(`uraeda: ${(error as Error).message}; pages refresh when shown again`);
      }
      app = getRequestListener(
        createApp({ ...env, port, repo, allowOrigins: [], binding, sessions }).fetch,
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
    const repo = process.env.URAEDA_REPO ? resolve(root, process.env.URAEDA_REPO) : env.repo;
    const port = req.socket.localPort ?? env.port;
    void listener(repo, port).then((app) => app(req, res));
  };
}
