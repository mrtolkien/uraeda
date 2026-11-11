// The server's wiring, one for `main.ts` and `dev.ts`: the session manager, the hosts of the
// listed repositories, the starting repository, and the app.
import { rmSync } from "node:fs";
import type { IncomingMessage } from "node:http";
import { join } from "node:path";
import type { Duplex } from "node:stream";
import { createApp } from "./app.ts";
import { chatImages } from "./attach.ts";
import { type CatchUps, catcher } from "./catch-ups.ts";
import { startJobs } from "./jobs/start.ts";
import type { Binding, RepoContext } from "./fate/context.ts";
import { warmPreview } from "./fate/preview-waiting.ts";
import { ExtensionsHost } from "./extensions/server.ts";
import type { Adapter } from "./runner/adapter.ts";
import { continueSettings, createSessions, type HostsOf } from "./live.ts";
import { NOT_A_REPOSITORY, openFolder, type OpenRequest } from "./open.ts";
import type { McpTool, ServerAddress } from "./mcp/endpoint.ts";
import { McpTokens } from "./mcp/tokens.ts";
import { reviewTool } from "./runner/reviews.ts";
import { runAgentTool } from "./runner/sub-sessions.ts";
import type { Previews } from "./preview/runner.ts";
import { Hosts } from "./repositories.ts";
import { SessionCache } from "./runner/cache.ts";
import { imagesInUse } from "./runner/image-uses.ts";
import type { Runtimes } from "./runner/runtimes.ts";
import { SERVER_STOPPED, type Sessions } from "./runner/sessions.ts";
import type { SignInOptions } from "./sign-in/check.ts";
import type { FrameSecret } from "./sign-in/frames.ts";
import { startPreviews, upgrades, waitingPreviews } from "./server-previews.ts";
import { browserAddress, linkPages, OneTimeLinks } from "./sign-in/links.ts";
import { type FeatureOptions, featureOptionsOf } from "./runner/feature-options.ts";
import type { ServerSettings } from "./settings.ts";
import { ServerThemes } from "./themes.ts";
import { SIGN_IN_FILE, SignInStore } from "./sign-in/store.ts";

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
 * checked now and every 60 seconds. The continues follow `settings` as they change; the server
 * arms them with `startContinues` once its repositories are open, the restart's continues kept to
 * those. `stop` stops its turns and closes its processes.
 */
export async function startSessions(options: {
  binding: Binding;
  dataDir: string;
  /** The features' own run options, which each run starts on: the settings' alone when left out. */
  featureOptions?: FeatureOptions;
  hosts: HostsOf;
  mcp?: { address: ServerAddress; tokens: McpTokens };
  runtimes: Runtimes;
  settings: ServerSettings;
}): Promise<{ sessions: Sessions; stop: () => Promise<void> }> {
  const cache = SessionCache.open(join(options.dataDir, "runner.sqlite"));
  cache.interrupted(SERVER_STOPPED);
  // Every repository shares the data folder: an image a composer holds, not sent yet, is kept for
  // a day (R5). A cleanup that fails never stops the server (R40).
  try {
    await chatImages(options.dataDir).clean(imagesInUse(cache.db), Date.now());
  } catch (error) {
    process.stderr.write(`uraeda: the chat images were not cleaned: ${(error as Error).message}\n`);
  }
  const { featureOptions, settings } = options;
  const sessions = createSessions({
    ...options,
    cache,
    runOptions: (repo, folder) => featureOptions?.resolved(repo, folder) ?? settings.runs().options,
    runs: continueSettings(settings),
  });
  await sessions.check();
  // Every runtime's model list, asked once at start, which the pickers read: not awaited, as an
  // agent slow to list never holds the server's start.
  void options.runtimes.refreshModels();
  const unsubscribe = options.settings.onChange(() => sessions.runsChanged());
  const timer = setInterval(() => void sessions.check(), CHECK_EVERY_MS);
  timer.unref();
  return {
    sessions,
    stop: async () => {
      clearInterval(timer);
      unsubscribe();
      await sessions.closeAll();
      sessions.close();
    },
  };
}

/**
 * A started server: its app, the hosts, the session manager, and the Storybooks it serves, the
 * frame secret of their paths, the page of the repository it started in, and how to stop them.
 */
