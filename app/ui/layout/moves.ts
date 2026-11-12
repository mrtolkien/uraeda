// The moves the human makes, as a tiling window manager's: each a pure function of the layout, as
// `layout.ts`'s are, which the keys of `Space w`, a pane's menu, and a drag of a tab all call.
//
// - `send` puts the focused pane in the other stack, as i3's `move` and Hyprland's `movewindow`.
// - `swap` makes a side pane the main one, the main one taking its place: `swapwithmaster`.
// - `nudge` moves a tab along its stack; on a narrow window's one stack, past the end of the main
//   stack's tabs, into the side stack's, and back.
// - `join` makes the side stack tabs of the main one, a stack of tabs as i3's `layout tabbed`, and
//   `part` sends them back: "the sidebar inside the main view, so it becomes a full pane".
// - `placeBeside` puts a pane named somewhere, a session, a file, a diff, in the other stack of the
//   place, as Kiro opens a chat as an editor tab: the place's own panes stay as they are.
// - `reopen` brings a closed pane back, the last one unless named.
import {
  focus,
  focusedStack,
  type Layout,
  move,
  other,
  type PaneRef,
  type Place,
  reorder,
  type StackName,
  stackOf,
  sync,
} from "./layout";

/** A pane to a stack, at `index` or its end: a side stack the human builds again is no joined one. */
export function moveTo(layout: Layout, key: string, to: StackName, index?: number): Layout {
  const next = move(layout, key, to, index);
  return next === layout || to !== "side" ? next : { ...next, joined: undefined };
}

/** The focused pane to the other stack, or to `to`: unchanged where it cannot go. */
export function send(layout: Layout, to?: StackName): Layout {
  const from = layout.focus === null ? null : stackOf(layout, layout.focus);
  if (from === null || layout.focus === null || to === from) {
    return layout;
  }
  return moveTo(layout, layout.focus, to ?? other(from));
}

/**
 * The focused side pane in the main stack's place of the pane it shows, which takes the side
 * pane's place: "make this the main thing". The focus stays on the pane, now in main.
 */
export function swap(layout: Layout): Layout {
  const key = layout.focus;
  const main = layout.main.shown;
  if (key === null || main === null || stackOf(layout, key) !== "side") {
    return layout;
  }
  const sideAt = layout.side.panes.findIndex((pane) => pane.key === key);
  const mainAt = layout.main.panes.findIndex((pane) => pane.key === main);
  return {
    ...layout,
    focus: key,
    joined: undefined,
    main: {
      ...layout.main,
      panes: layout.main.panes.with(mainAt, layout.side.panes[sideAt]),
      shown: key,
    },
    onTabs: false,
    side: {
      ...layout.side,
      panes: layout.side.panes.with(sideAt, layout.main.panes[mainAt]),
      shown: main,
    },
    zoomed: null,
  };
}

/**
 * The focused pane `by` places along its stack, the focus with it; `null` past an end. On a narrow
 * window's one stack, the main stack's last tab goes on into the side stack, and the side stack's
 * first back into the main one, as the one stack reads them.
 */
export function nudge(layout: Layout, by: number, narrow = false): Layout | null {
  const key = layout.focus;
  const name = key === null ? null : stackOf(layout, key);
  if (key === null || name === null) {
    return null;
  }
  const panes = layout[name].panes;
  const to = panes.findIndex((pane) => pane.key === key) + by;
  if (to >= 0 && to < panes.length) {
    return reorder(layout, key, to);
  }
  if (!narrow) {
    return null;
  }
  const next =
    name === "main" && by > 0
      ? moveTo(layout, key, "side", 0)
      : name === "side" && by < 0
        ? moveTo(layout, key, "main")
        : layout;
  return next === layout ? null : next;
}

/** Shows the focused pane's stack split, or as tabs again. */
export function toggleSplit(layout: Layout): Layout {
  const name = focusedStack(layout);
  const on = !layout[name].split;
  return {
    ...layout,
    onTabs: on ? false : layout.onTabs,
    [name]: { ...layout[name], split: on },
  };
}

