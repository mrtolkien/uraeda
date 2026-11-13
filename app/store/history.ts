// The app's history: the visits of its pages, the one shown as signals, what each keeps for Back,
// and the question asked before a page with unsaved text is left. It calls no browser API: the
// visits live in a `HistoryAdapter`, the app's own stack unless another is bound, as the web build
// binds the browser's.
import { type Accessor, batch, signal } from "nsh";
import { parseRoute, pathOf, type Route } from "./routes";
import type { Json, Layout } from "../ui/layout/layout";
import { interaction } from "../ui/timing";

/**
 * What a visit keeps for its page, so Back draws it as it was left. A page that keeps something
 * else adds its line here.
 */
export type Kept = {
  /** The count of rows a session's Activity draws. */
  readonly activity?: number;
  /** A session its first message just created, on the page it left: its first turn is news. */
  readonly created?: boolean;
  /** The panes' layout, as the human left it in this visit: the layout shell's. */
  readonly layout?: Layout;
  /** What each pane remembers, by the pane's key: its selection, its open folds (`usePane`). */
  readonly panes?: Readonly<Record<string, Readonly<Record<string, Json>>>>;
  /** What takes the focus on arrival: a file's text, as a proposal file just made opens. */
  readonly focus?: "text";
  /**
   * What the New page's composer is filled from on arrival: a proposal's id, `line:next-2`, or
   * `setup`, the message that sets the project up.
   */
  readonly insert?: string;
  /** The folds opened in the page. */
  readonly open?: ReadonlyArray<string>;
  /** The overlay this visit was opened for, by its label: Back closes it. */
  readonly overlay?: string;
  /** The row a list selects on arrival, with the focus, by its key. */
  readonly select?: string;
  /** The count of messages a session's transcript draws. */
  readonly shown?: number;
};

/** One visit of a page: a new one each time a page opens, at its own address too. */
export type Entry = {
  /** The page it was opened from, by `navigate`: none for the visit the app started on. */
  readonly from?: Route;
  readonly id: string;
  readonly kept: Kept;
  /** Where what scrolls in the page was last at rest, by name. */
  readonly positions: Readonly<Record<string, number>>;
  readonly route: Route;
};

/**
 * Where the visits live. The history tells it every visit it opens and every change of the one
 * shown, and asks it to go back; it tells the history each visit it moves to, by the history's
 * `back` or by a button of its own, like a browser's Back and Forward. An entry is plain data,
 * which a browser's history state can hold, and `pathOf(entry.route)` is its address.
 */
export type HistoryAdapter = {
  /** Moves to the visit before, and tells `listen`'s function, now or later. */
  back(): void;
  /** Sets what hears each visit the adapter moves to. */
  listen(arrive: (entry: Entry) => void): void;
  /** Adds a visit after the one shown, in place of any after it. */
  push(entry: Entry): void;
  /** Puts `entry` in place of the visit shown. */
  replace(entry: Entry): void;
  /** The visit the app starts on: `entryAt` its address, or the entry kept there. */
  start(): Entry;
};

/**
 * What asks before a page is left: `undefined` when leaving loses nothing, else the question,
 * resolving with whether to leave.
 */
export type LeaveGuard = () => Promise<boolean> | undefined;

let ids = 0;
/** An id no other visit has, in this run or one before it. */
function newId(): string {
  ids += 1;
  return `${Date.now().toString(36)}-${ids}`;
}

/** A first visit of the page at `address`, as the app starts on it. */
export function entryAt(address: string): Entry {
  return { id: newId(), kept: {}, positions: {}, route: parseRoute(address) };
}

/** The app's own stack of visits, from `start`: what the history uses where no browser holds one. */
export function memoryHistory(start: Entry): HistoryAdapter {
  const stack = [start];
  let tell: ((visit: Entry) => void) | undefined;
  return {
    back() {
      if (stack.length > 1) {
        stack.pop();
        tell?.(stack[stack.length - 1]);
      }
    },
    listen(heard) {
      tell = heard;
    },
    push(visit) {
      stack.push(visit);
    },
    replace(visit) {
      stack[stack.length - 1] = visit;
    },
    start: () => stack[stack.length - 1],
  };
}

