// The keyboard's cursor on a page: `j` `k` and the arrows move the focus from stop to stop, in
// document order, scrolling the page by `move.ts`'s rule, and Escape clears it. A page mounts it;
// the stops are found by their mark, whatever drew them. Where no stop is, or past either end, the
// key goes on to the shell's scroll.
import { useEffect } from "react";
import { areaOf, type Area, glideBy, pendingOf } from "../keys/scroll.ts";
import { useKeys } from "../keys/registry.tsx";
import type { Binding } from "../keys/store.ts";
import { heldStop, isFocusLost, isKeyInput, markByKey } from "./held.ts";
import { type Box, cursorStep, placed, scrollFor, type View } from "./move.ts";
import { stopsOf } from "./stops.ts";

/** An element's box in the window, `undefined` where it is not drawn, as a hidden status line. */
function drawn(selector: string) {
  const element = document.querySelector(selector);
  return element === null || element.getClientRects().length === 0
    ? undefined
    : element.getBoundingClientRect();
}

/**
 * The room between the top bar and the status line, inside the area, in window pixels. A bar that
 * hid on the scroll, slid out of the window, takes none.
 */
function viewOf(area: Area): View {
  const own = area?.getBoundingClientRect();
  return {
    bottom: Math.min(
      drawn('footer[aria-label="Status line"]')?.top ?? Infinity,
      window.innerHeight,
      own?.bottom ?? Infinity,
    ),
    top: Math.max(drawn('[role="banner"]')?.bottom ?? 0, 0, own?.top ?? 0),
  };
}

/**
 * Where a stop will be once the area's running glide ends, `pending` px on, and the pane holding
 * it: a key pressed mid-glide counts from where the page heads, as its scroll adds to it.
 */
function boxOf(stop: HTMLElement, pending: number): Box {
  const { bottom, top } = stop.getBoundingClientRect();
  const pane = stop.closest("[data-pane]");
  const edges = pane?.getBoundingClientRect();
  return {
    bottom: bottom - pending,
    pane:
      pane && edges
        ? { bottom: edges.bottom - pending, id: pane, top: edges.top - pending }
        : undefined,
    top: top - pending,
  };
}

/** Gives a stop the focus, held, and scrolls the area by `by` px, gliding. */
function take(stop: HTMLElement, by: number, area: Area) {
  markByKey();
  stop.focus({ preventScroll: true });
  if (by !== 0) {
    glideBy(area, by);
  }
}

/**
 * Gives `stop` the focus, held as after a key, and scrolls by the cursor's rule, as a move from
 * `from`, the stop held before, would: for a stop's own keys that move the cursor, as `J`.
 */
export function focusStop(stop: HTMLElement, from?: HTMLElement): void {
  const area = areaOf(stop);
  const pending = pendingOf(area);
  take(stop, scrollFor(boxOf(stop, pending), from && boxOf(from, pending), viewOf(area)), area);
}

/** Moves the cursor a stop down, 1, or up, -1: `false` where it cannot, so the page scrolls. */
function move(direction: 1 | -1) {
  const stops = stopsOf();
  const held = heldStop();
  const index = held === null ? -1 : stops.indexOf(held);
  const area = areaOf(held ?? stops[0] ?? null);
  const pending = pendingOf(area);
  const step = cursorStep(
    stops.map((stop) => boxOf(stop, pending)),
    index === -1 ? null : index,
    direction,
    viewOf(area),
  );
  const stop = step === null ? undefined : stops[step.focus];
  if (step === null || stop === undefined) {
    return false;
  }
  take(stop, step.scrollBy, area);
}

/**
 * Clears the cursor: its stop lets the focus go. `false` with none, for the page's own Escape, and
 * where the focus is on a control inside the stop, as a pane's button, whose Escape is the page's.
 */
function clear() {
  const held = heldStop();
  if (held === null || held !== document.activeElement) {
    return false;
  }
  held.blur();
}

const BINDINGS: ReadonlyArray<Binding> = [
  { hint: "j k", hintLabel: "move", keys: "j", label: "next stop", run: () => move(1) },
  { keys: "ArrowDown", label: "next stop", run: () => move(1) },
  { keys: "k", label: "previous stop", run: () => move(-1) },
  { keys: "ArrowUp", label: "previous stop", run: () => move(-1) },
  { keys: "Escape", label: "clear the cursor", run: clear },
];

/**
 * Gives a stop that took a removed one's place the focus, held, scrolled only into the margins: a
 * pane is not shown whole, as the cursor did not move into it.
 */
function refocus(stop: HTMLElement) {
  const area = areaOf(stop);
  take(stop, placed(boxOf(stop, pendingOf(area)), viewOf(area)), area);
}

/**
 * A held stop removed from the page, as an agent's commit redraws it, passes the focus to the stop
 * now at its place, or the last. The stop is remembered while it holds the focus: once it lets the
 * focus go and stays on the page, by Escape or a mouse move, a redraw brings no cursor back.
 */
function useKeepHeld() {
  useEffect(() => {
    let last: { index: number; stop: HTMLElement } | null = null;
    const onFocus = () => {
      const stop = heldStop();
      last = stop === null ? last : { index: stopsOf().indexOf(stop), stop };
    };
    const onBlur = (event: FocusEvent) => {
      const target = event.target as Node | null;
      if (last !== null && target?.isConnected === true && last.stop.contains(target)) {
        last = null;
      }
    };
    const observer = new MutationObserver(() => {
      if (last === null || last.stop.isConnected) {
        return;
      }
      const { index } = last;
      last = null;
      if (!isKeyInput() || !isFocusLost()) {
        return;
      }
      const stops = stopsOf();
      const stop = stops[Math.min(Math.max(index, 0), stops.length - 1)];
      if (stop !== undefined) {
        refocus(stop);
      }
    });
    document.addEventListener("focusin", onFocus);
    document.addEventListener("focusout", onBlur);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      document.removeEventListener("focusin", onFocus);
      document.removeEventListener("focusout", onBlur);
      observer.disconnect();
    };
  }, []);
}

/**
 * The cursor's keys, for as long as the page is mounted: `j` `↓` and `k` `↑` move it, "j k move" in
 * the status line, and Escape clears it.
 */
export function useCursor(): void {
  useKeys(BINDINGS);
  useKeepHeld();
}
