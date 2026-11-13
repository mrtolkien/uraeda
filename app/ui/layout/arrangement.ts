// The human's arrangement of a kind of place, kept on the device: every session page opens as the
// last one was left. A visit keeps its own layout (`Kept.layout`), for Back; a new visit of a place
// of the same kind opens on the arrangement, which names panes by their kinds, not their keys, so it
// fits every session, every file, every feature.
//
// A kind of place is the kind of its subject, the main stack's first pane as the place declares it:
// `/sessions/<id>` and a feature's session page are one kind, `session-transcript`. A pane kind's
// location there, its stack and its place among the tabs, is one fact, as VS Code keeps a view's.
// Panes the human opened beside are this visit's alone, and are not kept.
import {
  focus,
  type Layout,
  layoutOf,
  type PaneRef,
  type Place,
  type StackName,
  stackOfPanes,
} from "./layout";

/** A kind of place's arrangement: its panes by kind. Plain data, kept on the device. */
export type Arrangement = {
  readonly closed: ReadonlyArray<string>;
  readonly joined: ReadonlyArray<string> | null;
  readonly main: ReadonlyArray<string>;
  readonly shown: { readonly main: string | null; readonly side: string | null };
  readonly side: ReadonlyArray<string>;
  /** The heights the human gave split panes, by kind. */
  readonly sizes: Readonly<Record<string, number>>;
  readonly split: ReadonlyArray<StackName>;
  readonly zoomed: string | null;
};

/** The name a place's arrangement is kept under: its subject's kind, `null` for an empty place. */
export const placeKind = (place: Place): string | null => place.main[0]?.kind ?? null;

/** The kind a pane's key names: what comes before its arguments (`paneKey`). */
export function kindOfKey(key: string): string {
  const at = key.indexOf(":[[");
  return at < 0 ? key : key.slice(0, at);
}

/** What of `layout` the device keeps: where each kind of pane is, without this visit's own panes. */
export function arrangementOf(layout: Layout): Arrangement {
  const opened = new Set(layout.opened ?? []);
  const all = [...layout.main.panes, ...layout.side.panes];
  const kindOf = (key: string | null | undefined) =>
    key === null || key === undefined || opened.has(key)
      ? null
      : (all.find((pane) => pane.key === key)?.kind ?? null);
  const kinds = (keys: ReadonlyArray<string>) =>
    keys.flatMap((key) => {
      const kind = kindOf(key);
      return kind === null ? [] : [kind];
    });
  const of = (name: StackName) => kinds(layout[name].panes.map((pane) => pane.key));
  const sizes: Record<string, number> = {};
  for (const name of ["main", "side"] as const) {
    for (const [key, size] of Object.entries(layout[name].sizes ?? {})) {
      const kind = kindOf(key);
      if (kind !== null) sizes[kind] = size;
    }
  }
  return {
    closed: layout.closed.map(kindOfKey),
    joined: layout.joined === undefined ? null : kinds(layout.joined),
    main: of("main"),
    shown: { main: kindOf(layout.main.shown), side: kindOf(layout.side.shown) },
    side: of("side"),
    sizes,
    split: (["main", "side"] as const).filter((name) => layout[name].split),
    zoomed: kindOf(layout.zoomed),
  };
}

/**
 * The layout a place opens on, as `stored` arranged its kind: each pane in the stack and at the
 * place its kind was left, a pane the arrangement does not name in its default stack after them,
 * and a closed kind closed. The focus is on the zoomed pane, else the one the place names, else its
 * subject. Without an arrangement, or with one that would leave the main stack empty, the default.
 */
export function arranged(place: Place, stored: Arrangement | undefined, folded = false): Layout {
  const base = layoutOf(place, folded);
  if (stored === undefined) {
    return base;
  }
  const all = [...place.main, ...place.side];
  const closed = all.filter((pane) => pane.closes && stored.closed.includes(pane.kind));
  const used = new Set(closed.map((pane) => pane.key));
  const take = (kinds: ReadonlyArray<string>) =>
    kinds.flatMap((kind) => {
      const pane = all.find((one) => one.kind === kind && !used.has(one.key));
      if (pane === undefined) return [];
      used.add(pane.key);
      return [pane];
    });
  const main: Array<PaneRef> = take(stored.main);
  const side: Array<PaneRef> = take(stored.side);
  main.push(...place.main.filter((pane) => !used.has(pane.key)));
  side.push(...place.side.filter((pane) => !used.has(pane.key)));
  if (main.length === 0) {
    return base;
  }
  const keyOf = (kind: string | null) =>
    kind === null ? null : ([...main, ...side].find((pane) => pane.kind === kind)?.key ?? null);
  const sized = (panes: ReadonlyArray<PaneRef>) => {
    const sizes = Object.fromEntries(
      panes.flatMap((pane) => {
        const size = stored.sizes[pane.kind];
        return size === undefined ? [] : [[pane.key, size]];
      }),
    );
    return Object.keys(sizes).length === 0 ? {} : { sizes };
  };
  const joined = stored.joined?.flatMap((kind) => {
    const key = keyOf(kind);
    return key === null ? [] : [key];
  });
  const layout: Layout = {
    closed: closed.map((pane) => pane.key),
    focus: null,
    folded,
    ...(joined === undefined ? {} : { joined }),
    main: {
      ...stackOfPanes(main, keyOf(stored.shown.main), stored.split.includes("main")),
      ...sized(main),
    },
    onTabs: false,
    side: {
      ...stackOfPanes(side, keyOf(stored.shown.side), stored.split.includes("side")),
      ...sized(side),
    },
    zoomed: keyOf(stored.zoomed),
  };
  const wanted = layout.zoomed ?? place.focus ?? place.main[0]?.key;
  return wanted === undefined ? { ...layout, focus: main[0].key } : focus(layout, wanted);
}

/** Whether two arrangements say the same: what is kept is written only when it changed. */
export const sameArrangement = (a: Arrangement | undefined, b: Arrangement | undefined) =>
  JSON.stringify(a) === JSON.stringify(b);
