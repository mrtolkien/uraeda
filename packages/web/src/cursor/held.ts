// Whether the keyboard's cursor holds a stop: the stop has the browser's focus, and the last input
// was a key (R2). A click focuses a button in Chrome, so the focus alone would show the cursor under
// the mouse; `:focus-visible` says the same in a browser, but not in happy-dom, where the tests run.
// The keys are heard through the registry's watch, which binds none; a mouse moving the pointer
// hides the cursor, as a press of any pointer does, and Escape out of a text field inside a stop,
// which no binding hears, gives the stop back the focus, held (R6).
import { type RefObject, useSyncExternalStore } from "react";
import { inTextField } from "../keys/fields.ts";
import { watchKeys } from "../keys/registry.tsx";
import { isNativePointerMoved } from "../pointerMoved.ts";
import { stopOf } from "./stops.ts";

/** Whether the last input was a key, rather than a pointer's press or move. */
let isByKey = false;

const readers = new Set<() => void>();

function setByKey(value: boolean) {
  if (isByKey !== value) {
    isByKey = value;
    for (const read of readers) {
      read();
    }
  }
}

/** Says the last input was a key, for a key's binding that gives a stop the focus. */
export function markByKey() {
  setByKey(true);
}

/** Forgets the last input, as on a page just loaded: for the tests, which share the module. */
export function resetHeld() {
  setByKey(false);
}

/** Whether the last input was a key: a stop given the focus now is held. */
export const isKeyInput = () => isByKey;

/** The stop the cursor holds: the stop holding the focus after a key, `null` for none. */
export function heldStop(): HTMLElement | null {
  return isByKey ? stopOf(document.activeElement) : null;
}

/** Whether nothing holds the focus: the page's body, where a blurred or removed element leaves it. */
export const isFocusLost = () =>
  document.activeElement === null || document.activeElement === document.body;

/** The keys held for a pointer's press, as Shift for a Shift+click: alone, they are no key input. */
const MODIFIERS = new Set(["Alt", "Control", "Meta", "Shift"]);

/**
 * A key: the last input is one, but for a modifier alone. Escape in a text field inside a stop, which leaves the field, gives
 * the stop the focus once the field let it go, as the field's own Escape runs before this watch.
 */
function onKey(event: KeyboardEvent) {
  if (MODIFIERS.has(event.key)) {
    return;
  }
  setByKey(true);
  if (event.key !== "Escape" || !inTextField(event.target)) {
    return;
  }
  const stop = stopOf(event.target as Element);
  if (stop === null || stop === event.target) {
    return;
  }
  // After the field's own handlers and what they render: the field may close on its Escape.
  window.setTimeout(() => {
    if (stop.isConnected && isFocusLost()) {
      stop.focus({ preventScroll: true });
    }
  }, 0);
}

/** A mouse moving the pointer: the cursor hides, and its stop lets the focus go. */
function onPointerMove(event: PointerEvent) {
  if (!isNativePointerMoved(event)) {
    return;
  }
  const active = document.activeElement;
  const stop = stopOf(active);
  if (isByKey && stop !== null && stop === active) {
    stop.blur();
  }
  setByKey(false);
}

if (typeof document !== "undefined") {
  watchKeys(onKey);
  // After `pointerMoved.ts`'s own listener, imported above, which tells a real move.
  document.addEventListener("pointermove", onPointerMove, { capture: true, passive: true });
  document.addEventListener("pointerdown", () => setByKey(false), { capture: true, passive: true });
}

function subscribe(read: () => void) {
  readers.add(read);
  document.addEventListener("focusin", read);
  document.addEventListener("focusout", read);
  return () => {
    readers.delete(read);
    document.removeEventListener("focusin", read);
    document.removeEventListener("focusout", read);
  };
}

/**
 * Whether the element `ref` holds is the cursor's: it holds the focus, and the last input was a
 * key. False under a click, or once the mouse moved.
 */
export function useHeld(ref: RefObject<HTMLElement | null>): boolean {
  return useSyncExternalStore(
    subscribe,
    () => isByKey && ref.current !== null && document.activeElement === ref.current,
    () => false,
  );
}
