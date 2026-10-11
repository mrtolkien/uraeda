import { Hono } from "hono";
import type { FateVariables } from "./fate.ts";

const types: Record<string, string> = {
  html: "text/html; charset=utf-8",
  css: "text/css; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  svg: "image/svg+xml",
  json: "application/json",
};

/**
 * Files of the repository, read through the binding: `/raw/<path>` as text, for links to code,
 * and `/mockups/<path>` with their own type, sandboxed so their scripts run outside the UI's
 * origin.
 */
export function files() {
  const app = new Hono<{ Variables: FateVariables }>();
  const read = async (context: { get: (key: "fate") => FateVariables["fate"] }, path: string) => {
    const { binding, repo } = context.get("fate");
    try {
      return await binding.readRaw(repo, decodeURIComponent(path));
    } catch {
      return undefined;
    }
  };
  app.get("/raw/*", async (context) => {
    const text = await read(context, context.req.path.slice("/raw/".length));
    return text === undefined
      ? context.text("Not found", 404)
      : context.text(text, 200, { "content-type": "text/plain; charset=utf-8" });
  });
  app.get("/mockups/*", async (context) => {
    const path = context.req.path.slice("/mockups/".length);
    const text = await read(context, path);
    if (text === undefined) {
      return context.text("Not found", 404);
    }
    const extension = path.split(".").pop() ?? "";
    return context.body(text, 200, {
      "content-type": types[extension] ?? "text/plain; charset=utf-8",
      "content-security-policy": "sandbox allow-scripts",
    });
  });
  return app;
}
