// Where the keyboard focus is, and where it goes back to. Native Shell says when a view takes or
// loses the focus, never which view has it, so what can take it says so here: a field or a
// control spreads `focusStop` on its element. An overlay then puts the focus in itself as it
// opens, gives it back where it was as it closes, and a dialog keeps Tab among its own stops.
import { cleanup, context, Keyboard } from "nsh";

/** What takes the keyboard focus: a field, or a view that takes presses. */
export type Focusable = { focus(): void };

type Stop = { isThere: boolean; isFirst: boolean; node: () => Focusable | undefined };

/** The stops of one overlay, in the order they were made, which is the order Tab goes through. */
export type Stops = Array<Stop>;

/** The stops of the overlay around a component: none on the page. */
export const StopsContext = context<Stops | null>(null);

/** The stop that has the focus now, among those that say so. */
let held: Stop | null = null;

/**
 * Says a field or a control can take the focus. Called as its component renders, with what gives
 * its element, it answers the two handlers to set on that element:
 *
 *     let field: InputRef | undefined;
 *     const stop = focusStop(() => field);
 *     <Input ref={(node) => (field = node)} onFocus={stop.onFocus} onBlur={stop.onBlur} />
 *
 * In an overlay, the one that says `first` takes the focus as the overlay opens, the first made
 * without one.
 */
export function focusStop(node: () => Focusable | undefined, options?: { first?: boolean }) {
  const stop: Stop = { isFirst: options?.first === true, isThere: true, node };
  const stops = StopsContext();
  stops?.push(stop);
  cleanup(() => {
    stop.isThere = false;
    if (held === stop) {
      held = null;
    }
    stops?.splice(stops.indexOf(stop), 1);
  });
  return {
    onBlur: () => {
      if (held === stop) {
        held = null;
      }
    },
    onFocus: () => {
      held = stop;
    },
  };
}

/**
 * Takes the focus from the page for an overlay that opens: a field that was typed in stops
 * taking the keys. It answers what gives the focus back as the overlay closes: the overlay's own
 * field stops taking the keys at once, while it is still drawn for its way out, and the focus
 * returns where it was. Unless who closed it sent the focus elsewhere meanwhile: it stays there.
 */
export function takeFocus(stops: Stops): () => void {
  const before = held;
  Keyboard.dismiss();
  return () => {
    if (held !== null && !stops.includes(held)) {
      return;
    }
    Keyboard.dismiss();
    if (before !== null && before.isThere) {
      before.node()?.focus();
    }
  };
}

/** Puts the focus on an overlay's first stop, if it has one. */
export function focusFirst(stops: Stops) {
  (stops.find((stop) => stop.isFirst) ?? stops[0])?.node()?.focus();
}

/** Moves the focus to the overlay's next stop, or the one before, around from the last. */
export function focusNext(stops: Stops, back: boolean) {
  if (stops.length === 0) {
    return;
  }
  const at = held === null ? -1 : stops.indexOf(held);
  const next = at === -1 ? (back ? stops.length - 1 : 0) : at + (back ? -1 : 1);
  stops[(next + stops.length) % stops.length]?.node()?.focus();
}