let adapter = memoryHistory(entryAt("/"));
/** The visit shown, with what it kept since it was last told to who reads `entry`. */
let current = adapter.start();
const shownRoute = signal(current.route);
const shownEntry = signal(current);
let guard: LeaveGuard | undefined;
/** Set once the human chose to leave by Back: the Back that leaves is not asked about again. */
let leaving = false;
/**
 * The Backs asked of the adapter to close a sheet, whose visit the app already shows: a browser's
 * Back lands on a later tick, and a visit pushed meanwhile would be the one it leaves. Until each
 * lands, what the app asks of the adapter waits in `after`, in order.
 */
let closing = 0;
const after: Array<() => void> = [];
/** The overlay each open one was opened over, by its label: shown again as it closes. */
const beneath = new Map<string, string | undefined>();
// The app's own stack hears its moves as a bound one does: unbound, a Back popped a visit and
// showed nothing, so `b` and Back did nothing anywhere the app keeps its own visits.
adapter.listen(arrive);

/** The route of the page shown: a signal, written by `navigate`, `redirect`, and `back` only. */
export const route: Accessor<Route> = shownRoute;

/**
 * The visit shown. Who reads it is told when the app moves to another visit and when `keep`
 * changes this one, not when a position is kept.
 */
export function entry(): Entry {
  shownEntry();
  return current;
}

/** Shows `next`, a visit the adapter already holds. */
function show(next: Entry) {
  current = next;
  batch(() => {
    shownRoute.set(next.route);
    shownEntry.set(next);
  });
}

/** Runs `write` on the adapter now, or once the sheets' Backs asked before it have landed. */
function toAdapter(write: () => void) {
  if (closing > 0) after.push(write);
  else write();
}

/** Changes the visit shown, in the adapter too. */
function change(next: Entry) {
  toAdapter(() => adapter.replace(next));
  show(next);
}

/** `to`, in the repository of the page shown unless it names one. */
function here(to: Route): Route {
  const { repo } = current.route;
  return to.repo === undefined && repo !== undefined ? { ...to, repo } : to;
}

/** The pages whose pane shows another item beside the same list: the text left unsaved comes back. */
const BESIDE_LIST: ReadonlySet<Route["page"]> = new Set(["proposal", "note", "git"]);

/**
 * Whether going from `from` to `to` stays on a page, so nothing is asked: another item beside the
 * same list, or the same address but for its hash, as a block of the page or an overlay over it.
 */
function staysOnPage(from: Route, to: Route): boolean {
  if (from.page === to.page && BESIDE_LIST.has(to.page)) {
    return true;
  }
  return pathOf({ ...from, hash: undefined }) === pathOf({ ...to, hash: undefined });
}

/** Sets what `navigate` and `back` ask before leaving the page; `redirect` never asks. */
export function setLeaveGuard(next: LeaveGuard | undefined) {
  guard = next;
}

/**
 * Uses `next` for the app's visits, and shows the one it starts on. Its address is written again
 * from its route, so one from before a page moved becomes the page's address now.
 */
export function bindHistory(next: HistoryAdapter) {
  adapter = next;
  leaving = false;
  closing = 0;
  after.length = 0;
  beneath.clear();
  adapter.listen(arrive);
  change(adapter.start());
}

/** A visit the adapter moved to: by `back`, or by a button of its own. */
function arrive(reached: Entry) {
  if (closing > 0) {
    // A sheet's Back, whose visit is shown already: what waited for it reaches the adapter.
    closing -= 1;
    // A write may be a sheet's Back again, which holds the rest.
    for (
      let write = after.shift();
      write !== undefined;
      write = closing === 0 ? after.shift() : undefined
    ) {
      write();
    }
    return;
  }
  // The same visit is an overlay closing over its page.
  const stays = reached.id === current.id || staysOnPage(current.route, reached.route);
  const asking = leaving || stays ? undefined : guard?.();
  leaving = false;
  if (!asking) {
    show(reached);
    return;
  }
  // The visit left comes back above the one reached, and stays shown while the human is asked.
  adapter.push(current);
  void asking.then((leave) => {
    if (leave) {
      toAdapter(() => {
        leaving = true;
        adapter.back();
      });
    }
  });
}

