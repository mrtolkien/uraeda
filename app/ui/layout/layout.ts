// The layout: which panes the window shows, in two stacks, and where the keys go. It is plain data,
// which a visit keeps, and every change of it is a pure function here: the shell draws a layout,
// and its keys, its tabs, and its folds call these.
//
// - A pane is a kind and its arguments, named by its key: two panes of one key are one pane.
// - A stack is an ordered list of panes, shown as tabs, one at a time, or split, all at once.
// - There are two stacks: `main`, the centre, which always holds a pane, and `side`, at the right,
//   which folds away. On a narrow window both are one stack of tabs (`narrowed`).
// - Exactly one pane has the focus, and is shown. On a stack of tabs the focus may sit on the
//   tabs themselves (`onTabs`), where `h` `l` change the tab.

/** A value a pane's arguments may hold: plain data, so a visit and the device can keep it. */
export type Json = string | number | boolean | null;

/** One pane: its kind, its arguments, and the key they make, as `definePane`'s factory gives it. */
export type PaneRef = {
  readonly args: Readonly<Record<string, Json>>;
  /** Whether the human may close it: a place's subject may not. */
  readonly closes: boolean;
  /** `kind` and `args`, in one string: equal for two equal panes. */
  readonly key: string;
  readonly kind: string;
};

export type StackName = "main" | "side";

export type Stack = {
  readonly panes: ReadonlyArray<PaneRef>;
  /** The key of the pane shown as tabs, `null` only in an empty stack. */
  readonly shown: string | null;
  /** All its panes at once, one under the other, in place of tabs. */
  readonly split: boolean;
};

export type Layout = {
  /** Panes the human closed in this visit: a place's panes come back without them. */
  readonly closed: ReadonlyArray<string>;
  /** The key of the pane the keys go to. */
  readonly focus: string | null;
  /** The side stack is folded away. */
  readonly folded: boolean;
  readonly main: Stack;
  /** The focus is on the tabs of the focused pane's stack, not in the pane. */
  readonly onTabs: boolean;
  readonly side: Stack;
  /** The key of the pane drawn over the whole room of both stacks. */
  readonly zoomed: string | null;
};

/** The panes a place shows, by their default stacks, in order. */
export type Place = {
  readonly main: ReadonlyArray<PaneRef>;
  readonly side: ReadonlyArray<PaneRef>;
  /** The stacks that show their panes split, all at once, until the human makes them tabs. */
  readonly split?: ReadonlyArray<StackName>;
};

const STACKS: ReadonlyArray<StackName> = ["main", "side"];

export const other = (name: StackName): StackName => (name === "main" ? "side" : "main");

/** The key of a kind and its arguments: the arguments' names sorted, so their order is no matter. */
export function paneKey(kind: string, args: Readonly<Record<string, Json>>): string {
  const sorted = Object.keys(args)
    .toSorted()
    .filter((name) => args[name] !== undefined)
    .map((name) => [name, args[name]]);
  return sorted.length === 0 ? kind : `${kind}:${JSON.stringify(sorted)}`;
}

const stackOfPanes = (
  panes: ReadonlyArray<PaneRef>,
  shown?: string | null,
  splits = false,
): Stack => ({
  panes,
  shown: panes.some((pane) => pane.key === shown) ? (shown ?? null) : (panes[0]?.key ?? null),
  split: splits,
});

/** The place's default layout: each stack's first pane shown, the main one's focused. */
export function layoutOf(place: Place, folded = false): Layout {
  const main = stackOfPanes(place.main, null, place.split?.includes("main"));
  return {
    closed: [],
    focus: main.shown,
    folded,
    main,
    onTabs: false,
    side: stackOfPanes(place.side, null, place.split?.includes("side")),
    zoomed: null,
  };
}

/** The place's default again, the side stack folded as it was: what "reset" gives. */
export const reset = (layout: Layout, place: Place): Layout => layoutOf(place, layout.folded);

/** The stack a pane is in, `null` when the layout has no such pane. */
export function stackOf(layout: Layout, key: string): StackName | null {
  return STACKS.find((name) => layout[name].panes.some((pane) => pane.key === key)) ?? null;
}

