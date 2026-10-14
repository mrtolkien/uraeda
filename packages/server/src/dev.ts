// `vp dev` at the root: Vite serves the UI, and this handler serves the server's routes in Vite's
// own process (see the web package's `vite.config.ts`).
import type { IncomingMessage, ServerResponse } from "node:http";
import { getRequestListener } from "@hono/node-server";
import { checkBinding, loadBinding } from "./binding.ts";
import { type Env, loadDataDir, loadEnv } from "./env.ts";
import type { Adapter } from "./runner/adapter.ts";
import { ClaudeAdapter, PLUGIN_DIR } from "./runner/claude.ts";
import { type Server, startServer } from "./server.ts";

export { checkBinding, loadEnv };

/** Vite's server options from the settings: 127.0.0.1 only, on its port, with the allowed hosts. */
export function devServer(env: Env) {
  return {
    allowedHosts: env.allowedHosts,
    host: "127.0.0.1",
    port: env.port,
    strictPort: true,
  };
}

/** The paths the server answers, a repository's and the global ones; Vite serves everything else. */
const SERVER_PATHS = /^\/(r\/[^/?]+\/)?(fate|raw|mockups)(\/|\?|$)/;

type Listener = (req: IncomingMessage, res: ServerResponse) => Promise<void>;

/** A started server of the dev server, and its app as a Node listener. */
type Started = { listener: Listener; server: Server };

/**
 * The dev server's servers, by port: one per Vite server, started with its first request, which
 * gives the port the guard takes, Vite's own.
 */
const servers = new Map<number, Promise<Started>>();

/**
 * Stops the turns of the dev server's sessions and closes their processes and watches, as Vite's
 * server closes. A server Vite starts again starts a new session manager.
 */
export async function stopDevRuns(): Promise<void> {
  const stopping = [...servers.values()];
  servers.clear();
  await Promise.all(
    stopping.map(async (started) => (await started.catch(() => undefined))?.server.stop()),
  );
}

/**
 * Reads the list of repositories again in every started server, as their watch of the list does
 * after a quiet moment: a repository added to or removed from the list through the binding is
 * served, or no longer, once it resolves. The browser tests list their own repository this way.
 */
export async function reloadRepositories(): Promise<void> {
  for (const pending of servers.values()) {
    const started = await pending.catch(() => undefined);
    await started?.server.hosts.reload();
  }
}

/**
 * A Connect middleware serving the server's routes, on the server `startServer` starts with the
 * first request to its port, in the repository of the settings read then, on Claude Code unless
 * `adapter` says otherwise. A start that fails answers 500 with its reason, and the next request
 * tries again.
 */
export function devHandler(root: string, { adapter }: { adapter?: Adapter } = {}) {
  const env = loadEnv(root);
  const start = async (port: number): Promise<Started> => {
    const binding = await loadBinding();
    const dataDir = loadDataDir(root);
    // Read with the first request, as the data folder is: the browser tests' setup sets them after
    // Vite's server is made.
    const server = await startServer({
      ...loadEnv(root),
      adapter: adapter ?? new ClaudeAdapter({ pluginDir: PLUGIN_DIR }),
      allowOrigins: [],
      binding,
      dataDir,
      port,
    });
    return { listener: getRequestListener(server.app.fetch), server };
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
  return (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    if (!SERVER_PATHS.test(req.url ?? "")) {
      next();
      return;
    }
    const port = req.socket.localPort ?? env.port;
    void serverOf(port).then(
      ({ listener }) => listener(req, res),
      (error: Error) => {
        res.statusCode = 500;
        res.end(error.message);
      },
    );
  };
}
