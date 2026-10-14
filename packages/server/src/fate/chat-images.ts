import { chatImages } from "../attach.ts";
import { type ChatImage, chatImageSize } from "../runner/images.ts";
import { REFUSALS, type SentImage } from "../runner/sessions.ts";
import type { Context } from "./context.ts";
import { callSiteError } from "./errors.ts";
import { refusedOn } from "./list-mutations.ts";

/** Each image of a message, an object of its ID and a size the core could have given, kept once. */
function uniqueImages(images: Array<unknown>): Array<ChatImage> {
  const unique = new Map<unknown, ChatImage>();
  for (const image of images) {
    if (typeof image !== "object" || image === null || Array.isArray(image)) {
      throw callSiteError("refused: an image is an object of its id, width, and height");
    }
    const { height, id, width } = image as Record<string, unknown>;
    if (!chatImageSize(typeof id === "string" ? id : "", width, height)) {
      throw callSiteError(
        "refused: an image's size is two positive integers, within the core's limits",
      );
    }
    if (!unique.has(id)) {
      unique.set(id, image as ChatImage);
    }
  }
  return [...unique.values()];
}

/**
 * The chat images of a message, as `POST /attach` returned them, with their files' paths in the
 * data folder, an image given twice kept once. Checked before any session work, as the session
 * manager checks them again: each an object of its ID and a size the core could have given, at
 * most 10, to an agent that reads images, and not with the workflow's message. An image whose file
 * is gone is refused.
 */
export async function sentImages(
  ctx: Pick<Context, "dataDir" | "sessions">,
  images: Array<ChatImage> | undefined,
  workflow: boolean,
): Promise<Array<SentImage>> {
  if (images === undefined) {
    return [];
  }
  if (!Array.isArray(images)) {
    throw callSiteError("refused: images is a list");
  }
  const unique = uniqueImages(images);
  await refusedOn(() => ctx.sessions.checkImages(unique, workflow));
  const store = chatImages(ctx.dataDir);
  return unique.map(({ height, id, width }) => {
    const path = typeof id === "string" ? store.path(id) : undefined;
    if (path === undefined) {
      throw callSiteError(`refused: ${REFUSALS.imageGone}`);
    }
    return { height, id, path, width };
  });
}