/**
 * Opens `to` in a visit of its own, after the one shown: in place of an overlay's visit, as a
 * sheet's action opens a page, so Back from that page returns to the one under the sheet.
 */
function open(to: Route, kept: Kept) {
  const next: Entry = { from: current.route, id: newId(), kept, positions: {}, route: to };
  const over = current.kept.overlay !== undefined;
  toAdapter(() => (over ? adapter.replace(next) : adapter.push(next)));
  show(next);
}

/**
 * Opens a page, in the repository of the one shown unless `to` names one, with what its visit
 * starts with. A page that holds unsaved text asks first, and stays if the human does, unless the
 * navigation stays on the page.
 */
export function navigate(to: Route, kept: Kept = {}) {
  const next = here(to);
  interaction(`open ${pathOf(next)}`);
  const asking = staysOnPage(current.route, next) ? undefined : guard?.();
  if (!asking) {
    open(next, kept);
    return;
  }
  void asking.then((leave) => {
    if (leave) {
      open(next, kept);
    }
  });
}

/**
 * Shows another page in place of the one shown, in the same visit, like a page whose file was
 * renamed: Back does not return to the address that no longer exists. It never asks.
 */
export function redirect(to: Route) {
  change({ ...current, route: here(to) });
}

/**
 * Goes back to the visit before, if the app opened this one from a page of its own: `false`
 * otherwise, for the caller to open the page above instead. A page that holds unsaved text asks
 * first, as for `navigate`.
 */
export function back(): boolean {
  if (current.from === undefined && current.kept.overlay === undefined) {
    return false;
  }
  toAdapter(() => adapter.back());
  return true;
}

/**
 * Opens the overlay `label` over the page, in a visit of its own that keeps the page's, so Back
 * closes it: at `to`, an address of the same page that names it, like a sheet a reload keeps, or
 * at the page's own. The page reads `entry().kept.overlay`.
 */
export function openOverlay(label: string, to: Route = current.route) {
  const next: Entry = { ...current, kept: { ...current.kept, overlay: label }, route: here(to) };
  beneath.set(label, current.kept.overlay);
  toAdapter(() => adapter.push(next));
  show(next);
}

/**
 * Closes the overlay `label` if its visit is shown: the visit under it is shown at once, with
 * what the overlay's kept since, and the adapter goes back to it.
 */
export function closeOverlay(label: string) {
  if (current.kept.overlay !== label) return;
  const { overlay: _closed, ...kept } = current.kept;
  const under = beneath.get(label);
  beneath.delete(label);
  const page: Entry = {
    ...current,
    kept: under === undefined ? kept : { ...kept, overlay: under },
  };
  toAdapter(() => {
    closing += 1;
    adapter.back();
  });
  toAdapter(() => adapter.replace(page));
  show(page);
}

/**
 * Merges `values` into what the visit shown keeps. With `id`, only while that visit is still the
 * one shown: a write answered after the human left names its row for the page it was made on.
 */
export function keep(values: Kept, id: string = current.id) {
  if (id === current.id) {
    change({ ...current, kept: { ...current.kept, ...values } });
  }
}

/**
 * The positions of the visit shown, for the page drawn on it: `at` reads where a scroller was left,
 * to start there, and `keep` writes where it came to rest. Once the app shows another visit both
 * do nothing: a page still drawn while the next one loads writes nothing into the next one's.
 */
export function positions(): {
  at(name: string): number | undefined;
  keep(name: string, offset: number): void;
} {
  const { id } = current;
  return {
    at: (name) => (current.id === id ? current.positions[name] : undefined),
    keep(name, offset) {
      if (current.id === id) {
        current = { ...current, positions: { ...current.positions, [name]: offset } };
        const kept = current;
        toAdapter(() => adapter.replace(kept));
      }
    },
  };
}

/** The visits a sheet on a phone opens, so Back closes it: for `bindVisits` of `ui/surfaces`. */
export const overlayVisits = {
  close: closeOverlay,
  open: (label: string) => openOverlay(label),
  shown: () => entry().kept.overlay,
};
