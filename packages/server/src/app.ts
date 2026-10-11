import { serveStatic } from "@hono/node-server/serve-static";
import { createHonoFateHandler } from "@nkzw/fate/server";
import { Hono } from "hono";
import type { Binding } from "./fate/context.ts";
import { type FateVariables, fateServer } from "./fate.ts";
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
  const handler = createHonoFateHandler(fateServer);
  app.post("/fate", handler);
  app.on(["GET", "POST"], "/fate/live", handler);
  app.route("/", files());
  if (options.webRoot) {
    app.use("/*", serveStatic({ root: options.webRoot }));
    app.get("/*", serveStatic({ root: options.webRoot, path: "index.html" }));
  }
  return app;
}
