import { serveStatic } from "@hono/node-server/serve-static";
import { type Context as HonoContext, Hono, type Next } from "hono";
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

/**
 * The server's routes: each listed repository's under `/r/<name>/`, with its host's context and
 * fate server, and the global `/fate`, `/raw/*`, and `/mockups/*`, on the repository the server
 * started in (see the plan's R3).
 */
export function createApp(
  options: Options & { binding: Binding; sessions: Sessions; hosts: Hosts; dataDir: string },
) {
  const { binding, sessions, hosts, dataDir } = options;
  const app = new Hono<{ Variables: FateVariables }>();
  app.use(guard(options));
  app.use(async (context, next) => {
    context.set("fate", { binding, sessions, hosts, dataDir, repo: options.repo });
    await next();
  });
  /** A repository's routes take its host's context; an unknown name is a 404. */
  const hosted = async (context: Context, next: Next) => {
    const name = context.req.param("name")!;
    const host = hosts.get(name);
    if (!host) {
      return context.text(`No repository named “${name}”`, 404);
    }
    context.set("fate", { binding, sessions, hosts, dataDir, repo: host.path });
    await next();
  };
  for (const path of [
    "/r/:name/fate",
    "/r/:name/fate/live",
    "/r/:name/raw/*",
    "/r/:name/mockups/*",
  ]) {
    app.use(path, hosted);
  }
  // Selections reach fate as whole fields (see `fate/select.ts`).
  const rewritten = async (request: Request) =>
    new Request(request.url, {
      method: "POST",
      headers: request.headers,
      body: JSON.stringify(withWholeFields(await request.json().catch(() => undefined))),
    });
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
  // The starting repository's host serves the global endpoint while it is listed, so its views
  // receive its live updates.
  endpoint("", () => hosts.byPath(options.repo)?.fate ?? fateServer);
  endpoint("/r/:name", (context) => hosts.get(context.req.param("name")!)!.fate);
  app.route("/", files());
  app.route("/r/:name", files());
  if (options.webRoot) {
    app.use("/*", serveStatic({ root: options.webRoot }));
    app.get("/*", serveStatic({ root: options.webRoot, path: "index.html" }));
  }
  return app;
}
