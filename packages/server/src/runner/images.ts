// The chat images of the data folder: written as the core encoded them, never into a repository.
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { EncodedImage } from "uraeda-binding";

/** A chat image: its file name in the images folder, and its size in pixels. */
export type ChatImage = { id: string; width: number; height: number };

/** An image's ID: a UUID and the extension the core gave it. */
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(webp|gif)$/;

/** How long an image no message holds is kept, for a composer of another server to send it. */
export const UNSENT_KEPT_MS = 24 * 60 * 60 * 1000;

/** The MIME type of a chat image, by its ID. */
export function chatImageType(id: string): string {
  return id.endsWith(".gif") ? "image/gif" : "image/webp";
}

/** The images of `<data folder>/images/`, by their IDs. */
export class ChatImages {
  /** The images folder, created by the first save. */
  readonly dir: string;

  constructor(dir: string) {
    this.dir = dir;
  }

  /** Writes an image the core encoded, under a new ID. */
  async save(encoded: EncodedImage): Promise<ChatImage> {
    const id = `${randomUUID()}.${encoded.extension}`;
    await mkdir(this.dir, { recursive: true });
    await writeFile(join(this.dir, id), encoded.bytes, { flag: "wx" });
    return { id, width: encoded.width, height: encoded.height };
  }

  /** The image's path, when the ID is one and its file exists. */
  path(id: string): string | undefined {
    if (!ID.test(id)) {
      return undefined;
    }
    const path = join(this.dir, id);
    return existsSync(path) ? path : undefined;
  }

  /** Deletes an image; one already gone is no error. */
  async remove(id: string): Promise<void> {
    if (ID.test(id)) {
      await rm(join(this.dir, id), { force: true });
    }
  }

  /**
   * Deletes the images no message holds, `inUse` listing those that do, unless written in the last
   * day before `now`: another server's composer may hold them, not sent yet.
   */
  async clean(inUse: Set<string>, now: number): Promise<void> {
    const ids = await readdir(this.dir).catch(() => [] as Array<string>);
    for (const id of ids) {
      if (!ID.test(id) || inUse.has(id)) {
        continue;
      }
      const written = await stat(join(this.dir, id)).catch(() => undefined);
      if (written && now - written.mtimeMs >= UNSENT_KEPT_MS) {
        await this.remove(id);
      }
    }
  }
}