/** The stack the focus is in. */
export const focusedStack = (layout: Layout): StackName =>
  (layout.focus === null ? null : stackOf(layout, layout.focus)) ?? "main";

/** Whether a pane is drawn now: its stack shows it, and the side stack is not folded away. */
export function isShown(layout: Layout, key: string): boolean {
  const name = stackOf(layout, key);
  if (name === null || (name === "side" && layout.folded)) {
    return false;
  }
  if (layout.zoomed !== null) {
    return layout.zoomed === key;
  }
  return layout[name].split || layout[name].shown === key;
}

/** Puts the focus on a pane, showing it, unfolding its stack, and ending a zoom of another. */
export function focus(layout: Layout, key: string): Layout {
  const name = stackOf(layout, key);
  if (name === null) {
    return layout;
  }
  return {
    ...layout,
    focus: key,
    folded: name === "side" ? false : layout.folded,
    onTabs: false,
    [name]: { ...layout[name], shown: key },
    zoomed: layout.zoomed === key ? key : null,
  };
}

/**
 * Shows a pane's tab in its stack. The focus follows when it was in that stack, as a tab pressed
 * there is where the human now looks; it stays on the tabs if it was there.
 */
export function show(layout: Layout, key: string): Layout {
  const name = stackOf(layout, key);
  if (name === null) {
    return layout;
  }
  if (focusedStack(layout) === name) {
    return { ...focus(layout, key), onTabs: layout.onTabs };
  }
  return { ...layout, [name]: { ...layout[name], shown: key } };
}

/** The focus in the other stack, on the pane it shows: `h` and `l`. Unchanged when it is empty. */
export function cross(layout: Layout, to: StackName): Layout {
  const target = layout[to].shown;
  if (target === null || focusedStack(layout) === to) {
    return layout;
  }
  return focus(layout, target);
}

/** The pane next to `key` in its stack, by `by` places: `null` past either end. */
export function beside(layout: Layout, key: string, by: number): string | null {
  const name = stackOf(layout, key);
  if (name === null) {
    return null;
  }
  const panes = layout[name].panes;
  const at = panes.findIndex((pane) => pane.key === key) + by;
  return panes[at]?.key ?? null;
}

/**
 * The focus on the next tab, `by` places along the focused stack, or along the one stack of a
 * narrow window: `null` past either end, where the keys cross to the other stack instead.
 */
export function step(layout: Layout, by: number, narrow = false): Layout | null {
  const panes = narrow ? narrowed(layout).panes : layout[focusedStack(layout)].panes;
  const next = panes[panes.findIndex((pane) => pane.key === layout.focus) + by];
  return next === undefined ? null : { ...focus(layout, next.key), onTabs: layout.onTabs };
}

/** The focus on the tabs of its stack, or back in the pane. */
export const toTabs = (layout: Layout, on: boolean): Layout => ({ ...layout, onTabs: on });

/**
 * Who takes the focus when `key` leaves its stack: the tab after it, else the one before, else the
 * pane the other stack shows.
 */
export function neighbour(layout: Layout, key: string): string | null {
  const name = stackOf(layout, key);
  if (name === null) {
    return layout.focus;
  }
  return beside(layout, key, 1) ?? beside(layout, key, -1) ?? layout[other(name)].shown;
}

/** `layout` without the pane `key`, its stack's tab and the focus given to a neighbour. */
function without(layout: Layout, key: string): Layout {
  const name = stackOf(layout, key);
  if (name === null) {
    return layout;
  }
  const next = neighbour(layout, key);
  const stack = layout[name];
  const panes = stack.panes.filter((pane) => pane.key !== key);
  const sameStack = panes.some((pane) => pane.key === next);
  const shown = stack.shown === key ? (sameStack ? next : (panes[0]?.key ?? null)) : stack.shown;
  return {
    ...layout,
    focus: layout.focus === key ? next : layout.focus,
    onTabs: layout.focus === key ? false : layout.onTabs,
    [name]: { ...stack, panes, shown },
    zoomed: layout.zoomed === key ? null : layout.zoomed,
  };
}

/**
 * Closes a pane the place allows to close: it goes, the focus to its neighbour, and the place
 * does not bring it back in this visit. The main stack's last pane stays.
 */
