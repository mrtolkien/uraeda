import { join } from "node:path";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { FateVariables } from "./fate.ts";
import { writable } from "./fate/sessions.ts";
import { ChatImages } from "./runner/images.ts";

const MIB = 1024 * 1024;
/** The body's limit: the core's 20 MB for the image, and room for the multipart around it. */
const BODY_LIMIT = 21 * MIB;
/** The name in refusals of an image without one, as the core names it. */
const PASTED = "pasted image";

/**
 * A size in MB, rounded up to one decimal, as the core writes it in its refusals: the core never
 * sees a body over the limit.
 */
function megabytes(bytes: number): string {
  const tenths = Math.ceil((bytes * 10) / MIB);
  return tenths % 10 === 0 ? String(tenths / 10) : (tenths / 10).toFixed(1);
}

/** A refusal, as the UI reads fate's: the binding's message with its code. */
const refusal = (error: unknown) => ({
  error: error instanceof Error ? error.message : String(error),
});

/** The chat images of the server's data folder. */
export const chatImages = (dataDir: string) => new ChatImages(join(dataDir, "images"));

/**
 * `POST /attach`: an image, the multipart body's `file`, attached to the markdown file at `path`,
 * or with `chat=1` saved in the data folder for a chat message, both named in the query string so
 * that a refusal of a body over the limit names the file without reading it. Answers the core's
 * result as JSON, or `400` with `{ error }`, the refusal with its code.
 */
export function attach() {
  const app = new Hono<{ Variables: FateVariables }>();
  app.post(
    "/attach",
    bodyLimit({
      maxSize: BODY_LIMIT,
      onError: (context) => {
        const name = context.req.query("name") || PASTED;
        const size = Number(context.req.header("content-length")) || BODY_LIMIT;
        return context.json(
          { error: `refused: This image is over 20 MB: ${name} is ${megabytes(size)} MB.` },
          400,
        );
      },
    }),
    async (context) => {
      const ctx = context.get("fate");
      const name = context.req.query("name") || undefined;
      const path = context.req.query("path");
      const chat = context.req.query("chat") === "1";
      if (chat === (path !== undefined)) {
        return context.json({ error: "refused: Give either a path or chat=1." }, 400);
      }
      const body = await context.req.parseBody().catch(() => ({}) as Record<string, unknown>);
      const file = body.file;
      if (!(file instanceof File)) {
        return context.json({ error: "refused: The body holds no file." }, 400);
      }
      try {
        const bytes = Buffer.from(await file.arrayBuffer());
        if (path !== undefined) {
          await writable(ctx, { path });
          return context.json(await ctx.binding.attachImage(ctx.repo, path, bytes, name));
        }
        const encoded = await ctx.binding.encodeImage(bytes, name ?? PASTED);
        return context.json(await chatImages(ctx.dataDir).save(encoded));
      } catch (error) {
        return context.json(refusal(error), 400);
      }
    },
  );
  return app;
}
