// What a screen declares: its kinds of pane, once each, with `definePane`, and the panes each of
// its pages shows, with `definePlace`. The layout shell draws them: a screen never draws a pane's
// frame, a tab, or a side column of its own. See the guide, `specs/ui/panes.md`.
import { type JSX, Scroll, type ScrollProps, signal } from "nsh";
import { PaneContext } from "./here";
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

/** A page's one action, which the phone's bottom bar holds: "Run now" of a job. */
export type PaneAction = { icon: IconName; label: string; run: () => void };

export type PaneSpec<Args extends PaneArgs> = {
  /**
   * The one action of the page it is in, which the pane draws by its title on a wider window: on a
   * narrow one, the bottom bar holds it after the panes' tiles, the place for a thumb.
   */
  action?: (args: Args) => PaneAction | undefined;
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

/**
 * A pane in a place, in its kind's stack, or in the one named; `focus` makes it the pane focused as
 * the place opens, in place of the main stack's first.
 */
export type Placed =
  | PaneRef
  | { readonly focus?: boolean; readonly pane: PaneRef; readonly stack?: StackName };

const kinds = new Map<string, PaneSpec<PaneArgs>>();
const places = new Map<
  string,
  { panes: (route: Route) => ReadonlyArray<Placed>; split?: ReadonlyArray<StackName> }
>();

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

/** The action of a stack's panes, the first that has one: the bottom bar's. */
export const actionOf = (panes: ReadonlyArray<PaneRef>): PaneAction | undefined =>
  panes.reduce<PaneAction | undefined>(
    (found, pane) => found ?? kindOf(pane)?.action?.(pane.args),
    undefined,
  );

/**
 * Declares the panes a page shows, in order: each in its kind's stack unless given one. The first
 * main pane is the page's subject, focused as it opens unless another is placed with `focus: true`.
 * Called once per page, at a module's top level. `split` names the stacks that show all their panes
 * at once, as a page read at a glance does, until the human makes them tabs.
 */
export function definePlace<P extends Route["page"]>(
  page: P,
  panes: (route: RouteOf<P>) => ReadonlyArray<Placed>,
  options: { split?: ReadonlyArray<StackName> } = {},
) {
  if (places.has(page)) {
    throw new Error(`The page "${page}" has two places`);
  }
  places.set(page, {
    panes: panes as (route: Route) => ReadonlyArray<Placed>,
    split: options.split,
  });
}

/** The pages a screen declared a place for, as `definePlace` was called: what the app can open. */
export const placedPages = (): ReadonlyArray<Route["page"]> =>
  [...places.keys()] as ReadonlyArray<Route["page"]>;

/** The panes of a route, by their default stacks: none for a page no screen declared. */
export function placeOf(route: Route): Place {
  const declared = places.get(route.page);
  const placed = declared?.panes(route) ?? [];
  const main: Array<PaneRef> = [];
  const side: Array<PaneRef> = [];
  let focus: string | undefined;
  for (const one of placed) {
    const [pane, stack] = "pane" in one ? [one.pane, one.stack] : [one, undefined];
    ((stack ?? kindOf(pane)?.stack) === "side" ? side : main).push(pane);
    if ("pane" in one && one.focus === true) focus = pane.key;
  }
  return {
    main,
    side,
    ...(declared?.split === undefined ? {} : { split: declared.split }),
    ...(focus === undefined ? {} : { focus }),
  };
}

/** The pane a view asked to focus, which the layout shell takes and clears. */
export const focusWanted = signal<string | null>(null);

/**
 * Puts the focus on a pane of the page shown, showing it, as a press in it does: what a pane's
 * action leads to, as a list's Enter to the detail it opened in the other stack.
 */
export function focusPane(pane: PaneRef) {
  focusWanted.set(pane.key);
}

/** The title of a pane, as its tab says it. */
export function titleOf(pane: PaneRef): string {
  const title = kindOf(pane)?.title ?? pane.kind;
  return typeof title === "string" ? title : title(pane.args);
}

export { type PaneHere, PaneContext } from "./here";

/** A pane's own value that a move, a hidden tab, or Back keeps: plain data, in the visit. */
export type Remembered<T extends Json> = { (): T; set(value: T): void };

/** The type a first value stands for: `0` for any number, `""` for any text, `false` for both. */
type Widened<T> = T extends string
  ? string
  : T extends number
    ? number
    : T extends boolean
      ? boolean
      : T;

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
    remember<T extends Json>(name: string, initial: T): Remembered<Widened<T> & Json> {
      type Kept = Widened<T> & Json;
      const read = () =>
        (entry().kept.panes?.[here.key]?.[name] as Kept | undefined) ?? (initial as Kept);
      const set = (value: Kept) => {
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
  // Its children are passed once: spread with the rest and given again, they were made twice,
  // every pane's content and the keys it declares. Its other props are read once, as it opens.
  const { children, ...rest } = props;
  return (
    <Scroll
      {...rest}
      contentOffset={start === undefined ? props.contentOffset : { x: 0, y: start }}
      onScrollEnd={(event) => {
        kept.keep(name, event.offset.y);
        props.onScrollEnd?.(event);
      }}
    >
      {children}
    </Scroll>
  );
}