export type Server = {
  app: ReturnType<typeof createApp>;
  /** The extensions, built in and yours, and what they registered. */
  extensions: ExtensionsHost;
  /** The frame secret of preview and mockup paths: replacing it restarts the Storybooks. */
  frames: FrameSecret;
  hosts: Hosts;
  /** The access key, when this start made it: shown once, then never again. */
  key?: string;
  /** The MCP endpoint the agents reach Uraeda's tools at, and its tokens. */
  mcp: McpServer;
  /** Makes a new access key and returns it, signing every device out; throws without sign-in. */
  newKey: () => string;
  previews: Previews;
  sessions: Sessions;
  /**
   * The address a browser opens for the page `to`: the `file://` address of a page leading to a
   * one-time link, which signs it in; the page itself without sign-in.
   */
  signInPage: (to: string) => string;
  /**
   * Closes the hosts', the settings', and the themes' watches, stops the sessions' turns, closes
   * their processes, stops every Storybook, and removes the one-time links' pages.
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
 * start made it, the one-time links, their pages in the data folder, and the host token.
 */
function openSignIn(options: {
  dataDir: string;
  hostToken?: string;
  port: number;
  signIn?: false;
}): {
  key?: string;
  signIn?: SignInOptions;
} {
  if (options.signIn === false) {
    return {};
  }
  const { key, store } = SignInStore.open(options.dataDir);
  const links = new OneTimeLinks(Date.now, linkPages(options.dataDir, options.port));
  return { key, signIn: { hostToken: options.hostToken, links, store } };
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
 * A start that fails after making the key removes the file it wrote, so the next start shows a key.
 * The colour themes are read from the settings' config folder, and watched until the server stops.
 * A start that fails closes `settings` too.
 */
export async function startServer(options: StartOptions): Promise<Server> {
  let key: string | undefined;
  let themes: ServerThemes | undefined;
  try {
    const opened = openSignIn(options);
    key = opened.key;
    themes = await ServerThemes.open({ binding: options.binding, dir: options.settings.dir });
    return await startOpened({ ...options, themes }, opened.signIn, key);
  } catch (error) {
    // A key this start made was never shown: the next start makes and shows another.
    if (key !== undefined) {
      rmSync(join(options.dataDir, SIGN_IN_FILE), { force: true });
    }
    themes?.close();
    options.settings.close();
    throw error;
  }
}

/** What `startServer` takes: the values in force for this run, and what the server works with. */
type StartOptions = {
  /**
   * The agents the runtimes run on instead of Claude Code, by runtime name: `fake` for tests and
   * the sandbox, which the built-in `fake` registers; a name no built-in has is registered as is.
   * Without it, the built-in `claude` runs the `claude` command, and `fake` is off.
   */
  agents?: Record<string, Adapter>;
  /** Origins allowed besides the server's own and the allowed hosts', like a dev server's. */
  allowOrigins: Array<string>;
  binding: Binding;
  dataDir: string;
  /** Modules extensions' server code may import by name: tests'. */
  extensionModules?: Record<string, unknown>;
  /** Whether the repository was named, by `--repo` or `URAEDA_REPO`, so it must be in git. */
  given: boolean;
  /** The host token `/open` and `/session/key` accept from the host's own `uraeda`. */
  hostToken?: string;
  /** Whether the list is locked, as Uraeda's own Storybook locks it: see `unlockedList`. */
  lockedList?: boolean;
  /** The port the server listens on. */
  port: number;
  /** The repository to open first. */
  repo: string;
  /**
   * The settings in force, whose host names the guard and the cookie read at each request: the
   * server owns them, and closes them as it stops, or as its start fails.
   */
  settings: ServerSettings;
  /** False for no sign-in: only code turns it off. */
  signIn?: false;
  /** The built UI, served as static files when set: `vp dev` leaves it to Vite. */
  webRoot?: string;
};

/**
 * The server's MCP endpoint: its address, its tokens, and its tools, which the app serves at `/mcp`
 * and the session manager gives the agents' processes. The tools are read at each request: they
 * start empty, and are added once the parts they reach are open.
 */
type McpServer = { address: ServerAddress; tokens: McpTokens; tools: Array<McpTool> };

/** The MCP endpoint of a server on `port`, without tools yet. */
function mcpServer(port: number): McpServer {
  return { address: { url: `http://127.0.0.1:${port}` }, tokens: new McpTokens(), tools: [] };
}

/**
 * The extensions, their built-ins' runtimes registered, the features' run options, the session
 * manager on them, and the hosts of the listed repositories, whose changes the extensions turn into
 * events. Each watcher burst of a repository, once the refresh of its pull requests it asks ended,
 * and each refresh that changed them, calls `settled` with its path: all closed again when one
 * fails to open.
 */
async function openParts(
  options: StartOptions,
  previews: Previews,
  mcp: McpServer,
  settled: (repo: string) => void,
) {
  const { binding, dataDir } = options;
  const featureOptions = featureOptionsOf(options);
  const extensions = await ExtensionsHost.open({
    agents: options.agents,
    binding,
    configDir: options.settings.dir,
    dataDir,
    modules: options.extensionModules,
    settings: options.settings,
  });
  let hosts: Hosts | undefined;
  let sessions: Awaited<ReturnType<typeof startSessions>> | undefined;
  try {
    sessions = await startSessions({
      binding,
      dataDir,
      featureOptions,
      hosts: () => hosts,
      mcp,
      runtimes: extensions.runtimes,
      settings: options.settings,
    });
    // The workflow sessions start their implementers, and run their reviews, through the endpoint.
    mcp.tools.push(
      runAgentTool(sessions.sessions.subSessions),
      reviewTool(sessions.sessions.reviews),
    );
    hosts = await Hosts.open({
      binding,
      changed: (host, changes) => extensions.changes(host, changes),
      dataDir,
      sessions: sessions.sessions,
      settled: (host) => settled(host.path),
      started: (host) => extensions.seed(host),
      // A repository removed from the list stops its Storybooks, and its steps are forgotten.
      stopped: (host) => {
        previews.stopRepository(host.name);
        extensions.stopped(host);
      },
    });
  } catch (error) {
    await sessions?.stop();
    extensions.close();
    throw error;
  }
  return { extensions, featureOptions, hosts, sessions };
}

/**
 * Starts the extensions on the open hosts and sessions, a turn's end warming its folder's
 * Storybook: the hosts, the sessions, `stopSessions`, and the extensions closed again when they
 * fail.
 */
async function startExtensions(
  shared: Omit<RepoContext, "repo"> & { extensions: ExtensionsHost },
  stopSessions: () => Promise<void>,
) {
  const { extensions, hosts, sessions } = shared;
  try {
    await extensions.start({
      hosts,
      sessions,
      warm: (repository, folder) => {
        const host = hosts.get(repository);
        if (host) {
          warmPreview({ ...shared, repo: host.path }, folder).catch(() => {});
        }
      },
    });
  } catch (error) {
    hosts.close();
    await stopSessions();
    extensions.close();
    throw error;
  }
}

/**
 * Starts the server once its sign-in and its themes are open, `key` the access key when this start
 * made it.
 */
async function startOpened(
  options: StartOptions & { themes: ServerThemes },
  signIn: SignInOptions | undefined,
  key: string | undefined,
): Promise<Server> {
  const { binding, dataDir } = options;
  const url = await openStart(binding, dataDir, { folder: options.repo, given: options.given });
  const { frames, previews } = startPreviews(dataDir);
  const mcp = mcpServer(options.port);
  // The catcher starts once everything it reads is open: a burst before it catches up nothing.
  const started: { catchUps?: CatchUps } = {};
  const parts = await openParts(options, previews, mcp, (repo) => void started.catchUps?.run(repo));
  const { extensions, featureOptions, hosts: opened, sessions } = parts;
  const shared = {
    ...options,
    extensions,
    featureOptions,
    frames,
    hosts: opened,
    previews,
    sessions: sessions.sessions,
  };
  await startExtensions(shared, sessions.stop);
  // Once the repositories and the runtimes are there: a run of one no longer listed does not go on
  // after a restart.
  await sessions.sessions.startContinues();
  const caught = catcher(shared);
  started.catchUps = caught;
  // After the catcher: the scheduler's first look sets the moment each job was first seen.
  const jobs = startJobs(shared);
  const sweepPreviews = waitingPreviews(shared);
  const sweeping = setInterval(() => {
    sweepPreviews();
    sweepSessions(signIn?.store);
    signIn?.links.sweep();
  }, SWEEP_EVERY_MS);
  sweeping.unref();
  let stopping: Promise<void> | undefined;
  return {
    app: createApp({
      ...options,
      binding,
      dataDir,
      extensions,
      featureOptions: shared.featureOptions,
      frames,
      hosts: opened,
      jobs,
      mcp,
      previews,
      sessions: sessions.sessions,
      signIn,
    }),
    extensions,
    frames,
    hosts: opened,
    ...(key !== undefined && { key }),
    mcp,
    newKey: () => {
      if (!signIn) {
        throw new Error("this server has no sign-in");
      }
      return signIn.store.replaceKey();
    },
    previews,
    sessions: sessions.sessions,
    signInPage: (to) =>
      browserAddress(
        linkPages(dataDir, options.port),
        `http://127.0.0.1:${options.port}`,
        signIn?.links.make(to) ?? to,
      ),
    stop: () => {
      stopping ??= (async () => {
        clearInterval(sweeping);
        // Its runs in flight end before the sessions stop: a send the stop did not prevent is
        // stopped with the others.
        const catching = Promise.all([caught.stop(), jobs.stop()]);
        signIn?.links.close();
        opened.close();
        options.settings.close();
        options.themes.close();
        await catching;
        // The sessions stop before the extensions unload: an unloaded runtime checks nothing.
        await Promise.all([sessions.stop().then(() => extensions.close()), previews.stopAll()]);
        shared.featureOptions.close();
      })();
      return stopping;
    },
    upgrade: upgrades(options, frames, previews),
    url,
  };
}
