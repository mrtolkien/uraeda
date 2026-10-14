// The server's wiring, one for `main.ts` and `dev.ts`: the session manager, the hosts of the
// listed repositories, the starting repository, and the app.
import { join } from "node:path";
import { createApp } from "./app.ts";
import { chatImages } from "./attach.ts";
import type { Binding } from "./fate/context.ts";
import { createSessions, type HostsOf } from "./live.ts";
import type { Options } from "./options.ts";
import { Hosts } from "./repositories.ts";
import type { Adapter } from "./runner/adapter.ts";
import { SessionCache } from "./runner/cache.ts";
import { imagesInUse } from "./runner/image-uses.ts";
import type { Sessions } from "./runner/sessions.ts";

/** How often the server checks that the agent still works. */
export const CHECK_EVERY_MS = 60_000;

/**
 * The server's session manager: its cache opened in the data folder, the turns a stopped server
 * left marked stopped, the chat images no message holds deleted once a day old, and the agent
 * checked now and every 60 seconds. `stop` stops its turns and
 * closes its processes.
 */
export async function startSessions(options: {
  adapter: Adapter;
  binding: Binding;
  dataDir: string;
  hosts: HostsOf;
}): Promise<{ sessions: Sessions; stop: () => Promise<void> }> {
  const cache = SessionCache.open(join(options.dataDir, "runner.sqlite"));
  cache.interrupted("Stopped: the server stopped while it ran.");
  // Every repository shares the data folder: an image a composer holds, not sent yet, is kept for
  // a day (R5). A cleanup that fails never stops the server (R40).
  try {
    await chatImages(options.dataDir).clean(imagesInUse(cache.db), Date.now());
  } catch (error) {
    process.stderr.write(`uraeda: the chat images were not cleaned: ${(error as Error).message}\n`);
  }
  const sessions = createSessions({ ...options, cache });
  await sessions.check();
  const timer = setInterval(() => void sessions.check(), CHECK_EVERY_MS);
  timer.unref();
  return {
    sessions,
    stop: async () => {
      clearInterval(timer);
      await sessions.closeAll();
      sessions.close();
    },
  };
}

/** A started server: its app, the hosts and the session manager it serves, and how to stop them. */
export type Server = {
  app: ReturnType<typeof createApp>;
  hosts: Hosts;
  sessions: Sessions;
  /** Closes the hosts' watches, stops the sessions' turns, and closes their processes. */
  stop: () => Promise<void>;
};

/**
 * Starts the server in `options.repo`. In a git repository, its main checkout is added to the list,
 * or touched when listed, so it opens first. Outside git, a repository given by `--repo` or
 * `URAEDA_REPO` stops the start, with `<repo> is not a git repository`; the folder the server was
 * merely started in is logged, and the list's most recent repository opens first.
 */
export async function startServer(
  options: Omit<Options, "open" | "show"> & {
    adapter: Adapter;
    binding: Binding;
    dataDir: string;
    /** The built UI, served as static files when set: `vp dev` leaves it to Vite. */
    webRoot?: string;
  },
): Promise<Server> {
  const { adapter, binding, dataDir } = options;
  const root = await binding.mainRoot(options.repo).catch(() => null);
  if (root === null && options.given) {
    throw new Error(`${options.repo} is not a git repository`);
  }
  if (root === null) {
    process.stderr.write(
      `uraeda: ${options.repo} is not in a git repository: add one from the web UI\n`,
    );
  } else {
    // A list that cannot be written is the hosts' problem to report: the server still starts.
    await binding.addRepository(dataDir, root).catch((error: Error) => {
      process.stderr.write(`uraeda: ${error.message.replace(/^refused: /, "")}\n`);
    });
  }
  let hosts: Hosts | undefined;
  const sessions = await startSessions({ adapter, binding, dataDir, hosts: () => hosts });
  try {
    hosts = await Hosts.open({ binding, dataDir, sessions: sessions.sessions });
  } catch (error) {
    await sessions.stop();
    throw error;
  }
  const opened = hosts;
  let stopping: Promise<void> | undefined;
  return {
    app: createApp({
      ...options,
      binding,
      dataDir,
      hosts: opened,
      sessions: sessions.sessions,
    }),
    hosts: opened,
    sessions: sessions.sessions,
    stop: () => {
      stopping ??= (async () => {
        opened.close();
        await sessions.stop();
      })();
      return stopping;
    },
  };
}
