// The moves the human makes with the panes, each once, in one table: the leader's group `Space w`,
// "window" as in LazyVim's `<leader>w` and Vim's `Ctrl-w`, declares its keys from it, and a pane's
// menu draws its entries from it, each with its key. A move that makes no sense where the focus is,
// or on a narrow window's one stack, is absent from both, not disabled: reorder, close, bring back,
// and reset stay there.
//
// The keys mirror the focus's: `h` `l` move the focus between the stacks, `H` `L` send the pane
// there; `<` `>` move its tab; `m` makes it the main pane; `s` splits its stack, `=` gives equal
// heights; `f` folds the side stack (`]` too), `z` zooms, `o` makes one stack, as Vim's `:only`;
// `q` closes, `u` brings back, `r` resets this place, `R` every place.
import {
  closedPanes,
  equalShares,
  hasShares,
  isJoined,
  nudge,
  reopen,
  send,
  swap,
  toggleJoin,
  toggleSplit,
} from "./moves";
import { close, fold, focusedStack, type Layout, type Place, zoom } from "./layout";
import type { BesideOffer } from "./here";
import { titleOf } from "./panes";
import type { IconName, MenuEntry } from "../controls";
import { registerKey } from "../keys/registry";

/** What a move reads and changes: the frame's. */
export type Mover = {
  layout: () => Layout;
  place: () => Place;
  /** The window is narrow: one stack of tabs. */
  narrow: () => boolean;
  /** Makes a change a move: it glides, and what lands slides in. `false` when nothing changed. */
  move: (next: Layout | null) => false | undefined;
  /** Forgets this place's arrangement, or every place's, back to the defaults. */
  forget: (all: boolean) => void;
};

type Move = {
  icon: IconName;
  keys: string;
  /** What the key map says. */
  label: string;
  /** A line above it in the menu: the next group. */
  ruled?: boolean;
  run: (mover: Mover) => false | undefined;
  /** What the menu says, where it depends on the layout. */
  says?: (layout: Layout) => string;
  when: (mover: Mover, layout: Layout) => boolean;
};

const wide = (mover: Mover) => !mover.narrow();
const inSide = (layout: Layout) => focusedStack(layout) === "side";

/** Whether the focused pane may close: the place allows it, and it is not the main stack's last. */
function closes(layout: Layout) {
  const name = focusedStack(layout);
  const pane = layout[name].panes.find((one) => one.key === layout.focus);
  return pane?.closes === true && !(name === "main" && layout.main.panes.length === 1);
}

