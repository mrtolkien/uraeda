// The keyboard's cursor on a page: `j` `k` and the arrows move the focus from stop to stop, in
// document order, scrolling the page by `move.ts`'s rule, and Escape clears it. A page mounts it;
// the stops are found by their mark, whatever drew them. Where no stop is, or past either end, the
// key goes on to the shell's scroll.
import { useEffect } from "react";
import { areaOf, areasOf, type Area, glideBy, pendingOf } from "../keys/scroll.ts";
import { useKeys } from "../keys/registry.tsx";
import type { Binding } from "../keys/store.ts";
import { topBarBottom } from "../layout/topBar.ts";
import { cursorOn, heldStop, isFocusLost, isKeyInput, markByKey } from "./held.ts";
import { type Box, cursorStep, placed, scrollFor, type View } from "./move.ts";
import { stopOf, stopsOf } from "./stops.ts";

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
    top: Math.max(topBarBottom(), own?.top ?? 0),
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

/**
 * The boxes of `stops`, each naming the index of the stop holding it among them, if any, as an
 * embed's button inside a question card.
 */
function boxesOf(stops: ReadonlyArray<HTMLElement>, pending: number): Array<Box> {
  const indexes = new Map(stops.map((stop, index) => [stop, index]));
  return stops.map((stop) => {
    const outer = stopOf(stop.parentElement);
    const parent = outer === null ? undefined : indexes.get(outer);
    const box = boxOf(stop, pending);
    return parent === undefined ? box : { ...box, parent };
  });
}

/**
 * A held stop with its bar, which mounts under it once it holds the focus: the stop's box, its end
 * at the bar's when the bar is lower.
 */
function withBar(stop: HTMLElement, pending: number): Box {
  const box = boxOf(stop, pending);
  const bar = document.querySelector("[data-stop-bar]")?.getBoundingClientRect();
  return bar === undefined ? box : { ...box, bottom: Math.max(box.bottom, bar.bottom - pending) };
}

/**
 * Gives a stop the focus, held, and scrolls the area by `by` px, gliding. In the next frame, once
 * the held stop's bar mounted, scrolls the little more that `scroll` asks of the stop with its bar,
 * so the bar keeps the margin as the stop does (R13).
 */
function take(stop: HTMLElement, by: number, area: Area, scroll?: (box: Box) => number) {
  markByKey();
  stop.focus({ preventScroll: true });
  if (by !== 0) {
    glideBy(area, by);
  }
  if (scroll === undefined) {
    return;
  }
  requestAnimationFrame(() => {
    if (heldStop() !== stop) {
      return;
    }
    const more = scroll(withBar(stop, pendingOf(area)));
    if (Math.abs(more) >= 1) {
      glideBy(area, more);
    }
  });
}

/**
 * Gives `stop` the focus, held as after a key, and scrolls by the cursor's rule, as a move from
 * `from`, the stop held before, would: for a stop's own keys that move the cursor, as `J`.
 */
export function focusStop(stop: HTMLElement, from?: HTMLElement): void {
  // From below, as `K`, the move is up: a tall stop shows its end.
  const up =
    from !== undefined && from.getBoundingClientRect().top > stop.getBoundingClientRect().top;
  land(stop, from, up ? -1 : 1);
}

/** Gives `stop` the focus, held, scrolled as a move in `direction` from `from` would scroll. */
function land(stop: HTMLElement, from: HTMLElement | undefined, direction: 1 | -1) {
  const area = areaOf(stop);
  const pending = pendingOf(area);
  const held = from && boxOf(from, pending);
  const view = viewOf(area);
  take(stop, scrollFor(boxOf(stop, pending), held, view, direction), area, (box) =>
    scrollFor(box, held, view, direction),
  );
}

/**
 * The scroll area the cursor moves in, and its stops, in document order: the held stop's, else the
 * page's own, else, on a page whose stops all sit in scrolling columns, the first stop's (R8).
 */
function areaToMove(stops: ReadonlyArray<HTMLElement>, held: HTMLElement | null) {
  const areas = areasOf(stops);
  let area = areas[0] ?? null;
  if (held !== null) {
    area = areas[stops.indexOf(held)] ?? null;
  } else if (areas.includes(null)) {
    area = null;
  }
  return { area, stops: stops.filter((_, index) => areas[index] === area) };
}

/**
 * Moves the cursor a stop down, 1, or up, -1, among the stops of its scroll area, measured in that
 * area's view; past its area's last or first stop, onto the next in document order, in the area
 * holding it (R8). `false` where it cannot, so the page scrolls.
 */
function move(direction: 1 | -1) {
  const all = stopsOf();
  const held = heldStop();
  const { area, stops } = areaToMove(all, held);
  const pending = pendingOf(area);
  const index = held === null ? -1 : stops.indexOf(held);
  const boxes = boxesOf(stops, pending);
  const view = viewOf(area);
  const step = cursorStep(boxes, index === -1 ? null : index, direction, view);
  const stop = step === null ? undefined : stops[step.focus];
  if (step === null || stop === undefined) {
    const next = held === null ? undefined : beyond(all, held, direction);
    if (next === undefined) {
      return false;
    }
    land(next, undefined, direction);
    return;
  }
  if (stop === held) {
    // Reading on through a tall stop: its bar is drawn already.
    take(stop, step.scrollBy, area);
    return;
  }
  const from = boxes[index];
  take(stop, step.scrollBy, area, (box) => scrollFor(box, from, view, direction));
}

/**
 * The stop past `held` in document order, out of its scroll area (R8): forward, the next it does not
 * hold; backward, the previous, or the outermost stop holding it, as `cursorStep` moves (R12).
 */
function beyond(all: ReadonlyArray<HTMLElement>, held: HTMLElement, direction: 1 | -1) {
  let at = all.indexOf(held) + direction;
  while (direction === 1 && all[at] !== undefined && held.contains(all[at]!)) {
    at += 1;
  }
  let next = all[at];
  const first = direction === -1 ? stopOf(next?.parentElement ?? null) : null;
  for (let outer = first; outer !== null;) {
    if (!outer.contains(held)) {
      next = outer;
    }
    outer = stopOf(outer.parentElement);
  }
  return next;
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
function useKeepHeld(on: boolean) {
  useEffect(() => {
    if (!on) {
      return;
    }
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
  }, [on]);
}

const NONE: ReadonlyArray<Binding> = [];

/**
 * The cursor's keys, for as long as the page is mounted and `on`: `j` `↓` and `k` `↑` move it, "j k
 * move" in the status line, and Escape clears it. Only while a page has it does a stop show as held.
 * A page is `on` where its blocks are stops, a spec under review, a document with Ask: elsewhere its
 * folds alone would be stops, and `j` `k` scroll the text as they do on any page (R14).
 */
export function useCursor(on = true): void {
  useKeys(on ? BINDINGS : NONE);
  useKeepHeld(on);
  useEffect(() => (on ? cursorOn() : undefined), [on]);
}