/** A split pane's height, as the human dragged it. */
export function share(layout: Layout, key: string, size: number): Layout {
  const name = stackOf(layout, key);
  if (name === null) {
    return layout;
  }
  const sizes = { ...layout[name].sizes, [key]: Math.round(size) };
  return { ...layout, [name]: { ...layout[name], sizes } };
}

/** The focused stack's panes in equal heights again. */
export function equalShares(layout: Layout): Layout {
  const name = focusedStack(layout);
  return { ...layout, [name]: { ...layout[name], sizes: undefined } };
}

/** Whether the focused stack's panes have heights the human gave them. */
export const hasShares = (layout: Layout) =>
  Object.keys(layout[focusedStack(layout)].sizes ?? {}).length > 0;

/** Whether the side stack's panes are tabs of the main one now. */
export const isJoined = (layout: Layout) =>
  layout.side.panes.length === 0 && (layout.joined ?? []).length > 0;

/**
 * The side stack's panes as tabs of the main one, after its own, the focus where it was: one stack
 * the width of the window. Unchanged with no side pane.
 */
export function join(layout: Layout): Layout {
  if (layout.side.panes.length === 0) {
    return layout;
  }
  const inSide = focusedStack(layout) === "side";
  const panes = [...layout.main.panes, ...layout.side.panes];
  return {
    ...layout,
    joined: layout.side.panes.map((pane) => pane.key),
    main: { ...layout.main, panes, shown: inSide ? layout.focus : layout.main.shown },
    side: { panes: [], shown: null, sizes: layout.side.sizes, split: layout.side.split },
  };
}

/** The joined panes back in the side stack, in their order, the focus where it was. */
export function part(layout: Layout): Layout {
  const joined = new Set(layout.joined ?? []);
  const leaving = layout.main.panes.filter((pane) => joined.has(pane.key));
  const staying = layout.main.panes.filter((pane) => !joined.has(pane.key));
  if (leaving.length === 0 || staying.length === 0) {
    return { ...layout, joined: undefined };
  }
  return {
    ...layout,
    joined: undefined,
    main: { ...layout.main, panes: staying, shown: keep(staying, layout.main.shown) },
    side: { ...layout.side, panes: leaving, shown: keep(leaving, layout.focus) },
  };
}

/** `shown` when `panes` hold it, else their first. */
const keep = (panes: ReadonlyArray<PaneRef>, shown: string | null) =>
  panes.some((pane) => pane.key === shown) ? shown : (panes[0]?.key ?? null);

/** One stack, or two again. */
export const toggleJoin = (layout: Layout): Layout =>
  isJoined(layout) ? part(layout) : join(layout);

/**
 * Opens `pane` in the stack other than the one of `from`, the pane that named it (the focused one
 * unless given), after the pane that stack shows, with the focus: the place's panes stay where
 * they are. A pane the layout holds already is focused where it is. The human may close it.
 */
export function placeBeside(layout: Layout, pane: PaneRef, from?: string): Layout {
  if (stackOf(layout, pane.key) !== null) {
    return focus(layout, pane.key);
  }
  const named = from ?? layout.focus;
  const to = other((named === null ? null : stackOf(layout, named)) ?? "side");
  const panes = [...layout[to].panes];
  const at = panes.findIndex((one) => one.key === layout[to].shown);
  panes.splice(at + 1, 0, { ...pane, closes: true });
  const opened = [...(layout.opened ?? []), pane.key];
  return focus(
    {
      ...layout,
      closed: layout.closed.filter((key) => key !== pane.key),
      opened,
      [to]: { ...layout[to], panes },
    },
    pane.key,
  );
}

/** The place's panes the human closed, in the order they closed. */
export const closedPanes = (layout: Layout, place: Place): ReadonlyArray<PaneRef> =>
  layout.closed.flatMap((key) => [...place.main, ...place.side].filter((pane) => pane.key === key));

/** A closed pane back in its stack, with the focus: the last closed unless named. */
export function reopen(layout: Layout, place: Place, key?: string): Layout {
  const back = key ?? layout.closed.at(-1);
  if (back === undefined || !layout.closed.includes(back)) {
    return layout;
  }
  const next = sync({ ...layout, closed: layout.closed.filter((one) => one !== back) }, place);
  return focus(next, back);
}
