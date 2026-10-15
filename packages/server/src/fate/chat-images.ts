import { readFile } from "node:fs/promises";
import { chatImages } from "../attach.ts";
import { MAX_IMAGES } from "../limits.ts";
import { type ChatImage, chatImageSize } from "../runner/images.ts";
import { checkImages } from "../runner/send-input.ts";
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

/** The images given, as a list, an image given twice kept once. */
function givenImages(images: Array<ChatImage> | undefined): Array<ChatImage> {
  if (images === undefined) {
    return [];
  }
  if (!Array.isArray(images)) {
    throw callSiteError("refused: images is a list");
  }
  return uniqueImages(images);
}

/** The images with their files' paths in the data folder, an image whose file is gone refused. */
function imageFiles(dataDir: string, images: Array<ChatImage>): Array<SentImage> {
  const store = chatImages(dataDir);
  return images.map(({ height, id, width }) => {
    const path = typeof id === "string" ? store.path(id) : undefined;
    if (path === undefined) {
      throw callSiteError(`refused: ${REFUSALS.imageGone}`);
    }
    return { height, id, path, width };
  });
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
  const unique = givenImages(images);
  await refusedOn(() => checkImages(unique, workflow, ctx.sessions.adapter.capabilities));
  return imageFiles(ctx.dataDir, unique);
}

/**
 * The bytes of a typed change's images, as `POST /attach` returned them, an image given twice kept
 * once: each an object of its ID and a size the core could have given, at most 10. They go into
 * the repository, not to the agent, whatever images it reads. An image whose file is gone, even as
 * it is read, is refused.
 */
export async function changeImages(
  ctx: Pick<Context, "dataDir">,
  images: Array<ChatImage> | undefined,
): Promise<Array<Buffer>> {
  const unique = givenImages(images);
  if (unique.length > MAX_IMAGES) {
    throw callSiteError(`refused: ${REFUSALS.tooManyImages}`);
  }
  return Promise.all(
    imageFiles(ctx.dataDir, unique).map(({ path }) =>
      readFile(path).catch((error: NodeJS.ErrnoException) => {
        throw error.code === "ENOENT" ? callSiteError(`refused: ${REFUSALS.imageGone}`) : error;
      }),
    ),
  );
}
