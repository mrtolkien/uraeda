// The core's size limit of an attached image, which the server and the UI also check before the
// core sees the image: their refusal is the core's text. And the chat's own limits on a message's
// images, which the sessions enforce and the composer checks first. Free of Node's modules, so the
// UI can import it.

const MIB = 1024 * 1024;
/** The core's limit, 20 MB counted in MiB (R9). */
export const IMAGE_LIMIT = 20 * MIB;

/** A size in MB, rounded up to one decimal, as the core writes it in its refusals. */
export function megabytes(bytes: number): string {
  const tenths = Math.ceil((bytes * 10) / MIB);
  return tenths % 10 === 0 ? String(tenths / 10) : (tenths / 10).toFixed(1);
}

/** The core's refusal of an image over the limit. */
export function overLimit(name: string, bytes: number): string {
  return `This image is over 20 MB: ${name} is ${megabytes(bytes)} MB.`;
}

/** A chat message takes at most this many images. */
export const MAX_IMAGES = 10;

/** The refusals of a message's images, by the sessions and by the composer before them. */
export const IMAGE_REFUSALS = {
  /** Images sent to an agent that does not declare them. */
  noImages: "This agent cannot read images.",
  tooManyImages: `A message takes at most ${MAX_IMAGES} images.`,
  /** The workflow's message is the workflow's own text: the human sends images in a chat. */
  workflowImages: "The workflow's message takes no images.",
};
