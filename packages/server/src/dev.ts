// `vp dev` at the root: Vite serves the UI, and this handler serves the server's routes in Vite's
// own process (see the web package's `vite.config.ts`).
import type { IncomingMessage, ServerResponse } from "node:http";
import { resolve } from "node:path";
import { getRequestListener } from "@hono/node-server";
import { createApp } from "./app.ts";
import { checkBinding, loadBinding } from "./binding.ts";
import { type Env, loadDataDir, loadEnv } from "./env.ts";
import type { Binding } from "./fate/context.ts";
import { startSessions } from "./live.ts";
import { Hosts } from "./repositories.ts";
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

/** The paths the server answers, a repository's and the global ones; Vite serves everything else. */
const SERVER_PATHS = /^\/(r\/[^/?]+\/)?(fate|raw|mockups)(\/|\?|$)/;

/** The process's session manager and hosts, shared by the dev server's apps. */
type Shared = {
  binding: Binding;
  dataDir: string;
  sessions: Sessions;
  hosts: Hosts;
  stop: () => Promise<void>;
};

/**
 * The process's one session manager and its hosts, on the list in the data folder, shared by the
 * dev server's apps, started with the first request.
 */
let shared: Promise<Shared> | undefined;

async function start(root: string, adapter: Adapter): Promise<Shared> {
  const binding = await loadBinding();
  const dataDir = loadDataDir(root);
  let hosts: Hosts | undefined;
  const started = await startSessions({ adapter, binding, dataDir, hosts: () => hosts });
  const opened = await Hosts.open({ binding, dataDir, sessions: started.sessions });
  hosts = opened;
  return {
    binding,
    dataDir,
    sessions: started.sessions,
    hosts: opened,
    stop: async () => {
      opened.close();
      await started.stop();
    },
  };
}

/**
 * Stops the turns of the dev server's sessions and closes their processes and watches, as Vite's
 * server closes. A server Vite starts again starts a new session manager.
 */
export async function stopDevRuns(): Promise<void> {
  const stopping = shared;
  shared = undefined;
  apps.clear();
  await (await stopping)?.stop();
}

/** The dev server's apps, by port and repository. */
const apps = new Map<string, (req: IncomingMessage, res: ServerResponse) => Promise<void>>();

/**
 * Forgets a repository the tests are done with: its apps, and its entry in the list, whose host
 * closes the watch of its files, which would otherwise go on for as long as the server runs.
 */
export async function forgetRepo(repo: string): Promise<void> {
  for (const key of apps.keys()) {
    if (key.endsWith(` ${repo}`)) {
      apps.delete(key);
    }
  }
  const started = await shared;
  const host = started?.hosts.byPath(repo);
  if (started && host) {
    await started.binding.removeRepository(started.dataDir, host.name);
    await started.hosts.reload();
  }
}

/**
 * A Connect middleware serving the server's routes for the repository of the settings, or of
 * `URAEDA_REPO` when it is set in the environment later, as tests do. The guard takes the port the
 * request came in on, Vite's own. The repository is added to the list with the first request to
 * it, which starts its host and its watch, and the session manager with the first request, on
 * Claude Code unless `adapter` says otherwise.
 */
export function devHandler(root: string, { adapter }: { adapter?: Adapter } = {}) {
  const env = loadEnv(root);
  const listener = async (repo: string, port: number) => {
    const key = `${port} ${repo}`;
    let app = apps.get(key);
    if (!app) {
      shared ??= start(root, adapter ?? new ClaudeAdapter({ pluginDir: PLUGIN_DIR }));
      const { binding, dataDir, sessions, hosts } = await shared;
      try {
        await binding.addRepository(dataDir, repo);
        await hosts.reload();
      } catch (error) {
        console.error(`uraeda: ${(error as Error).message.replace(/^refused: /, "")}`);
      }
      app = getRequestListener(
        createApp({ ...env, port, repo, allowOrigins: [], binding, sessions, hosts, dataDir })
          .fetch,
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
