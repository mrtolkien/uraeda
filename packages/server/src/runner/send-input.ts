import type { Capabilities } from "./adapter.ts";
import type { Trigger } from "./events.ts";
import type { ChatImage } from "./images.ts";
import { MAX_IMAGES, REFUSALS, refused } from "./session-state.ts";

/** A chat image sent with a message: its ID and size, which its item keeps, and its file's path. */
export type SentImage = ChatImage & { path: string };

/** A message to send: its text, its chat images, and for the workflow's, what started it. */
export type SendInput = {
  images?: Array<SentImage>;
  text: string;
  workflow?: { file?: string; trigger: Trigger };
};

/**
 * A message checked before any session work: text, or images alone, as `checkImages` allows them. Its item keeps the images' IDs and sizes, `held`; the agent gets their paths.
 */
export function checkSend(input: SendInput, capabilities: Capabilities) {
  const images = input.images ?? [];
  const blank = input.text.trim() === "";
  if (blank && images.length === 0) {
    throw refused(REFUSALS.blank);
  }
  checkImages(images, input.workflow !== undefined, capabilities);
  const held: { images?: Array<ChatImage> } =
    images.length === 0
      ? {}
      : { images: images.map(({ height, id, width }) => ({ height, id, width })) };
  return {
    held,
    paths: images.map(({ path }) => ({ path })),
    text: blank ? "" : input.text,
    workflow: input.workflow,
  };
}

/**
 * Refuses a message's images: more than 10, to an agent that does not declare images, or with the
 * workflow's message, which is the workflow's own text.
 */
export function checkImages(
  images: Array<unknown>,
  workflow: boolean,
  capabilities: Capabilities,
): void {
  if (images.length === 0) {
    return;
  }
  if (workflow) {
    throw refused(REFUSALS.workflowImages);
  }
  if (images.length > MAX_IMAGES) {
    throw refused(REFUSALS.tooManyImages);
  }
  if (!capabilities.images) {
    throw refused(REFUSALS.noImages);
  }
}
