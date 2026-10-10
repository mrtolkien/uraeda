import { serveStatic } from "@hono/node-server/serve-static";
import { createHonoFateHandler } from "@nkzw/fate/server";
import { Hono } from "hono";
import { createFate } from "./fate.ts";
import { guard } from "./guard.ts";
import type { Options } from "./options.ts";
import type { TemporaryReadSpecs } from "./temporary-spec-folders.ts";

export function createApp(options: Options & { readSpecs: TemporaryReadSpecs }) {
  const app = new Hono();
  app.use(guard(options));
  app.post("/fate", createHonoFateHandler(createFate(options.specs, options.readSpecs)));
  if (options.webRoot) {
    app.use("/*", serveStatic({ root: options.webRoot }));
    app.get("/*", serveStatic({ root: options.webRoot, path: "index.html" }));
  }
  return app;
}
