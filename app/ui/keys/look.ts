// Every colour and size the keys' views draw with, in this one file, read from the tokens.
//
// TASK 28: the switch left is in `parts.tsx`: `Panel` becomes `Overlay` or `Sheet`
// (`app/ui/surfaces/`), `KeyCap` becomes `Kbd`, and `Mark` becomes `Icon` (`app/ui/controls/`).
// TASK 33: `isNarrow` becomes the layout shell's `width`.
import { windowSize } from "nsh";
import { tokens } from "../tokens";

/** What the views draw with, in the theme shown: read in a view, it follows the theme. */
export function look() {
  const v = tokens;
  return {
    accent: v.role.action,
    /** What dims the page behind a layer that takes the focus. */
    dim: v.backdrop.dim,
    edge: v.role.rule,
    /** A key's chip: its fill, its letter, its size. */
    key: { fill: v.key.fill, padding: v.key.padding, size: v.key.size, text: v.key.text },
    /** How a layer comes and goes: milliseconds, a curve, and the distance it rises. */
    motion: { in: v.motion.in, out: v.motion.out, rise: v.motion.rise },
    pad: v.space.panePadding,
    /** The fill of what floats over the page. */
    panel: v.role.raised,
    quiet: v.role.inkQuiet,
    /** A row's height, and the unit of every other. */
    row: v.space.row,
    /** The selected row's tint. */
    selected: v.role.ruleQuiet,
    statusLine: v.status.height,
    text: v.role.ink,
    type: { line: v.type.line, mono: v.type.body, size: v.type.size, small: v.type.under },
  };
}

export type Look = ReturnType<typeof look>;

/** Whether the window is a phone's: a layer is then a sheet across its width. */
export const isNarrow = () => windowSize().width < 768;
