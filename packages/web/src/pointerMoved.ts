// Whether a mouse's `pointermove` is the human moving it: what moves the selection, or the focus,
// to what the pointer is over. The page scrolling, by the keys or by content arriving, under a
// still pointer moves nothing: a browser may still send a move then, or fill its `movementX` in,
// but the pointer is where it was in the window. Nor does a move over the page under a layer that
// leaves the page in reach, as the theme picker's list: the layer keeps the focus.
import type { PointerEvent } from "react";
import { isLayerOpenCached } from "./keys/layers.ts";

/** Where the last move left the pointer in the window, none before the first. */
let last: { x: number; y: number } | undefined;
/** The moves that changed where the pointer is: the page's handlers run after the document's. */
const moved = new WeakSet<Event>();

function track(event: globalThis.PointerEvent) {
  if (last !== undefined && (event.clientX !== last.x || event.clientY !== last.y)) {
    moved.add(event);
  }
  last = { x: event.clientX, y: event.clientY };
}

if (typeof document !== "undefined") {
  document.addEventListener("pointermove", track, { capture: true, passive: true });
}

/**
 * A mouse's move that took the pointer elsewhere in the window since the last one, with no layer
 * open over the page, by the answer cached for the frame: a move scans no document. The first move
 * seen only marks where the pointer is: a real move sends many.
 */
export function isPointerMoved(event: PointerEvent) {
  return isNativePointerMoved(event.nativeEvent) && !isLayerOpenCached();
}

/**
 * `isPointerMoved` for the browser's own event, as a listener on the document hears it after this
 * module's: what hides the keyboard's cursor (`cursor/held.ts`).
 */
export function isNativePointerMoved(event: globalThis.PointerEvent) {
  return event.pointerType === "mouse" && moved.has(event);
}
