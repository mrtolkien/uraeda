// The server's wiring, one for `main.ts` and `dev.ts`: the session manager, the hosts of the
// listed repositories, the starting repository, and the app.
import type { IncomingMessage } from "node:http";
import { join } from "node:path";
import type { Duplex } from "node:stream";
import { createApp } from "./app.ts";
import { chatImages } from "./attach.ts";
import type { Binding } from "./fate/context.ts";
import { createSessions, type HostsOf, livePreviews, renewPreviews } from "./live.ts";
import { NOT_A_REPOSITORY, openFolder, type OpenRequest } from "./open.ts";
import type { Options } from "./options.ts";
import { guardCheck } from "./guard.ts";
import { GroupRecord, groupsFolder, killLeftGroups } from "./preview/groups.ts";
import { previewUpgrade } from "./preview/proxy.ts";
import type { Previews } from "./preview/runner.ts";
import { Hosts } from "./repositories.ts";
import type { Adapter } from "./runner/adapter.ts";
import { SessionCache } from "./runner/cache.ts";
import { imagesInUse } from "./runner/image-uses.ts";
import type { Sessions } from "./runner/sessions.ts";
import type { SignInOptions } from "./sign-in/check.ts";
import { FrameSecret } from "./sign-in/frames.ts";
import { OneTimeLinks } from "./sign-in/links.ts";
import { SignInStore } from "./sign-in/store.ts";

/** How often the server checks that the agent still works. */
export const CHECK_EVERY_MS = 60_000;

/**
 * How often the server stops the Storybooks without a view, or whose checkout is gone, and ends
 * the sessions unused for 30 days.
 */
export const SWEEP_EVERY_MS = 60_000;

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

/**
 * A started server: its app, the hosts, the session manager, and the Storybooks it serves, the frame
 * secret of their paths, the page of the repository it started in, and how to stop them.
 */
export type Server = {
  app: ReturnType<typeof createApp>;
  /** The frame secret of preview and mockup paths: replacing it restarts the Storybooks. */
  frames: FrameSecret;
  hosts: Hosts;
  /** The access key, when this start made it: shown once, then never again. */
  key?: string;
  /** Makes a new access key and returns it, signing every device out; throws without sign-in. */
  newKey: () => string;
  previews: Previews;
  sessions: Sessions;
  /** A one-time link to the page `to`, which signs a browser in; `to` itself without sign-in. */
  signInLink: (to: string) => string;
  /**
   * Closes the hosts' watches, stops the sessions' turns, closes their processes, and stops every
   * Storybook.
   */
  stop: () => Promise<void>;
  /**
   * The HTTP server's upgrades: WebSockets to the Storybooks, through the guard's rule and the
   * frame secret.
   */
  upgrade: (request: IncomingMessage, socket: Duplex, head: Buffer) => void;
  /** The started repository's page, `/r/<name>/`, or `/` when the server started outside git. */
  url: string;
};

/** The lines that show the access key a start made, the only time it is shown. */
export const keyLines = (key: string) =>
  `Access key, shown once: ${key}\nKeep it in a password manager: every new device signs in with it.\n`;

/** The lines that show a new access key, made by `--new-key`. */
export const newKeyLines = (key: string) =>
  `New access key, shown once: ${key}\nEvery device is signed out.\n`;

/**
 * The server's sign-in, unless `signIn` is false: the store of the data folder, its key when this
 * start made it, the one-time links, and the host token.
 */
function openSignIn(options: { dataDir: string; hostToken?: string; signIn?: false }): {
  key?: string;
  signIn?: SignInOptions;
} {
  if (options.signIn === false) {
    return {};
  }
  const { key, store } = SignInStore.open(options.dataDir);
  return { key, signIn: { hostToken: options.hostToken, links: new OneTimeLinks(), store } };
}

/** Ends the sessions unused for 30 days; a file that cannot be written is reported, not thrown. */
function sweepSessions(store: SignInStore | undefined) {
  try {
    store?.sweep();
  } catch (error) {
    process.stderr.write(`uraeda: ${(error as Error).message}\n`);
  }
}

