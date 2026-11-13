// Where the keyboard focus is, and where it goes back to. Native Shell says when a view takes or
// loses the focus, never which view has it, so what can take it says so here: a field or a
// control spreads `focusStop` on its element. An overlay then puts the focus in itself as it
// opens, gives it back where it was as it closes, and a dialog keeps Tab among its own stops. A
// pane has stops of its own (`paneStops`), which Tab goes through while it has the keys: there
// the control with the focus takes Enter, and Escape, or any key of the pane's, gives the pane its
// keys back (`app/ui/keys/registry.tsx`).
import { type Accessor, cleanup, context, Keyboard, signal, untracked } from "nsh";

/** What takes the keyboard focus: a field, or a view that takes presses; a field gives it up. */
export type Focusable = { focus(): void; blur?(): void };

type Stop = {
  isThere: boolean;
  /** The stops it is one of: its overlay's, its pane's, or none. */
  list: Stops | null;
  isFirst: boolean;
  node: () => Focusable | undefined;
  /** A disabled control takes no focus: Tab passes it. */
  isDisabled: () => boolean;
  /** What Enter or Space does on it, for a control: a field has none. */
  press?: () => void;
  /** What Escape does in it, for a field: Vim's first, then the field's. */
  escape?: () => void;
};

/** The stops of one overlay, in the order they were made, which is the order Tab goes through. */
export type Stops = Array<Stop>;

/** The stops of the overlay or the pane around a component: none elsewhere. */
export const StopsContext = context<Stops | null>(null);

/** The lists of the panes' stops, which the page's Tab goes through: an overlay's is not one. */
const panes = new WeakSet<Stops>();

/** A pane's stops, which Tab goes through while the pane has the keys (`app/ui/layout/Stack.tsx`). */
export function paneStops(): Stops {
  const stops: Stops = [];
  panes.add(stops);
  return stops;
}

/**
 * The stop that has the focus now, among those that say so. A signal: on GTK a control never has
 * the platform's focus, so it draws its focus from here.
 */
const holder = signal<Stop | null>(null);
const heldNow = () => untracked(holder);

/**
 * When a field went with the focus last, or an overlay closed that the page's keys had before it,
 * and when a focus was asked.
 */
let closedAt = 0;
let askedAt = 0;

/** How long after an overlay closes a field's focus that nobody asked for is GTK's own. */
const STRAY = 500;

/** Says the app asks a field for the focus: a ref's `focus`, never GTK's choice. */
export const focusAsked = () => {
  askedAt = Date.now();
};

/**
 * Whether a focus that just came is GTK's: as a field goes with the focus, an overlay's or a
 * comment's once saved, GTK gives it to the window's next field, the page's first, which then took
 * every key typed after it, while the page's keys should have had them. Unasked, it is given back
 * at once.
 */
const stray = () => askedAt < closedAt && Date.now() - closedAt < STRAY;

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
 * since on GTK a view never takes the platform's focus. A field says what Escape does in it,
 * `escape`, which an overlay gives it first (`escapeHeld`).
 */
export function focusStop(
  node: () => Focusable | undefined,
  options?: {
    disabled?: () => boolean;
    escape?: () => void;
    first?: boolean;
    press?: () => void;
  },
) {
  const stop: Stop = {
    escape: options?.escape,
    isDisabled: options?.disabled ?? (() => false),
    isFirst: options?.first === true,
    isThere: true,
    list: StopsContext(),
    node,
    press: options?.press,
  };
  const stops = stop.list;
  stops?.push(stop);
  cleanup(() => {
    stop.isThere = false;
    if (heldNow() === stop) {
      holder.set(null);
      // Removed with the focus, as a comment's field once saved: GTK gives it to the next field.
      closedAt = Date.now();
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
    onFocus: () => {
      if (stray()) {
        node()?.blur?.();
        return;
      }
      holder.set(stop);
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
  const before = heldNow();
  Keyboard.dismiss();
  return () => {
    const held = heldNow();
    if (held !== null && !stops.includes(held)) {
      return;
    }
    Keyboard.dismiss();
    if (before === null) closedAt = Date.now();
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
  const to = open[(next + open.length) % open.length];
  if (to === undefined || to === held) {
    return;
  }
  // A field left by Tab lets go of the keys, and the move is asked, never GTK's stray one.
  held?.node()?.blur?.();
  focusAsked();
  to.node()?.focus();
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

/**
 * Gives Escape to the field among `stops` that has the focus, as its own Escape: Vim's first,
 * then the field's, which is the overlay's own Escape once Vim is done with it. Says whether a
 * field took it.
 *
 * Native Shell binds an overlay's `onCancel` after every view's binding
 * (`nsh-core/src/core/overlay.rs`, `overlay_key_binding`, chained last in `keymap()`), so it wins
 * over the field's own Escape: the overlay hands the key back here. Still so in 0.5.0. Upstream
 * report: ruling R197.
 */
export function escapeHeld(stops: Stops): boolean {
  const held = heldNow();
  if (held === null || !stops.includes(held) || held.escape === undefined) {
    return false;
  }
  held.escape();
  return true;
}

/** The control of a pane that has the focus, where Tab or a press put it: none in a field. */
const paneControl = (held: Stop | null = heldNow()): Stop | null => {
  return held !== null && held.list !== null && panes.has(held.list) && held.press !== undefined
    ? held
    : null;
};

/** Whether a pane's control has the focus, read as a signal: Enter and Escape are then its. */
export const paneControlFocused = () => paneControl(holder()) !== null;

/**
 * Presses the pane's control that has the focus, as Enter on it, before the pane's own Enter: the
 * key goes where the ring is. Says whether one was pressed.
 */
export function pressFocused(): boolean {
  const held = paneControl();
  if (held === null || held.isDisabled()) {
    return false;
  }
  held.press?.();
  return true;
}

/**
 * Takes the focus off the pane's control that has it, so the pane's keys act again: Escape, or a
 * key of the pane's. Says whether one had it.
 */
export function releaseFocused(): boolean {
  const held = paneControl();
  if (held === null) {
    return false;
  }
  held.node()?.blur?.();
  holder.set(null);
  return true;
}

/**
 * Says the pane whose stops are `stops` no longer has the keys, as a press in another pane gives
 * them there: its control lets go of the focus, so Enter goes to the pane that has the keys, never
 * to a ring in one that has not.
 */
export function paneLeft(stops: Stops) {
  const held = paneControl();
  if (held !== null && held.list === stops) releaseFocused();
}
