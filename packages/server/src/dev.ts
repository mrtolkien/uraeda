// `vp dev` at the root: Vite serves the UI, and this handler serves the server's routes in Vite's
// own process (see the web package's `vite.config.ts`).
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Duplex } from "node:stream";
import { getRequestListener } from "@hono/node-server";
import { chatImages } from "./attach.ts";
import { checkBinding, loadBinding } from "./binding.ts";
import { type Env, loadDataDir, loadEnv, type Sources } from "./env.ts";
import { PREVIEW_PATH } from "./guard.ts";
import { refuse, upgradeUrl } from "./preview/proxy.ts";
import type { Previews } from "./preview/runner.ts";
import type { Adapter } from "./runner/adapter.ts";
import { layout } from "./paths.ts";
import { ClaudeAdapter } from "./runner/claude.ts";
import { SERVER_PATHS } from "./server-paths.ts";
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
 * The upgrades of Vite's server: those under a preview's path go to the server of its port, which
 * its first request started; Vite answers the others, its own HMR socket among them. A target that
 * is not a URL is refused with a 400.
 */
export function devUpgrade(): (request: IncomingMessage, socket: Duplex, head: Buffer) => void {
  return (request, socket, head) => {
    const url = upgradeUrl(request);
    if (url === undefined) {
      socket.on("error", () => socket.destroy());
      refuse(socket, "400 Bad Request", "Bad request");
      return;
    }
    if (!PREVIEW_PATH.test(url.pathname)) {
      return;
    }
    const started = servers.get(request.socket.localPort ?? 0);
    if (started === undefined) {
      socket.destroy();
      return;
    }
    void started.then(
      ({ server }) => server.upgrade(request, socket, head),
      () => socket.destroy(),
    );
  };
}

/** The Storybooks of the server started on Vite's `port`, once started: the tests view them. */
export async function devPreviews(port: number): Promise<Previews | undefined> {
  return (await servers.get(port)?.catch(() => undefined))?.server.previews;
}

/**
 * A Connect middleware serving the server's routes, on the server `startServer` starts with the
 * first request to its port, in the repository of the settings read then, on Claude Code unless
 * `adapter` says otherwise, from `.env` too unless `file` is false. `allowOrigins` gives the
 * origins the server of a port allows besides its own, none by default. `lockedList` locks the
 * server's list, as Uraeda's own Storybook does: see `unlockedList`. A start that fails answers 500
 * with its reason, and the next request tries again.
 */
export function devHandler(
  root: string | null,
  {
    adapter,
    allowOrigins,
    lockedList = false,
    ...sources
  }: {
    adapter?: Adapter;
    allowOrigins?: (port: number) => Array<string>;
    lockedList?: boolean;
  } & Sources = {},
) {
  const env = loadEnv(root, process.env, sources);
  const start = async (port: number): Promise<Started> => {
    const binding = await loadBinding();
    const dataDir = loadDataDir(root, binding, process.env, sources);
    // Read with the first request, as the data folder is: the browser tests' setup sets them after
    // Vite's server is made.
    const server = await startServer({
      ...loadEnv(root, process.env, sources),
      adapter:
        adapter ??
        new ClaudeAdapter({ imagesDir: chatImages(dataDir).dir, pluginDir: layout().plugin }),
      allowOrigins: allowOrigins?.(port) ?? [],
      binding,
      dataDir,
      lockedList,
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
        process.stderr.write(`uraeda: ${error.message}\n`);
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
