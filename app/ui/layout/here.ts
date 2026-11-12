// What a pane's view knows of the pane around it, and how it opens another pane beside itself. It
// imports only `nsh` and types, never the store, so a list, which an extension's page also gets
// (`app/ui/index.ts`), may offer its rows to open beside: in a page, outside any pane, it offers
// nothing.
import { cleanup, context, effect, keyboardFrame, signal, type ViewRef } from "nsh";
import type { PaneRef } from "./layout";
import type { WidthClass } from "../width";

/** What a pane knows of itself, inside its view: `usePane()`. */
export type PaneHere = {
  focused: () => boolean;
  /** The pane's key: where it keeps what it remembers. */
  key: string;
  width: () => WidthClass;
};

export const PaneContext = context<PaneHere | null>(null);

/**
 * Brings a view into the scroll view around it, as the keys move a list's cursor onto it: the
 * cursor's bar of a row or a card asks it (`../lists/Row.tsx`), so a list longer than its pane
 * never moves its cursor out of sight. Given by `PaneScroll`; none outside one.
 */
export type Revealer = (view: ViewRef) => void;

export const RevealContext = context<Revealer | null>(null);

/** A view's or a scroller's box, as `measure()` gives it. */
type Measured = { pagePosition: { y: number }; bounds: { size: { height: number } } };

/**
 * How far a scroller scrolls to show `it` whole, with a line's room, or its top when it is taller
 * than the scroller: the least move, `0` when it shows already. Every revealer scrolls by it.
 */
export function revealBy(it: Measured, box: Measured): number {
  const room = 24;
  const top = it.pagePosition.y - box.pagePosition.y;
  const bottom = top + it.bounds.size.height;
  const height = box.bounds.size.height;
  if (top < room || it.bounds.size.height > height - 2 * room) return top - room;
  if (bottom > height - room) return bottom - (height - room);
  return 0;
}

/**
 * A form typed in on a phone shows whole as the keyboard rises, its field and the button that
 * saves it: a browser scrolls only the caret into view, and the keyboard covered the button. Its
 * `ref` goes on the form's view, and `typing` follows its field's focus. Inside a `PaneScroll`.
 */
export function wholeOverKeyboard(): {
  ref: (view: ViewRef) => void;
  typing: (on: boolean) => void;
} {
  const reveal = RevealContext();
  const typing = signal(false);
  let form: ViewRef | undefined;
  effect(() => {
    if (keyboardFrame().height === 0 || !typing() || form === undefined || reveal === null) return;
    const view = form;
    // Once the pane took the room the keyboard leaves.
    const timer = setTimeout(() => reveal(view), 120);
    cleanup(() => clearTimeout(timer));
  });
  return {
    ref: (view) => {
      form = view;
    },
    typing: (on) => typing.set(on),
  };
}

/** A pane a view asked to open beside it, which the layout shell takes and clears. */
export const besideWanted = signal<{ from: string | null; pane: PaneRef } | null>(null);

/**
 * What opens a pane beside the pane of the caller, in the other stack of the place shown, as a
 * tab, in place of a navigation: a session's conversation beside another, a file beside a session,
 * a diff beside a transcript. Called in a view; the function it gives is called on a key or a press.
 */
export function besideOpener(): (pane: PaneRef) => void {
  const from = PaneContext()?.key ?? null;
  return (pane) => besideWanted.set({ from, pane });
}

/** A pane that asked to be zoomed over the window, or back: the layout shell takes and clears it. */
export const zoomWanted = signal<{ key: string; on: boolean } | null>(null);

/**
 * What zooms the caller's pane over the window, focused, or puts it back, as the frame's `Space w z`
 * does: a preview's "Full screen". Called in a view; the function it gives on a key or a press.
 */
export function zoomer(): (on: boolean) => void {
  const key = PaneContext()?.key ?? null;
  return (on) => {
    if (key !== null) zoomWanted.set({ key, on });
  };
}

/** What a pane names that can be opened beside it now: the row under a list's cursor. */
export type BesideOffer = { open: () => void; pane: PaneRef };

const offers = new Map<string, () => BesideOffer | undefined>();

/**
 * Offers what the caller's pane names to its menu, "Open … beside": a list offers the row under
 * its cursor. One offer per pane, the last made; it goes with the view.
 */
export function offerBeside(offer: () => BesideOffer | undefined) {
  const key = PaneContext()?.key;
  if (key === undefined) return;
  offers.set(key, offer);
  cleanup(() => {
    if (offers.get(key) === offer) offers.delete(key);
  });
}

/** What the pane `key` offers to open beside it now. */
export const besideOffer = (key: string | null): BesideOffer | undefined =>
  key === null ? undefined : offers.get(key)?.();
