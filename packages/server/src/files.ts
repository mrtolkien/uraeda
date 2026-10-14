import { readFile } from "node:fs/promises";
import { Hono } from "hono";
import { chatImages } from "./attach.ts";
import type { FateVariables } from "./fate.ts";
import { imageInUse } from "./runner/image-uses.ts";
import { chatImageType } from "./runner/images.ts";

const types: Record<string, string> = {
  css: "text/css; charset=utf-8",
  html: "text/html; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  json: "application/json",
  svg: "image/svg+xml",
};

/**
 * The headers of an image: its detected type, never sniffed, nothing it could load or run, and no
 * page of another site may embed it.
 */
const imageHeaders = (type: string) => ({
  "content-security-policy": "default-src 'none'",
  "content-type": type,
  "cross-origin-resource-policy": "same-origin",
  "x-content-type-options": "nosniff",
});

/** A buffer's bytes as the response's body, without copying them. */
const view = (bytes: Buffer) =>
  new Uint8Array(bytes.buffer as ArrayBuffer, bytes.byteOffset, bytes.byteLength);

/**
 * The core's refusal of a file it did not find, or does not serve: a path outside the repository,
 * hidden, or not tracked.
 */
const NOT_FOUND = /^refused: .*: no such file$/s;

/** The file's text, or the status of why it was not read: 404 when it is not found, else 500. */
async function read(
  context: { get: (key: "fate") => FateVariables["fate"] },
  path: string,
): Promise<string | 404 | 500> {
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
    process.stderr.write(`The server could not read ${path}: ${message}\n`);
    return 500;
  }
}

/** The request's path after its repository's prefix and `/<route>/`. */
const rest = (context: { req: { path: string } }, route: string) =>
  context.req.path.replace(/^\/r\/[^/]+/, "").slice(`/${route}/`.length);

const failed = (status: 404 | 500) => (status === 404 ? "Not found" : "The file could not be read");

/**
 * Files of the repository, read through the binding: `/raw/<path>` as text, for links to code,
 * `/mockups/<path>` with their own type, sandboxed so their scripts run outside the UI's origin,
 * and `/images/<path>` as images. And the chat images of the data folder, `/chat-images/<id>`,
 * deleted by `DELETE` while no message holds them. Mounted at `/r/:name`, whose prefix is left out
 * of the file's path.
 */
export function files() {
  const app = new Hono<{ Variables: FateVariables }>();
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
  app.get("/images/*", async (context) => {
    const { binding, repo } = context.get("fate");
    const path = rest(context, "images");
    if (repo === null) {
      return context.text("Not found", 404);
    }
    try {
      const image = await binding.readImage(repo, decodeURIComponent(path));
      return context.body(view(image.bytes), 200, imageHeaders(image.type));
    } catch {
      return context.text("Not found", 404);
    }
  });
  app.get("/chat-images/:id", async (context) => {
    const id = context.req.param("id");
    const path = chatImages(context.get("fate").dataDir).path(id);
    const bytes = path === undefined ? undefined : await readFile(path).catch(() => undefined);
    return bytes === undefined
      ? context.text("Not found", 404)
      : // An ID is never given to another image: its bytes never change.
        context.body(view(bytes), 200, {
          ...imageHeaders(chatImageType(id)),
          "cache-control": "private, max-age=31536000, immutable",
        });
  });
  app.delete("/chat-images/:id", async (context) => {
    const { dataDir, sessions } = context.get("fate");
    const id = context.req.param("id");
    const images = chatImages(dataDir);
    if (images.path(id) === undefined) {
      return context.text("Not found", 404);
    }
    if (imageInUse(sessions.cache.db, id)) {
      return context.json({ error: `refused: ${id} is in a sent message.` }, 400);
    }
    await images.remove(id);
    return context.body(null, 204);
  });
  return app;
}
