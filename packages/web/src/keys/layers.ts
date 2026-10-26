// The one rule of "a layer is open": what shows over the page and owns the keys while it does, so no
// shortcut of the page acts under it. A shown dialog, an expanded popup's trigger (a menu or a
// Selector, by `aria-haspopup`, or a combobox), an open popover that is not manual, or a key
// pressed inside a dialog, a listbox, a menu, or a popover that is not manual (the rail's old
// rule). An expanded disclosure without `aria-haspopup`, like the rail's logo, owns no key: only a
// popup's owner does. A story full screen is a layer too: the browser's own full screen here, an
// overlay (a dialog) where the browser has none.
import { useSyncExternalStore } from "react";

const DIALOGS = 'dialog[open], [role="dialog"], [role="alertdialog"]';
const EXPANDED = '[aria-expanded="true"][aria-haspopup], [role="combobox"][aria-expanded="true"]';
const INSIDE = [
  "dialog",
  '[role="dialog"]',
  '[role="alertdialog"]',
  '[role="listbox"]',
  '[role="menu"]',
  '[popover]:not([popover="manual"])',
].join(", ");

/**
 * Whether an element shows: closed, a layer may stay in the page, hidden, itself or in a popover
 * that is not open (`checkVisibility`, for happy-dom, whose `getClientRects` always has one rect).
 */
function shown(element: Element) {
  return element.getClientRects().length > 0 && (element.checkVisibility?.() ?? true);
}

/**
 * Whether a layer is open: its own keys are not the page's. `target` is where a key was pressed:
 * inside a layer's part, that layer owns it, though the layer is not otherwise detected.
 */
export function isLayerOpen(target?: EventTarget | null) {
  if ((target as Partial<Element> | null | undefined)?.closest?.(INSIDE) != null) {
    return true;
  }
  if (document.fullscreenElement != null) {
    // A story shown full screen by the browser: the page behind it is not what the keys mean.
    return true;
  }
  if (document.querySelector(EXPANDED) !== null) {
    return true;
  }
  if (Array.from(document.querySelectorAll(DIALOGS)).some(shown)) {
    return true;
  }
  try {
    // The toasts' region is a manual popover, open on every page, which owns no key.
    return document.querySelector(':popover-open:not([popover="manual"])') !== null;
  } catch {
    // A browser without the popover API opens no popover.
    return false;
  }
}

/** What changes whether a layer is open, besides the nodes coming and going. */
const WATCHED = ["aria-expanded", "aria-haspopup", "class", "hidden", "open", "popover", "role"];

/** The listeners of `useLayerOpen`, and what serves them, while there is one. */
const listeners = new Set<() => void>();
let stop: (() => void) | null = null;
/** Whether a layer is open, as of the last frame that followed a change: one check for all. */
let open = false;
/** The frame that will check, when a change asked for one. */
let frame: number | null = null;

/**
 * Asks for a check at the next frame, one for the whole burst: a streaming transcript changes the
 * document many times a frame, and the rule reads the layout, which is for the listeners together
 * once, not for each of them at every change.
 */
function schedule() {
  frame ??= requestAnimationFrame(() => {
    frame = null;
    const now = isLayerOpen();
    if (now !== open) {
      open = now;
      for (const listener of listeners) {
        listener();
      }
    }
  });
}

/** Starts watching the document: a popover opens with no attribute, but with a `toggle` event. */
function watch() {
  const observer = new MutationObserver(schedule);
  observer.observe(document, {
    attributeFilter: WATCHED,
    attributes: true,
    childList: true,
    subtree: true,
  });
  document.addEventListener("toggle", schedule, true);
  document.addEventListener("fullscreenchange", schedule);
  open = isLayerOpen();
  return () => {
    observer.disconnect();
    document.removeEventListener("toggle", schedule, true);
    document.removeEventListener("fullscreenchange", schedule);
    if (frame !== null) {
      cancelAnimationFrame(frame);
      frame = null;
    }
  };
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  stop ??= watch();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      stop?.();
      stop = null;
    }
  };
}

/** Whether a layer is open now, re-rendering the caller as one opens or closes. */
export function useLayerOpen() {
  return useSyncExternalStore(
    subscribe,
    () => (stop === null ? isLayerOpen() : open),
    () => false,
  );
}
