import { Hono } from "hono";
import type { FateVariables } from "./fate.ts";

const types: Record<string, string> = {
  css: "text/css; charset=utf-8",
  html: "text/html; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  json: "application/json",
  svg: "image/svg+xml",
};

/**
 * The core's refusal of a file it did not find, or does not serve: a path outside the repository,
 * hidden, or not tracked.
 */
const NOT_FOUND = /^refused: .*: no such file$/s;

/**
 * Files of the repository, read through the binding: `/raw/<path>` as text, for links to code,
 * and `/mockups/<path>` with their own type, sandboxed so their scripts run outside the UI's
 * origin. Mounted at `/r/:name`, whose prefix is left out of the file's path.
 */
export function files() {
  const app = new Hono<{ Variables: FateVariables }>();
  /** The file's text, or the status of why it was not read: 404 when it is not found, else 500. */
  const read = async (
    context: { get: (key: "fate") => FateVariables["fate"] },
    path: string,
  ): Promise<string | 404 | 500> => {
    const { binding, repo } = context.get("fate");
    if (repo === null) {
      return 404;
    }
    try {
      return await binding.readRaw(repo, decodeURIComponent(path));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (NOT_FOUND.test(message)) {
        return 404;
      }
      console.error(`The server could not read ${path}: ${message}`);
      return 500;
    }
  };
  /** The request's path after its repository's prefix and `/<route>/`. */
  const rest = (context: { req: { path: string } }, route: string) =>
    context.req.path.replace(/^\/r\/[^/]+/, "").slice(`/${route}/`.length);
  const failed = (status: 404 | 500) =>
    status === 404 ? "Not found" : "The file could not be read";
  app.get("/raw/*", async (context) => {
    const text = await read(context, rest(context, "raw"));
    return typeof text === "number"
      ? context.text(failed(text), text)
      : context.text(text, 200, { "content-type": "text/plain; charset=utf-8" });
  });
  app.get("/mockups/*", async (context) => {
    const path = rest(context, "mockups");
    const text = await read(context, path);
    if (typeof text === "number") {
      return context.text(failed(text), text);
    }
    const extension = path.split(".").pop() ?? "";
    return context.body(text, 200, {
      "content-security-policy": "sandbox allow-scripts",
      "content-type": types[extension] ?? "text/plain; charset=utf-8",
    });
  });
  return app;
}
