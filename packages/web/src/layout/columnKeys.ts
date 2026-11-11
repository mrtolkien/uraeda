// The keys that cross into a page's right column and back, as `h` `l` cross a list's columns
// (`lists/useListKeys.ts`), declared in the key registry: `l` or `→` moves the focus from the page
// into the column, unfolding it first, onto its first stop; `h` or `←` gives it back to where it
// was. In the column, `j` `k` and `↓` `↑` move from stop to stop, and `k` past the first reaches
// the tabs, where `h` `l` open the previous and the next one, as the strip's own arrows move along
// it. A stop is whatever the open panel and the column's foot hold that takes the focus: a row's
// link or button, whatever the row looks like, and a part that scrolls with no row in it, which
// `j` `k` scroll, through the registry's fallback, before they leave it. Enter is the stop's own: a
// link opens, a button presses.
import { flushSync } from "react-dom";
import { type Binding, useKeys } from "../keys/registry.tsx";

/** What a row is, whatever it looks like: a link or a control. */
const ROW = 'a[href], button, input, select, textarea, summary, [role="button"]';

/** What may be a stop: a row, or a part that takes the focus to scroll. */
const STOP = `${ROW}, [tabindex="0"]`;

/** What is never a stop: the tabs, a control that is off, an edge that resizes, what is hidden. */
const NOT_STOP =
  ':disabled, [aria-disabled="true"], [role="separator"], [tabindex="-1"], [aria-hidden="true"]';

/** What takes the arrows itself, in the page: there `→` is its own, and `l` alone enters the column. */
const OWN_ARROWS =
  'input, select, [role="radio"], [role="slider"], [role="tab"], [role="menuitem"], [role="option"]';

/** The column's landmark around `inside`, as `SideColumn` draws it. */
const columnOf = (inside: Element | null) => inside?.closest('[role="complementary"]') ?? null;

/** The tab `target` is on, if any. */
const tabOf = (target: Element) => target.closest<HTMLElement>('[role="tab"]');

/**
 * The stops of `column`, in the order they are drawn: its rows, and its parts that scroll and hold
 * no stop.
 */
export function stopsOf(column: Element): Array<HTMLElement> {
  const shown = [...column.querySelectorAll<HTMLElement>(STOP)].filter(
    (stop) =>
      !stop.matches(NOT_STOP) &&
      stop.closest('[role="tablist"], [hidden], [inert]') === null &&
      tabOf(stop) === null,
  );
  // A part that holds a stop is none: its rows are, or the part in it that scrolls.
  return shown.filter(
    (stop) => stop.matches(ROW) || !shown.some((other) => other !== stop && stop.contains(other)),
  );
}

/** Whether `stop`, a part that scrolls, has more to show `down` or up. */
function scrollsOn(stop: HTMLElement, down: boolean) {
  if (stop.matches(ROW)) {
    return false;
  }
  return down ? stop.scrollTop + stop.clientHeight < stop.scrollHeight - 1 : stop.scrollTop > 0;
}

/** The stop after `target` among `stops`, or before it: none at either end. */
function beside(stops: ReadonlyArray<HTMLElement>, target: Element, down: boolean) {
  const { DOCUMENT_POSITION_CONTAINS, DOCUMENT_POSITION_FOLLOWING, DOCUMENT_POSITION_PRECEDING } =
    Node;
  if (down) {
    return stops.find(
      (stop) => (target.compareDocumentPosition(stop) & DOCUMENT_POSITION_FOLLOWING) !== 0,
    );
  }
  return stops.findLast((stop) => {
    const place = target.compareDocumentPosition(stop);
    return (
      (place & DOCUMENT_POSITION_PRECEDING) !== 0 && (place & DOCUMENT_POSITION_CONTAINS) === 0
    );
  });
}

/**
 * Where the focus was as the keys entered the column, which `h` gives it back to: one for the
 * window, as its focus is.
 */
const from: { current: HTMLElement | null } = { current: null };

/** Keeps where the focus is, as the keys enter the column. */
function remember() {
  const active = document.activeElement;
  from.current = active === null || active === document.body ? null : (active as HTMLElement);
}

