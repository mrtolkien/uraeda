import { serveStatic } from "@hono/node-server/serve-static";
import { type Context as HonoContext, Hono, type Next } from "hono";
import { attach } from "./attach.ts";
import type { Binding } from "./fate/context.ts";
import { type FateServer, type FateVariables, fateServer } from "./fate.ts";
import { withWholeFields } from "./fate/select.ts";
import { files } from "./files.ts";
import { guard, PREVIEW_PATH } from "./guard.ts";
import { openRoute } from "./open.ts";
import type { Options } from "./options.ts";
import { previewRoutes } from "./preview/proxy.ts";
import type { Previews } from "./preview/runner.ts";
import type { Hosts } from "./repositories.ts";
import { sessionCheck, type SignInOptions, withDevice } from "./sign-in/check.ts";
import { FrameSecret } from "./sign-in/frames.ts";
import { signInRoutes } from "./sign-in/routes.ts";

export { Hosts } from "./repositories.ts";
export { Previews } from "./preview/runner.ts";
export { livePreviews } from "./live.ts";
import type { Sessions } from "./runner/sessions.ts";

type Context = HonoContext<{ Variables: FateVariables }>;

/** The request with its selections as whole fields, the way they reach fate (see `fate/select.ts`). */
const rewritten = async (request: Request) =>
  new Request(request.url, {
    body: JSON.stringify(withWholeFields(await request.json().catch(() => undefined))),
    headers: request.headers,
    method: "POST",
  });

/** What `createApp` takes, and its route groups. */
type AppOptions = Omit<Options, "given" | "newKey" | "open" | "repo" | "show"> & {
  binding: Binding;
  dataDir: string;
  /** The frame secret of preview and mockup paths: a new one by default. */
  frames?: FrameSecret;
  hosts: Hosts;
  /** Whether the list is locked, as Uraeda's own Storybook locks it: see `unlockedList`. */
  lockedList?: boolean;
  /** The server's Storybooks, which `/r/<name>/preview/<secret>/<folder>/` forwards to. */
  previews: Previews;
  sessions: Sessions;
  /** Sign-in: without it, as in tests and Uraeda's own Storybook, no session is checked. */
  signIn?: SignInOptions;
  /** The built UI, served as static files when set. */
  webRoot?: string;
};

type App = Hono<{ Variables: FateVariables }>;

/**
 * A repository's routes take its host's context, its folder looked at now; an unknown name or a
 * missing folder is a 404, so the core never looks for a repository above it.
 */
function hostedRoutes(
  app: App,
  { binding, dataDir, hosts, lockedList, previews, sessions }: AppOptions,
  frames: FrameSecret,
) {
  const hosted = async (context: Context, next: Next) => {
    const name = context.req.param("name")!;
    const host = await hosts.current(name);
    if (!host) {
      return context.text(`No repository named “${name}”`, 404);
    }
    if (host.missing) {
      return context.text(`Folder not found: ${host.path}`, 404);
    }
    context.set("fate", {
      binding,
      dataDir,
      frames,
      hosts,
      lockedList,
      previews,
      repo: host.path,
      sessions,
    });
    await next();
  };
  for (const path of [
    "/r/:name/fate",
    "/r/:name/fate/live",
    "/r/:name/raw/*",
    "/r/:name/mockups/*",
    "/r/:name/attach",
    "/r/:name/inbox/note-image",
    "/r/:name/images/*",
    "/r/:name/chat-images/*",
  ]) {
    app.use(path, hosted);
  }
}

/** The fate endpoints and their live updates: the global one, and each repository's. */
function fateRoutes(app: App, hosts: Hosts) {
  /** The fate endpoint and its live updates, at `base`, on the server `server` gives. */
  const endpoint = (base: string, server: (context: Context) => FateServer) => {
    app.post(`${base}/fate`, async (context) =>
      server(context).handleRequest(await rewritten(context.req.raw), context),
    );
    app.post(`${base}/fate/live`, async (context) =>
      server(context).handleLiveRequest(await rewritten(context.req.raw), context),
    );
    app.get(`${base}/fate/live`, (context) =>
      server(context).handleLiveRequest(withDevice(context), context),
    );
  };
  endpoint("", () => fateServer);
  endpoint("/r/:name", (context) => hosts.get(context.req.param("name")!)!.fate);
}

/** The paths framed by Uraeda's own pages: mockups, and Storybooks. */
const framed = (path: string) =>
  /^\/(r\/[^/]+\/)?mockups(\/|$)/.test(path) || PREVIEW_PATH.test(path);

/**
 * The server's routes: each listed repository's under `/r/<name>/`, with its host's context and
 * fate server; the global `/fate`, which serves the list and refuses a repository's records; and
 * `/raw/*` and `/mockups/*`, links from before repositories had names, sent on to the most recently
 * opened repository's; `/r/<name>/preview/<secret>/<folder>/`, each checkout's Storybook; `POST
 * /open`, a second start's handoff; and with `signIn`, the session routes, every other route behind
 * the session check but frame paths with the frame secret, which every ended session replaces.
 * Answers but mockups' and Storybooks' refuse other sites' frames.
 */
export function createApp(options: AppOptions) {
  const { binding, dataDir, hosts, lockedList, previews, sessions, signIn } = options;
  const allowedHosts = options.allowedHosts ?? [];
  const frames = options.frames ?? new FrameSecret();
  const app: App = new Hono<{ Variables: FateVariables }>();
  app.use(async (context, next) => {
    await next();
    if (!framed(context.req.path)) {
      context.header("X-Frame-Options", "SAMEORIGIN");
    }
  });
  app.use(guard({ ...options, isFrame: (path) => frames.allows(path) }));
  if (signIn) {
    signIn.store.onEnded(() => frames.replace());
    app.use(sessionCheck({ ...signIn, allowedHosts, frames }));
    app.route("/", signInRoutes({ ...signIn, allowedHosts }));
  }
  app.use(async (context, next) => {
    context.set("fate", {
      binding,
      dataDir,
      frames,
      hosts,
      lockedList,
      previews,
      repo: null,
      sessions,
    });
    await next();
  });
  hostedRoutes(app, options, frames);
  fateRoutes(app, hosts);
  /** An old file link: the same file in the most recently opened repository, or 404 with none. */
  const moved = (context: Context) => {
    const host = hosts.mostRecent();
    if (!host) {
      return context.text("No repository", 404);
    }
    const url = new URL(context.req.url);
    return context.redirect(`/r/${encodeURIComponent(host.name)}${url.pathname}${url.search}`, 307);
  };
  app.get("/raw/*", moved);
  app.get("/mockups/*", moved);
  app.route("/r/:name", previewRoutes());
  app.route("/r/:name", files());
  app.route("/r/:name", attach());
  app.route("/", openRoute(signIn ? (to) => signIn.links.make(to) : (to) => to));
  if (options.webRoot) {
    app.use("/*", serveStatic({ root: options.webRoot }));
    app.get("/*", serveStatic({ path: "index.html", root: options.webRoot }));
  }
  return app;
}
