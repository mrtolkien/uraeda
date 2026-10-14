import { serveStatic } from "@hono/node-server/serve-static";
import { type Context as HonoContext, Hono, type Next } from "hono";
import { attach } from "./attach.ts";
import type { Binding } from "./fate/context.ts";
import { type FateServer, type FateVariables, fateServer } from "./fate.ts";
import { withWholeFields } from "./fate/select.ts";
import { files } from "./files.ts";
import { guard } from "./guard.ts";
import type { Options } from "./options.ts";
import type { Hosts } from "./repositories.ts";

export { Hosts } from "./repositories.ts";
import type { Sessions } from "./runner/sessions.ts";

type Context = HonoContext<{ Variables: FateVariables }>;

/** The request with its selections as whole fields, the way they reach fate (see `fate/select.ts`). */
const rewritten = async (request: Request) =>
  new Request(request.url, {
    body: JSON.stringify(withWholeFields(await request.json().catch(() => undefined))),
    headers: request.headers,
    method: "POST",
  });

/**
 * The server's routes: each listed repository's under `/r/<name>/`, with its host's context and
 * fate server; the global `/fate`, which serves the list and refuses a repository's records; and
 * `/raw/*` and `/mockups/*`, links from before repositories had names, sent on to the most recently
 * opened repository's.
 */
export function createApp(
  options: Omit<Options, "given" | "open" | "repo" | "show"> & {
    binding: Binding;
    dataDir: string;
    hosts: Hosts;
    sessions: Sessions;
    /** The built UI, served as static files when set. */
    webRoot?: string;
  },
) {
  const { binding, dataDir, hosts, sessions } = options;
  const app = new Hono<{ Variables: FateVariables }>();
  app.use(guard(options));
  app.use(async (context, next) => {
    context.set("fate", { binding, dataDir, hosts, repo: null, sessions });
    await next();
  });
  /**
   * A repository's routes take its host's context, its folder looked at now; an unknown name or a
   * missing folder is a 404, so the core never looks for a repository above it.
   */
  const hosted = async (context: Context, next: Next) => {
    const name = context.req.param("name")!;
    const host = await hosts.current(name);
    if (!host) {
      return context.text(`No repository named “${name}”`, 404);
    }
    if (host.missing) {
      return context.text(`Folder not found: ${host.path}`, 404);
    }
    context.set("fate", { binding, dataDir, hosts, repo: host.path, sessions });
    await next();
  };
  for (const path of [
    "/r/:name/fate",
    "/r/:name/fate/live",
    "/r/:name/raw/*",
    "/r/:name/mockups/*",
    "/r/:name/attach",
    "/r/:name/images/*",
    "/r/:name/chat-images/*",
  ]) {
    app.use(path, hosted);
  }
  /** The fate endpoint and its live updates, at `base`, on the server `server` gives. */
  const endpoint = (base: string, server: (context: Context) => FateServer) => {
    app.post(`${base}/fate`, async (context) =>
      server(context).handleRequest(await rewritten(context.req.raw), context),
    );
    app.post(`${base}/fate/live`, async (context) =>
      server(context).handleLiveRequest(await rewritten(context.req.raw), context),
    );
    app.get(`${base}/fate/live`, (context) =>
      server(context).handleLiveRequest(context.req.raw, context),
    );
  };
  endpoint("", () => fateServer);
  endpoint("/r/:name", (context) => hosts.get(context.req.param("name")!)!.fate);
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
  app.route("/r/:name", files());
  app.route("/r/:name", attach());
  if (options.webRoot) {
    app.use("/*", serveStatic({ root: options.webRoot }));
    app.get("/*", serveStatic({ path: "index.html", root: options.webRoot }));
  }
  return app;
}
