// Where the keyboard focus is, and where it goes back to. Native Shell says when a view takes or
// loses the focus, never which view has it, so what can take it says so here: a field or a
// control spreads `focusStop` on its element. An overlay then puts the focus in itself as it
// opens, gives it back where it was as it closes, and a dialog keeps Tab among its own stops.
import { type Accessor, cleanup, context, Keyboard, signal, untracked } from "nsh";

/** What takes the keyboard focus: a field, or a view that takes presses. */
export type Focusable = { focus(): void };

type Stop = {
  isThere: boolean;
  isFirst: boolean;
  node: () => Focusable | undefined;
  /** A disabled control takes no focus: Tab passes it. */
  isDisabled: () => boolean;
  /** What Enter or Space does on it, for a control: a field has none. */
  press?: () => void;
};

/** The stops of one overlay, in the order they were made, which is the order Tab goes through. */
export type Stops = Array<Stop>;

/** The stops of the overlay around a component: none on the page. */
export const StopsContext = context<Stops | null>(null);

/**
 * The stop that has the focus now, among those that say so. A signal: on GTK a control never has
 * the platform's focus, so it draws its focus from here.
 */
const holder = signal<Stop | null>(null);
const heldNow = () => untracked(holder);

/**
 * Says a field or a control can take the focus. Called as its component renders, with what gives
 * its element, it answers the two handlers to set on that element:
 *
 *     let field: InputRef | undefined;
 *     const stop = focusStop(() => field);
 *     <Input ref={(node) => (field = node)} onFocus={stop.onFocus} onBlur={stop.onBlur} />
 *
 * In an overlay, the one that says `first` takes the focus as the overlay opens, the first made
 * without one. A control (`app/ui/controls/press.ts`) also says what Enter and Space do on it,
 * `press`, and when it is `disabled`, which Tab then passes; its `focus()` calls `onFocus` itself,
 * since on GTK a view never takes the platform's focus.
 */
export function focusStop(
  node: () => Focusable | undefined,
  options?: { disabled?: () => boolean; first?: boolean; press?: () => void },
) {
  const stop: Stop = {
    isDisabled: options?.disabled ?? (() => false),
    isFirst: options?.first === true,
    isThere: true,
    node,
    press: options?.press,
  };
  const stops = StopsContext();
  stops?.push(stop);
  cleanup(() => {
    stop.isThere = false;
    if (heldNow() === stop) {
      holder.set(null);
    }
    stops?.splice(stops.indexOf(stop), 1);
  });
  return {
    /** Whether it has the focus now, read as a signal. */
    focused: (() => holder() === stop) as Accessor<boolean>,
    onBlur: () => {
      if (heldNow() === stop) {
        holder.set(null);
      }
    },
    onFocus: () => holder.set(stop),
  };
}

/**
 * Takes the focus from the page for an overlay that opens: a field that was typed in stops
 * taking the keys. It answers what gives the focus back as the overlay closes: the overlay's own
 * field stops taking the keys at once, while it is still drawn for its way out, and the focus
 * returns where it was. Unless who closed it sent the focus elsewhere meanwhile: it stays there.
 */
export function takeFocus(stops: Stops): () => void {
  const before = heldNow();
  Keyboard.dismiss();
  return () => {
    const held = heldNow();
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
  const open = stops.filter((stop) => !stop.isDisabled());
  (open.find((stop) => stop.isFirst) ?? open[0])?.node()?.focus();
}

/** Moves the focus to the overlay's next stop, or the one before, around from the last. */
export function focusNext(stops: Stops, back: boolean) {
  const held = heldNow();
  const open = stops.filter((stop) => stop === held || !stop.isDisabled());
  if (open.length === 0) {
    return;
  }
  const at = held === null ? -1 : open.indexOf(held);
  const next = at === -1 ? (back ? open.length - 1 : 0) : at + (back ? -1 : 1);
  open[(next + open.length) % open.length]?.node()?.focus();
}

/**
 * Presses the control among `stops` that has the focus, as Enter or Space on it: what a platform
 * does for a focused view where it has one, and GTK does not. Says whether one was pressed.
 */
export function pressHeld(stops: Stops): boolean {
  const held = heldNow();
  if (held === null || !stops.includes(held) || held.press === undefined || held.isDisabled()) {
    return false;
  }
  held.press();
  return true;
}