/**
 * Adds the starting folder's repository through `openFolder`, and returns its page. A folder
 * outside git that was not given is logged; a list that cannot be written is reported, and the
 * server still starts, the hosts reporting it too.
 */
async function openStart(binding: Binding, dataDir: string, request: OpenRequest): Promise<string> {
  try {
    const { url } = await openFolder({ binding, dataDir }, request);
    if (url === "/") {
      process.stderr.write(
        `uraeda: ${request.folder} is not in a git repository: add one from the web UI\n`,
      );
    }
    return url;
  } catch (error) {
    if ((error as { code?: string }).code === NOT_A_REPOSITORY) {
      throw error;
    }
    process.stderr.write(`uraeda: ${(error as Error).message.replace(/^refused: /, "")}\n`);
    return "/";
  }
}

/**
 * Starts the server in `options.repo`. In a git repository, its main checkout is added to the list,
 * or touched when listed, so it opens first. Outside git, a repository given by `--repo` or
 * `URAEDA_REPO` stops the start, with `<repo> is not a git repository`; the folder the server was
 * merely started in is logged, and the list's most recent repository opens first.
 *
 * Sign-in is on unless `signIn` is false, as for tests and Uraeda's own Storybook: the store opens
 * `sign-in.json` in the data folder first, so a file that cannot be read, or a folder that cannot
 * be written, stops the start before anything else; `/open` and `/session/key` take `hostToken`.
 */
export async function startServer(
  options: Omit<Options, "newKey" | "open" | "show"> & {
    adapter: Adapter;
    binding: Binding;
    dataDir: string;
    /** The host token `/open` and `/session/key` accept from the host's own `uraeda`. */
    hostToken?: string;
    /** Whether the list is locked, as Uraeda's own Storybook locks it: see `unlockedList`. */
    lockedList?: boolean;
    /** False for no sign-in: only code turns it off. */
    signIn?: false;
    /** The built UI, served as static files when set: `vp dev` leaves it to Vite. */
    webRoot?: string;
  },
): Promise<Server> {
  const { adapter, binding, dataDir } = options;
  const { key, signIn } = openSignIn(options);
  const url = await openStart(binding, dataDir, { folder: options.repo, given: options.given });
  // The Storybooks a killed server left run no more: their record's groups are killed first.
  const record = groupsFolder(dataDir);
  killLeftGroups(record);
  const previews = livePreviews({ record: new GroupRecord(record) });
  // One frame secret for the server: each replacement restarts its Storybooks under the new base.
  const frames = new FrameSecret();
  frames.onReplace(() => renewPreviews(previews));
  let hosts: Hosts | undefined;
  const sessions = await startSessions({ adapter, binding, dataDir, hosts: () => hosts });
  try {
    hosts = await Hosts.open({
      binding,
      dataDir,
      sessions: sessions.sessions,
      // A repository removed from the list stops its Storybooks.
      stopped: (host) => previews.stopRepository(host.name),
    });
  } catch (error) {
    await sessions.stop();
    throw error;
  }
  const opened = hosts;
  const sweeping = setInterval(() => {
    previews.sweep();
    sweepSessions(signIn?.store);
  }, SWEEP_EVERY_MS);
  sweeping.unref();
  let stopping: Promise<void> | undefined;
  return {
    app: createApp({
      ...options,
      binding,
      dataDir,
      frames,
      hosts: opened,
      previews,
      sessions: sessions.sessions,
      signIn,
    }),
    frames,
    hosts: opened,
    ...(key !== undefined && { key }),
    newKey: () => {
      if (!signIn) {
        throw new Error("this server has no sign-in");
      }
      return signIn.store.replaceKey();
    },
    previews,
    sessions: sessions.sessions,
    signInLink: (to) => signIn?.links.make(to) ?? to,
    stop: () => {
      stopping ??= (async () => {
        clearInterval(sweeping);
        opened.close();
        await Promise.all([sessions.stop(), previews.stopAll()]);
      })();
      return stopping;
    },
    upgrade: previewUpgrade({
      check: guardCheck({ ...options, isFrame: (path) => frames.allows(path) }),
      frames,
      previews,
    }),
    url,
  };
}
