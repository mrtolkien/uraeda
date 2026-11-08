// The core's size limit of an attached image, which the server and the UI also check before the
// core sees the image: their refusal is the core's text. And the chat's own limits on a message's
// images, which the sessions enforce and the composer checks first. And the size of a turn's log's
// pages, which the UI reads a stretch's page by. And the refusals of a runtime off or not available,
// or of a model or an effort it does not offer, which the composer shows before sending. Free of
// Node's modules, so the UI can import it.

/** The items in each page of a turn's log. */
export const TURN_PAGE = 100;

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

/** The refusals of a message whose runtime cannot take it, by the sessions and by the composer. */
export const RUNTIME_REFUSALS = {
  unavailable: (name: string) => `${name} is not available on this machine.`,
  /** A new session of a repository with every runtime off there. */
  noRuntime: "No agent runtime is on here: turn one on in Settings, Extensions",
  /** A message to a session whose runtime is off in its repository, or not registered. */
  runtimeOff: (title: string) => `${title} is off: turn it on to continue this session`,
  /** A model its runtime's list does not hold: the runtime by its name for people. */
  noModel: (runtime: string, model: string) => `${runtime} has no model ${model}: pick another`,
  /** An effort the model does not take: the model and the effort by their names for people. */
  noEffort: (model: string, effort: string) => `${model} takes no ${effort} effort: pick another`,
  /** A pick's field that is no ID, as fate's inputs are not typed when they run. */
  notName: (field: "agent" | "effort" | "model") => `The ${field} is not a name: pick another`,
};