export function close(layout: Layout, key: string): Layout {
  const name = stackOf(layout, key);
  const pane = name === null ? undefined : layout[name].panes.find((one) => one.key === key);
  if (pane === undefined || !pane.closes || (name === "main" && layout.main.panes.length === 1)) {
    return layout;
  }
  return { ...without(layout, key), closed: [...layout.closed, key] };
}

/**
 * Moves a pane to a stack, at `index` among its panes, the end by default, shown there with the
 * focus: the human looks at what they moved. The main stack's last pane does not leave it: the
 * place's subject always has the centre.
 */
export function move(layout: Layout, key: string, to: StackName, index?: number): Layout {
  const from = stackOf(layout, key);
  if (from === null) {
    return layout;
  }
  if (from === to) {
    return index === undefined ? focus(layout, key) : focus(reorder(layout, key, index), key);
  }
  if (from === "main" && layout.main.panes.length === 1) {
    return layout;
  }
  const pane = layout[from].panes.find((one) => one.key === key) as PaneRef;
  const left = without(layout, key);
  const panes = [...left[to].panes];
  panes.splice(index ?? panes.length, 0, pane);
  return focus({ ...left, [to]: { ...left[to], panes } }, key);
}

/** Puts a pane at `index` among its stack's panes. */
export function reorder(layout: Layout, key: string, index: number): Layout {
  const name = stackOf(layout, key);
  if (name === null) {
    return layout;
  }
  const panes = layout[name].panes.filter((pane) => pane.key !== key);
  const pane = layout[name].panes.find((one) => one.key === key) as PaneRef;
  panes.splice(Math.max(0, Math.min(index, panes.length)), 0, pane);
  return { ...layout, [name]: { ...layout[name], panes } };
}

/** Shows a stack's panes all at once, or as tabs again. */
export function split(layout: Layout, name: StackName, on: boolean): Layout {
  return {
    ...layout,
    onTabs: on && focusedStack(layout) === name ? false : layout.onTabs,
    [name]: { ...layout[name], split: on },
  };
}

/** Folds the side stack away, or back. The focus inside it goes to the main stack's pane. */
export function fold(layout: Layout, folded: boolean): Layout {
  if (!folded) {
    return { ...layout, folded };
  }
  const inSide = focusedStack(layout) === "side";
  const zoomedSide = layout.zoomed !== null && stackOf(layout, layout.zoomed) === "side";
  return {
    ...layout,
    focus: inSide ? layout.main.shown : layout.focus,
    folded,
    onTabs: inSide ? false : layout.onTabs,
    zoomed: zoomedSide ? null : layout.zoomed,
  };
}

/** The focused pane over the whole room of both stacks, or back in its stack. */
export const zoom = (layout: Layout, on: boolean): Layout => ({
  ...layout,
  zoomed: on ? layout.focus : null,
});

/**
 * The layout of the place as it is now: its panes still there keep their stack and order, a pane
 * it no longer has goes as a closed one does, and a new one joins its default stack at the end.
 * A pane the human closed in this visit stays closed.
 */
export function sync(layout: Layout, place: Place): Layout {
  const wanted = new Map([...place.main, ...place.side].map((pane) => [pane.key, pane] as const));
  let next = layout;
  for (const name of STACKS) {
    for (const pane of layout[name].panes) {
      if (!wanted.has(pane.key)) {
        next = without(next, pane.key);
      }
    }
  }
  for (const name of STACKS) {
    for (const pane of place[name]) {
      if (stackOf(next, pane.key) === null && !next.closed.includes(pane.key)) {
        const panes = [...next[name].panes, pane];
        next = { ...next, [name]: { ...next[name], panes, shown: next[name].shown ?? pane.key } };
      }
    }
  }
  if (next.focus === null || stackOf(next, next.focus) === null) {
    next = { ...next, focus: next.main.shown ?? next.side.shown, onTabs: false };
  }
  return next;
}

/**
 * The one stack of a narrow window: the main stack's panes, then the side's, as tabs, showing the
 * focused pane. It is a view of the layout, not a change: the layout keeps both stacks, and a
 * wider window shows them again as they were.
 */
export function narrowed(layout: Layout): Stack {
  const panes = [...layout.main.panes, ...layout.side.panes];
  return { panes, shown: layout.focus ?? layout.main.shown, split: false };
}
