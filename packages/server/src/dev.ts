// `vp dev` at the root: Vite serves the UI, and this handler serves the server's routes in Vite's
// own process (see the web package's `vite.config.ts`).
import type { IncomingMessage, ServerResponse } from "node:http";
import { resolve } from "node:path";
import { getRequestListener } from "@hono/node-server";
import { createApp } from "./app.ts";
import { loadBinding } from "./binding.ts";
import { type Env, loadDataDir, loadEnv } from "./env.ts";
import { startLive, startRunner } from "./live.ts";
import type { Adapter } from "./runner/adapter.ts";
import { ClaudeAdapter, PLUGIN_DIR } from "./runner/claude.ts";
import type { Runner } from "./runner/runner.ts";

export { loadEnv };

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

/** The process's one runner, shared by the dev server's apps, started with the first request. */
let shared: Promise<{ runner: Runner; stop: () => Promise<void> }> | undefined;

/**
 * Stops the runs of the dev server's runner, as Vite's server closes. A server Vite starts again
 * starts a new runner.
 */
export async function stopDevRuns(): Promise<void> {
  const stopping = shared;
  shared = undefined;
  await (await stopping)?.stop();
}

/**
 * A Connect middleware serving the server's routes for the repository of the settings, or of
 * `URAEDA_REPO` when it is set in the environment later, as tests do. The guard takes the port the
 * request came in on, Vite's own. The core's watcher starts with the first request to each
 * repository, and the runner with the first request, on Claude Code unless `adapter` says otherwise.
 */
export function devHandler(root: string, { adapter }: { adapter?: Adapter } = {}) {
  const env = loadEnv(root);
  const apps = new Map<string, (req: IncomingMessage, res: ServerResponse) => Promise<void>>();
  const listener = async (repo: string, port: number) => {
    const key = `${port} ${repo}`;
    let app = apps.get(key);
    if (!app) {
      const binding = await loadBinding();
      shared ??= startRunner({
        adapter: adapter ?? new ClaudeAdapter(),
        binding,
        dataDir: loadDataDir(root),
        pluginDir: PLUGIN_DIR,
      });
      const { runner } = await shared;
      try {
        startLive(binding, repo);
      } catch (error) {
        console.error(`uraeda: ${(error as Error).message}; pages refresh when shown again`);
      }
      app = getRequestListener(
        createApp({ ...env, port, repo, allowOrigins: [], binding, runner }).fetch,
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
