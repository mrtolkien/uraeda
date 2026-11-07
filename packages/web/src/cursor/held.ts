// Whether the keyboard's cursor holds a stop: the stop took the browser's focus after a key, and the
// last input was a key (R2, R11). A click focuses a button in Chrome, so the focus alone would show
// the cursor under the mouse; `:focus-visible` says the same in a browser, but not in happy-dom,
// where the tests run. A stop a click focused stays free under the keys that follow, as `d` on a
// comment clicked then would delete it. The cursor is a page's: on a page that does not mount it,
// `useCursor`, nothing is held, and neither a key nor the mouse moves the focus for it.
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

/** The element that last took the focus while the last input was a key, `null` after a press. */
let keyFocus: EventTarget | null = null;

/** How many mounted pages have the cursor: none, and the cursor does nothing. */
let pages = 0;

const readers = new Set<() => void>();

function publish() {
  for (const read of readers) {
    read();
  }
}

function setByKey(value: boolean) {
  if (isByKey !== value) {
    isByKey = value;
    publish();
  }
}

/** Says the last input was a key, for a key's binding that gives a stop the focus. */
export function markByKey() {
  setByKey(true);
}

/** Forgets the last input, as on a page just loaded: for the tests, which share the module. */
export function resetHeld() {
  setByKey(false);
  keyFocus = null;
}

/**
 * Turns the cursor on for as long as a page that has it is mounted: `useCursor`'s, returning what
 * turns it off.
 */
export function cursorOn(): () => void {
  pages += 1;
  publish();
  return () => {
    pages -= 1;
    publish();
  };
}

/** Whether the last input was a key: a stop given the focus now is held. */
export const isKeyInput = () => isByKey;

/** Whether the focus is the cursor's: it arrived by a key, the last input, on a page with the cursor. */
function isFocusByKey() {
  return pages > 0 && isByKey && keyFocus !== null && keyFocus === document.activeElement;
}

/** The stop the cursor holds: the stop holding the focus after a key, `null` for none. */
export function heldStop(): HTMLElement | null {
  return isFocusByKey() ? stopOf(document.activeElement) : null;
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
  if (pages === 0 || event.key !== "Escape" || !inTextField(event.target)) {
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
  if (isFocusByKey() && stop !== null && stop === active) {
    stop.blur();
  }
  setByKey(false);
}

/** A pointer's press: what it focuses is the pointer's, not the cursor's, whatever key follows. */
function onPointerDown() {
  keyFocus = null;
  setByKey(false);
}

/** The focus arriving: the cursor's when the last input was a key. Before the readers hear it. */
function onFocusIn(event: FocusEvent) {
  keyFocus = isByKey ? event.target : null;
}

if (typeof document !== "undefined") {
  watchKeys(onKey);
  // After `pointerMoved.ts`'s own listener, imported above, which tells a real move.
  document.addEventListener("pointermove", onPointerMove, { capture: true, passive: true });
  document.addEventListener("pointerdown", onPointerDown, { capture: true, passive: true });
  document.addEventListener("focusin", onFocusIn, { capture: true });
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
 * The element `ref` holds while it is the cursor's, `null` otherwise: it took the focus after a key,
 * and the last input was a key, on a page with the cursor. `null` under a click, or once the mouse
 * moved. The element itself, so its keys can be made from it while drawing.
 */
export function useHeldElement<T extends HTMLElement>(ref: RefObject<T | null>): T | null {
  return useSyncExternalStore(
    subscribe,
    () =>
      ref.current !== null && isFocusByKey() && document.activeElement === ref.current
        ? ref.current
        : null,
    () => null,
  );
}

/** Whether the element `ref` holds is the cursor's, as `useHeldElement` tells. */
export function useHeld(ref: RefObject<HTMLElement | null>): boolean {
  return useHeldElement(ref) !== null;
}
