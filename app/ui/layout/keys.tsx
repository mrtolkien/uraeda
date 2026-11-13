// The frame's keys, declared in the registry by the frame alone. `h` `l` cross the stacks, `j` `k`
// go from pane to pane in a split stack, and `k` reaches the tabs: each is a fallback, so a pane
// that has a use for the key (a list's `j`, columns' `h`) declares it in its own scope, returns
// `false` at its edge, and the frame's then runs. On the tabs, a selection of its own, `h` `l`
// show the previous and the next tab, and `j` goes back into the pane.
import {
  beside,
  cross,
  fold,
  focus,
  focusedStack,
  type Layout,
  narrowed,
  step,
  toTabs,
} from "./layout";
import { KeyScope, registerKey } from "../keys/registry";

export type FrameKeysProps = {
  layout: () => Layout;
  /** The window is narrow: one stack of tabs, no fold, no width to change. */
  narrow: () => boolean;
  /** Changes the side stack's width by `by` points. */
  resize: (by: number) => void;
  /** Whether the side stack has a pane to show. */
  hasSide: () => boolean;
  set: (next: Layout) => void;
  /** Folds the rail, or unfolds it. */
  toggleRail: () => void;
};

/** How far `{` and `}` move the side stack's edge, in points. */
const RESIZE_STEP = 40;

/** Runs a change, `false` when it changed nothing, so the key goes on. */
function apply(props: FrameKeysProps, next: Layout | null) {
  if (next === null || next === props.layout()) {
    return false;
  }
  props.set(next);
  return undefined;
}

/** The tabs of the focused stack: how many there are. */
function tabCount(props: FrameKeysProps) {
  const layout = props.layout();
  return props.narrow() ? narrowed(layout).panes.length : layout[focusedStack(layout)].panes.length;
}

/** Whether `h` or `l` moves the focus now: to the other stack, or on a narrow window, a tab. */
function crosses(props: FrameKeysProps) {
  const layout = props.layout();
  if (props.narrow()) return tabCount(props) > 1;
  const moves = (next: Layout | null) => next !== null && next !== layout;
  return moves(cross(layout, "main")) || moves(cross(layout, "side"));
}

/** The pane above or below the focused one, in a split stack. */
function inSplit(props: FrameKeysProps, by: number) {
  const layout = props.layout();
  const name = focusedStack(layout);
  if (props.narrow() || !layout[name].split || layout.focus === null) {
    return null;
  }
  const next = beside(layout, layout.focus, by);
  return next === null ? null : focus(layout, next);
}

function TabKeys(props: FrameKeysProps) {
  registerKey([
    {
      hint: "h l",
      hintLabel: "tab",
      keys: "h",
      label: "Previous tab",
      repeat: true,
      run: () => apply(props, step(props.layout(), -1, props.narrow())),
    },
    {
      keys: "l",
      label: "Next tab",
      repeat: true,
      run: () => apply(props, step(props.layout(), 1, props.narrow())),
    },
    {
      hint: "j",
      hintLabel: "into the pane",
      keys: "j",
      label: "Back into the pane",
      run: () => props.set(toTabs(props.layout(), false)),
    },
    { keys: "Enter", label: "Into the pane", run: () => props.set(toTabs(props.layout(), false)) },
    {
      keys: "Escape",
      label: "Leave the tabs",
      run: () => props.set(toTabs(props.layout(), false)),
    },
  ]);
  return null;
}

export function FrameKeys(props: FrameKeysProps) {
  registerKey([
    {
      fallback: true,
      hint: "h l",
      hintLabel: "pane",
      keys: "h",
      label: "Pane to the left",
      run: () =>
        apply(
          props,
          props.narrow() ? step(props.layout(), -1, true) : cross(props.layout(), "main"),
        ),
      // Hinted, and listed, only where there is a pane to go to.
      when: () => crosses(props),
    },
    {
      fallback: true,
      keys: "l",
      label: "Pane to the right",
      run: () =>
        apply(
          props,
          props.narrow() ? step(props.layout(), 1, true) : cross(props.layout(), "side"),
        ),
      when: () => crosses(props),
    },
    {
      fallback: true,
      keys: "k",
      label: "Pane above, or the tabs",
      run: () => {
        const above = inSplit(props, -1);
        if (above !== null) {
          return apply(props, above);
        }
        const layout = props.layout();
        const split = !props.narrow() && layout[focusedStack(layout)].split;
        return split || layout.onTabs || tabCount(props) < 2
          ? false
          : apply(props, toTabs(layout, true));
      },
    },
    {
      fallback: true,
      keys: "j",
      label: "Pane below",
      run: () => apply(props, inSplit(props, 1)),
    },
    {
      hint: "[ ]",
      hintLabel: "fold",
      keys: "[",
      label: "Fold the sidebar",
      run: () => props.toggleRail(),
      when: () => !props.narrow(),
    },
    {
      keys: "]",
      label: "Fold the side stack",
      run: () => props.set(fold(props.layout(), !props.layout().folded)),
      when: () => !props.narrow() && props.hasSide(),
    },
    {
      keys: "{",
      label: "Widen the side stack",
      repeat: true,
      run: () => props.resize(RESIZE_STEP),
      when: () => !props.narrow() && props.hasSide() && !props.layout().folded,
    },
    {
      keys: "}",
      label: "Narrow the side stack",
      repeat: true,
      run: () => props.resize(-RESIZE_STEP),
      when: () => !props.narrow() && props.hasSide() && !props.layout().folded,
    },
  ]);
  return (
    <KeyScope kind="selection" name="Tabs" on={() => props.layout().onTabs}>
      <TabKeys {...props} />
    </KeyScope>
  );
}
