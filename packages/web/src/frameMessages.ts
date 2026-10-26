// The messages of a story's sandboxed frame, checked before they are read: the page trusts none of
// what a frame sends, and only reads the messages of its own frame's window.
import type { Picked } from "./storyComment.ts";

/** A message from a frame, which the embed reads only from its own frame's window. */
export type FrameMessage = {
  height?: unknown;
  name?: unknown;
  role?: unknown;
  text?: unknown;
  uraeda: unknown;
};

/** Whether a message is the pick script's: an object with a `uraeda` field. */
export function isFrameMessage(data: unknown): data is FrameMessage {
  return typeof data === "object" && data !== null && "uraeda" in data;
}

/**
 * The pick script's message that `data` is, when it comes from `frame`'s own window: not from
 * another window, the page's own or another embed's frame, and not from no window.
 */
export function frameMessage(
  source: unknown,
  frame: unknown,
  data: unknown,
): FrameMessage | undefined {
  return source === null || source === undefined || frame !== source || !isFrameMessage(data)
    ? undefined
    : data;
}

/** A story's height, when its `size` message gives a finite number above 0. */
export function heightOf(message: FrameMessage): number | undefined {
  const { height } = message;
  return typeof height === "number" && Number.isFinite(height) && height > 0 ? height : undefined;
}

/** The element a `picked` message names, when it gives its role and name as text, with its text. */
export function pickedOf({ name, role, text }: FrameMessage): Picked | undefined {
  return typeof role === "string" && role !== "" && typeof name === "string"
    ? { name, role, ...(typeof text === "string" && text !== "" ? { text } : {}) }
    : undefined;
}
