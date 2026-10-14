import { chatImages } from "../attach.ts";
import type { ChatImage } from "../runner/images.ts";
import { REFUSALS, type SentImage } from "../runner/sessions.ts";
import type { Context } from "./context.ts";
import { callSiteError } from "./errors.ts";

const isSize = (value: unknown) => Number.isInteger(value) && (value as number) > 0;

/**
 * The chat images of a message, as `POST /attach` returned them, with their files' paths in the
 * data folder. An image whose file is gone is refused.
 */
export function sentImages(
  ctx: Pick<Context, "dataDir">,
  images: Array<ChatImage> | undefined,
): Array<SentImage> {
  if (images === undefined) {
    return [];
  }
  if (!Array.isArray(images)) {
    throw callSiteError("refused: images is a list");
  }
  const store = chatImages(ctx.dataDir);
  return images.map(({ height, id, width }) => {
    if (!isSize(width) || !isSize(height)) {
      throw callSiteError("refused: an image's size is two positive integers");
    }
    const path = typeof id === "string" ? store.path(id) : undefined;
    if (path === undefined) {
      throw callSiteError(`refused: ${REFUSALS.imageGone}`);
    }
    return { height, id, path, width };
  });
}
