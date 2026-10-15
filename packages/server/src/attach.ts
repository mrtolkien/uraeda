import { join } from "node:path";
import { type Context, Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { FateVariables } from "./fate.ts";
import { inRepository } from "./fate/context.ts";
import { writable } from "./fate/sessions.ts";
import { IMAGE_LIMIT, overLimit } from "./limits.ts";
import { ChatImages } from "./runner/images.ts";

/** The body's limit: the core's 20 MB for the image, and room for the multipart around it. */
const BODY_LIMIT = IMAGE_LIMIT + 1024 * 1024;
/** The name in refusals of an image without one, as the core names it. */
const PASTED = "pasted image";

/** A refusal, as the UI reads fate's: the binding's message with its code. */
const refusal = (error: unknown) => ({
  error: error instanceof Error ? error.message : String(error),
});

/** Whether a multipart field is a file: a field's text is a string. */
const isFile = (value: unknown): value is File =>
  typeof value === "object" && value !== null && "arrayBuffer" in value;

/** The chat images of the server's data folder. */
export const chatImages = (dataDir: string) => new ChatImages(join(dataDir, "images"));

/**
 * The body's limit, refused with the core's text, naming the file from the query string without
 * reading the body.
 */
const limited = () =>
  bodyLimit({
    maxSize: BODY_LIMIT,
    onError: (context) => {
      const name = context.req.query("name") || PASTED;
      const size = Number(context.req.header("content-length")) || BODY_LIMIT;
      return context.json({ error: `refused: ${overLimit(name, size)}` }, 400);
    },
  });

/**
 * `POST /inbox/note-image`: a note with an image, added in one call to the core, which encodes
 * the image and writes the draft folder holding both, linked from the inbox, all or nothing. The
 * multipart body holds `text`, `hash`, the inbox's as read, `category` and `about` when given, and
 * `file`; the image's name is in the query string, as for `/attach`. Answers `{ draft }`, the
 * draft's path, or `400` with `{ error }`.
 */
async function noteImage(context: Context<{ Variables: FateVariables }>) {
  // Mounted under `/r/<name>/` only: the repository is the route's.
  const ctx = inRepository(context.get("fate"));
  const body = await context.req.parseBody().catch(() => ({}) as Record<string, unknown>);
  const field = (key: string) => {
    const value = body[key];
    return typeof value === "string" && value !== "" ? value : undefined;
  };
  const file = body.file;
  const text = field("text");
  const hash = field("hash");
  if (!isFile(file) || text === undefined || hash === undefined) {
    return context.json({ error: "refused: Give a text, a hash, and a file." }, 400);
  }
  try {
    const draft = await ctx.binding.addNoteWithImage(
      ctx.repo,
      text,
      hash,
      Buffer.from(await file.arrayBuffer()),
      context.req.query("name") || undefined,
      field("category"),
      field("about"),
    );
    return context.json({ draft });
  } catch (error) {
    return context.json(refusal(error), 400);
  }
}

/**
 * `POST /attach`: an image, the multipart body's `file`, attached to the markdown file at `path`,
 * or with `chat=1` saved in the data folder for a chat message, both named in the query string so
 * that a refusal of a body over the limit names the file without reading it. Answers the core's
 * result as JSON, or `400` with `{ error }`, the refusal with its code.
 */
export function attach() {
  const app = new Hono<{ Variables: FateVariables }>();
  app.post("/attach", limited(), async (context) => {
    // Mounted under `/r/<name>/` only: the repository is the route's.
    const ctx = inRepository(context.get("fate"));
    const name = context.req.query("name") || undefined;
    const path = context.req.query("path");
    const chat = context.req.query("chat") === "1";
    if (chat === (path !== undefined)) {
      return context.json({ error: "refused: Give either a path or chat=1." }, 400);
    }
    // The refusals that need no image come before the body is read.
    try {
      if (path !== undefined) {
        await writable(ctx, { path });
      }
    } catch (error) {
      return context.json(refusal(error), 400);
    }
    const body = await context.req.parseBody().catch(() => ({}) as Record<string, unknown>);
    const file = body.file;
    // A field's text is a string; a file part is a `File`.
    if (!isFile(file)) {
      return context.json({ error: "refused: The body holds no file." }, 400);
    }
    try {
      const bytes = Buffer.from(await file.arrayBuffer());
      if (path !== undefined) {
        return context.json(await ctx.binding.attachImage(ctx.repo, path, bytes, name));
      }
      const encoded = await ctx.binding.encodeImage(bytes, name ?? PASTED);
      return context.json(await chatImages(ctx.dataDir).save(encoded));
    } catch (error) {
      return context.json(refusal(error), 400);
    }
  });
  app.post("/inbox/note-image", limited(), noteImage);
  return app;
}
