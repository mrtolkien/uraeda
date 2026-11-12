// What a pane's view knows of the pane around it, and how it opens another pane beside itself. It
// imports only `nsh` and types, never the store, so a list, which an extension's page also gets
// (`app/ui/index.ts`), may offer its rows to open beside: in a page, outside any pane, it offers
// nothing.
import { cleanup, context, signal } from "nsh";
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
