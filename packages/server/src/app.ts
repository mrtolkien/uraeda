import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import type { Binding } from "./fate/context.ts";
import { type FateVariables, fateServer } from "./fate.ts";
import { withWholeFields } from "./fate/select.ts";
import { files } from "./files.ts";
import { guard } from "./guard.ts";
import type { Options } from "./options.ts";

export function createApp(options: Options & { binding: Binding }) {
  const app = new Hono<{ Variables: FateVariables }>();
  app.use(guard(options));
  app.use(async (context, next) => {
    context.set("fate", { binding: options.binding, repo: options.repo });
    await next();
  });
  // Selections reach fate as whole fields (see `fate/select.ts`).
  const rewritten = async (request: Request) =>
    new Request(request.url, {
      method: "POST",
      headers: request.headers,
      body: JSON.stringify(withWholeFields(await request.json().catch(() => undefined))),
    });
  app.post("/fate", async (context) =>
    fateServer.handleRequest(await rewritten(context.req.raw), context),
  );
  app.post("/fate/live", async (context) =>
    fateServer.handleLiveRequest(await rewritten(context.req.raw), context),
  );
  app.get("/fate/live", (context) => fateServer.handleLiveRequest(context.req.raw, context));
  app.route("/", files());
  if (options.webRoot) {
    app.use("/*", serveStatic({ root: options.webRoot }));
    app.get("/*", serveStatic({ root: options.webRoot, path: "index.html" }));
  }
  return app;
}