/** Gives the focus back to where it was, or to the page itself where that is gone. */
function leave() {
  const back = from.current;
  from.current = null;
  if (back !== null && back.isConnected) {
    back.focus();
  } else {
    (document.activeElement as HTMLElement | null)?.blur();
  }
}

/** What the column's keys read and call: `DocumentColumn`'s tabs and fold. */
type Column = {
  /** The tab's element of the panel `key`, while the column is shown. */
  elementOf: (key: string) => HTMLElement | null;
  isShown: boolean;
  /** The panels' keys, in the tabs' order. */
  keys: ReadonlyArray<string>;
  /** The open panel's key. */
  open: string;
  setOpen: (key: string) => void;
  setShown: (shown: boolean) => void;
};

/** The keys' labels, as the key map lists them, each pair's first key naming the status line's hint. */
const LABELS = {
  down: "next row of the column",
  left: "back from the column, or its previous tab",
  right: "into the column, or its next tab",
  up: "previous row of the column",
};

/** The bindings of a column whose keys do `acts`. */
function bindingsOf(acts: {
  cross: (event: KeyboardEvent, right: boolean) => false | void;
  move: (event: KeyboardEvent, down: boolean) => false | void;
}): ReadonlyArray<Binding> {
  const cross = (keys: string, right: boolean): Binding => ({
    keys,
    label: right ? LABELS.right : LABELS.left,
    run: (event) => acts.cross(event, right),
  });
  const move = (keys: string, down: boolean): Binding => ({
    keys,
    label: down ? LABELS.down : LABELS.up,
    run: (event) => acts.move(event, down),
  });
  return [
    { ...cross("l", true), hint: "h l", hintLabel: "column" },
    cross("ArrowRight", true),
    cross("h", false),
    cross("ArrowLeft", false),
    move("j", true),
    move("ArrowDown", true),
    move("k", false),
    move("ArrowUp", false),
  ];
}

/**
 * Declares the column's keys while `isOn`, where the column is drawn beside its page: see the
 * file's head. A key pressed outside the column is left to the page, but `l`, which enters it.
 */
export function useColumnKeys(isOn: boolean, column: Column) {
  const { elementOf, isShown, keys, open, setOpen, setShown } = column;
  const landmark = () => columnOf(elementOf(open));
  const enter = () => {
    const place = landmark();
    (place === null ? undefined : (stopsOf(place)[0] ?? elementOf(open)))?.focus();
  };
  /** Opens the tab beside `tab`, keeping the focus on the strip: whether there was one. */
  const toTab = (tab: HTMLElement, right: boolean) => {
    const next = keys[keys.findIndex((key) => elementOf(key) === tab) + (right ? 1 : -1)];
    if (next === undefined) {
      return false;
    }
    setOpen(next);
    elementOf(next)?.focus();
    return true;
  };
  const cross = (event: KeyboardEvent, right: boolean) => {
    const target = event.target as Element;
    if (landmark()?.contains(target) !== true) {
      if (!right || (event.key === "ArrowRight" && target.closest(OWN_ARROWS) !== null)) {
        return false;
      }
      remember();
      if (!isShown) {
        // Drawn before the focus moves into it.
        flushSync(() => setShown(true));
      }
      enter();
      return;
    }
    const tab = tabOf(target);
    if (tab !== null && toTab(tab, right)) {
      return;
    }
    // Past the first tab, and from any row, `h` is back to the page; `l` has nowhere further.
    return right ? false : leave();
  };
  const move = (event: KeyboardEvent, down: boolean) => {
    const target = event.target as HTMLElement;
    const place = landmark();
    if (place?.contains(target) !== true) {
      return false;
    }
    const stops = stopsOf(place);
    if (tabOf(target) !== null) {
      return down && stops[0] !== undefined ? stops[0].focus() : false;
    }
    if (stops.includes(target) && scrollsOn(target, down)) {
      return false;
    }
    // Up past the first stop are the tabs; down past the last, the part goes on scrolling.
    const next = beside(stops, target, down) ?? (down ? undefined : elementOf(open));
    return next === undefined || next === null ? false : next.focus();
  };
  useKeys(isOn ? bindingsOf({ cross, move }) : []);
}