export const MOVES: ReadonlyArray<Move> = [
  {
    icon: "arrow-left",
    keys: "space w H",
    label: "Send to the main stack",
    run: (mover) => mover.move(send(mover.layout(), "main")),
    when: (mover, layout) => wide(mover) && inSide(layout),
  },
  {
    icon: "arrow-right",
    keys: "space w L",
    label: "Send to the side stack",
    run: (mover) => mover.move(send(mover.layout(), "side")),
    when: (mover, layout) => wide(mover) && !inSide(layout) && layout.main.panes.length > 1,
  },
  {
    icon: "arrow-right-left",
    keys: "space w m",
    label: "Make it the main pane",
    run: (mover) => mover.move(swap(mover.layout())),
    when: (mover, layout) => wide(mover) && inSide(layout) && layout.main.shown !== null,
  },
  {
    icon: "chevron-left",
    keys: "space w <",
    label: "Move the tab left",
    run: (mover) => mover.move(nudge(mover.layout(), -1, mover.narrow())),
    when: (mover, layout) => nudge(layout, -1, mover.narrow()) !== null,
  },
  {
    icon: "chevron-right",
    keys: "space w >",
    label: "Move the tab right",
    run: (mover) => mover.move(nudge(mover.layout(), 1, mover.narrow())),
    when: (mover, layout) => nudge(layout, 1, mover.narrow()) !== null,
  },
  {
    icon: "rows-3",
    keys: "space w s",
    label: "Split the stack, or tabs",
    ruled: true,
    run: (mover) => mover.move(toggleSplit(mover.layout())),
    says: (layout) =>
      layout[focusedStack(layout)].split ? "Show the stack as tabs" : "Split the stack",
    when: (mover, layout) => wide(mover) && layout[focusedStack(layout)].panes.length > 1,
  },
  {
    icon: "rows-3",
    keys: "space w =",
    label: "Equal heights",
    run: (mover) => mover.move(equalShares(mover.layout())),
    when: (mover, layout) => wide(mover) && layout[focusedStack(layout)].split && hasShares(layout),
  },
  {
    icon: "panel-right",
    keys: "space w f",
    label: "Fold the side stack, or unfold it",
    run: (mover) => mover.move(fold(mover.layout(), !mover.layout().folded)),
    says: (layout) => (layout.folded ? "Unfold the side stack" : "Fold the side stack"),
    when: (mover, layout) => wide(mover) && layout.side.panes.length > 0,
  },
  {
    icon: "maximize-2",
    keys: "space w z",
    label: "Zoom the pane, or back",
    run: (mover) => mover.move(zoom(mover.layout(), mover.layout().zoomed === null)),
    says: (layout) => (layout.zoomed === null ? "Zoom the pane" : "Back from the zoom"),
    when: (mover) => wide(mover),
  },
  {
    icon: "layout-template",
    keys: "space w o",
    label: "One stack, or two",
    run: (mover) => mover.move(toggleJoin(mover.layout())),
    says: (layout) => (isJoined(layout) ? "Two stacks again" : "One stack, the side's as tabs"),
    when: (mover, layout) => wide(mover) && (layout.side.panes.length > 0 || isJoined(layout)),
  },
  {
    icon: "x",
    keys: "space w q",
    label: "Close the pane",
    ruled: true,
    run: (mover) => mover.move(close(mover.layout(), mover.layout().focus ?? "")),
    when: (_, layout) => closes(layout),
  },
  {
    icon: "undo-2",
    keys: "space w u",
    label: "Bring back the last closed pane",
    run: (mover) => mover.move(reopen(mover.layout(), mover.place())),
    when: (mover, layout) => closedPanes(layout, mover.place()).length > 0,
  },
  {
    icon: "refresh-cw",
    keys: "space w r",
    label: "Reset this place's layout",
    ruled: true,
    run: (mover) => {
      mover.forget(false);
      return undefined;
    },
    when: () => true,
  },
  {
    icon: "refresh-cw",
    keys: "space w R",
    label: "Reset every place's layout",
    run: (mover) => {
      mover.forget(true);
      return undefined;
    },
    when: () => true,
  },
];

/** Declares the moves' keys, in the frame's scope. */
export function MoveKeys(props: { mover: Mover }) {
  const mover = props.mover;
  registerKey(
    MOVES.map((one) => ({
      icon: one.icon,
      keys: one.keys,
      label: one.label,
      run: () => one.run(mover),
      when: () => one.when(mover, mover.layout()),
      // The group's one hint: the leader's menu opened at it teaches the rest.
      ...(one.keys === "space w r"
        ? { hint: "space w", hintLabel: "panes", hintPress: "space w" }
        : {}),
    })),
  );
  return null;
}

/**
 * The entries of the focused pane's menu: what it names to open beside, then every move that makes
 * sense there, each with its key, and each closed pane to bring back by its title.
 */
export function menuEntries(mover: Mover, beside?: BesideOffer): ReadonlyArray<MenuEntry> {
  const layout = mover.layout();
  const entries: Array<MenuEntry> = [];
  if (beside !== undefined) {
    entries.push({
      icon: "columns-3",
      keys: "shift+Enter",
      label: `Open ${titleOf(beside.pane)} beside`,
      run: beside.open,
    });
  }
  for (const one of MOVES) {
    if (!one.when(mover, layout)) continue;
    if (one.keys === "space w u") {
      const closed = closedPanes(layout, mover.place());
      closed.forEach((pane, at) =>
        entries.push({
          icon: one.icon,
          keys: at === closed.length - 1 ? one.keys : undefined,
          label: `Bring back ${titleOf(pane)}`,
          run: () => void mover.move(reopen(mover.layout(), mover.place(), pane.key)),
        }),
      );
      continue;
    }
    entries.push({
      icon: one.icon,
      keys: one.keys,
      label: one.says?.(layout) ?? one.label,
      ruled: one.ruled === true && entries.length > 0,
      run: () => void one.run(mover),
    });
  }
  return entries;
}
