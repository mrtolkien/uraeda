// What a screen declares: its kinds of pane, once each, with `definePane`, and the panes each of
// its pages shows, with `definePlace`. The layout shell draws them: a screen never draws a pane's
// frame, a tab, or a side column of its own. See the guide, `specs/ui/panes.md`.
import { context, type JSX, Scroll, type ScrollProps } from "nsh";
import { type Json, type PaneRef, paneKey, type Place, type StackName } from "./layout";
import { entry, keep, positions } from "../../store/history";
import type { Route, RouteOf } from "../../store/routes";
import type { IconName } from "../controls";
import type { WidthClass } from "../width";

/** What a pane's arguments are: named plain values, as a route's fields are. */
export type PaneArgs = Readonly<Record<string, Json>>;

/** What a pane's tab says besides its title, read as a signal: it may read records. */
export type PaneMark = {
  /** A count after the title: "Changes · 4". */
  count?: number;
  /** It waits on the human: its title in `needs-you`. */
  needs?: boolean;
  /** A run is on in it: its stack's running line, and a mark on its tab while it is hidden. */
  running?: boolean;
};

/** What a pane's view is given. Each is read as a signal: it changes while the pane stays. */
export type PaneViewProps<Args extends PaneArgs> = {
  args: Args;
  /** Whether the keys go to this pane now. */
  focused: boolean;
  /** The width class of the stack it is in now, not the window's: a side stack is `narrow`. */
  width: WidthClass;
};

export type PaneSpec<Args extends PaneArgs> = {
  /** Whether the human may close it: a place's subject may not. `false` unless given. */
  closes?: boolean;
  /**
   * It draws to its sides' edges, as a list or a transcript whose rows are lit to the border: the
   * frame then gives its body no padding on the sides. Padded unless given.
   */
  flush?: boolean;
  icon: IconName;
  /** A name no other kind has: "transcript", "session-activity". */
  kind: string;
  /** What its tab says besides its title. */
  mark?: (args: Args) => PaneMark | undefined;
  /** The stack it sits in unless its place says otherwise. */
  stack: StackName;
  /** Its tab's title, short: "Activity", or a file's name. */
  title: string | ((args: Args) => string);
  /** What it draws, from its arguments: never its own frame or title, which the shell draws. */
  view: (props: PaneViewProps<Args>) => JSX.Element;
};

/** A kind of pane: called with its arguments, it names one pane. */
export type PaneKind<Args extends PaneArgs> = ((args: Args) => PaneRef) & {
  readonly spec: PaneSpec<Args>;
};

/** A pane in a place, in its kind's stack, or in the one named. */
export type Placed = PaneRef | { readonly pane: PaneRef; readonly stack: StackName };

const kinds = new Map<string, PaneSpec<PaneArgs>>();
const places = new Map<string, (route: Route) => ReadonlyArray<Placed>>();

/**
 * Declares a kind of pane, once, at a module's top level. Throws when another kind took its name:
 * two screens would draw each other's panes.
 */
export function definePane<Args extends PaneArgs = Record<string, never>>(
  spec: PaneSpec<Args>,
): PaneKind<Args> {
  if (kinds.has(spec.kind)) {
    throw new Error(`Two kinds of pane are named "${spec.kind}"`);
  }
  kinds.set(spec.kind, spec as unknown as PaneSpec<PaneArgs>);
  const made = (args: Args): PaneRef => ({
    args,
    closes: spec.closes === true,
    key: paneKey(spec.kind, args),
    kind: spec.kind,
  });
  return Object.assign(made, { spec });
}

/** The kind of a pane, as declared: `undefined` for a kind no module declared. */
export const kindOf = (pane: PaneRef): PaneSpec<PaneArgs> | undefined => kinds.get(pane.kind);

/**
 * Declares the panes a page shows, in order: each in its kind's stack unless given one. The first
 * main pane is the page's subject, focused as it opens. Called once per page, at a module's top
 * level.
 */
export function definePlace<P extends Route["page"]>(
  page: P,
  panes: (route: RouteOf<P>) => ReadonlyArray<Placed>,
) {
  if (places.has(page)) {
    throw new Error(`The page "${page}" has two places`);
  }
  places.set(page, panes as (route: Route) => ReadonlyArray<Placed>);
}

/** The panes of a route, by their default stacks: none for a page no screen declared. */
export function placeOf(route: Route): Place {
  const placed = places.get(route.page)?.(route) ?? [];
  const main: Array<PaneRef> = [];
  const side: Array<PaneRef> = [];
  for (const one of placed) {
    const [pane, stack] = "pane" in one ? [one.pane, one.stack] : [one, kindOf(one)?.stack];
    (stack === "side" ? side : main).push(pane);
  }
  return { main, side };
}

/** The title of a pane, as its tab says it. */
export function titleOf(pane: PaneRef): string {
  const title = kindOf(pane)?.title ?? pane.kind;
  return typeof title === "string" ? title : title(pane.args);
}

/** What a pane knows of itself, inside its view: `usePane()`. */
export type PaneHere = {
  focused: () => boolean;
  /** The pane's key: where it keeps what it remembers. */
  key: string;
  width: () => WidthClass;
};

export const PaneContext = context<PaneHere | null>(null);

/** A pane's own value that a move, a hidden tab, or Back keeps: plain data, in the visit. */
export type Remembered<T extends Json> = { (): T; set(value: T): void };

/** The pane drawn around the caller, with what it remembers. Throws outside a pane. */
export function usePane() {
  const here = PaneContext();
  if (here === null) {
    throw new Error("usePane() is called in a pane's view, which the layout shell draws");
  }
  return {
    ...here,
    /**
     * A value the pane keeps in the visit, under `name`: its selection, a fold. It survives the
     * pane's tab hidden, a move to the other stack, and Back to the visit.
     */
    remember<T extends Json>(name: string, initial: T): Remembered<T> {
      const read = () => (entry().kept.panes?.[here.key]?.[name] as T | undefined) ?? initial;
      const set = (value: T) => {
        const panes = entry().kept.panes ?? {};
        keep({ panes: { ...panes, [here.key]: { ...panes[here.key], [name]: value } } });
      };
      return Object.assign(read, { set });
    },
  };
}

/**
 * A pane's scroll view, which starts where the pane was last left at rest in this visit, and keeps
 * where it comes to rest: a pane that scrolls uses it, or calls `positions()` itself under its key.
 */
export function PaneScroll(props: ScrollProps & { children?: JSX.Element; name?: string }) {
  const here = PaneContext();
  const kept = positions();
  const name = `${here?.key ?? "page"}:${props.name ?? "scroll"}`;
  const start = kept.at(name);
  return (
    <Scroll
      {...props}
      contentOffset={start === undefined ? props.contentOffset : { x: 0, y: start }}
      onScrollEnd={(event) => {
        kept.keep(name, event.offset.y);
        props.onScrollEnd?.(event);
      }}
    >
      {props.children}
    </Scroll>
  );
}
