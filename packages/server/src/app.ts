import { serveStatic } from "@hono/node-server/serve-static";
import { createHonoFateHandler } from "@nkzw/fate/server";
import { Hono } from "hono";
import { type FateVariables, fateServer } from "./fate.ts";
import { guard } from "./guard.ts";
import type { Options } from "./options.ts";
import type { TemporaryReadSpecs } from "./temporary-spec-folders.ts";

export function createApp(options: Options & { readSpecs: TemporaryReadSpecs }) {
  const app = new Hono<{ Variables: FateVariables }>();
  app.use(guard(options));
  app.use("/fate", async (context, next) => {
    context.set("fate", { readSpecFolders: () => options.readSpecs(options.specs) });
    await next();
  });
  app.post("/fate", createHonoFateHandler(fateServer));
  if (options.webRoot) {
    app.use("/*", serveStatic({ root: options.webRoot }));
    app.get("/*", serveStatic({ root: options.webRoot, path: "index.html" }));
  }
  return app;
}
