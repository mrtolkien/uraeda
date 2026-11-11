// Every colour and size the keys' views draw with, in this one file, read from the tokens.
//
// TASK 28: the controls were built after this folder. The switch is here and in `parts.tsx`:
// `KeyCap` becomes `Kbd`, `Words` becomes `Text`, and `Mark` becomes `Icon` (`app/ui/controls/`),
// and this file goes with them.
// TASK 33: `isNarrow` becomes the layout shell's `width`.
import { windowSize } from "nsh";
import { tokens } from "../tokens";

/** What the views draw with, in the theme shown: read in a view, it follows the theme. */
export function look() {
  return {
    accent: tokens.role.action,
    edge: tokens.role.rule,
    /** A key's chip: its fill, its letter, its size. */
    key: {
      fill: tokens.key.fill,
      padding: tokens.key.padding,
      size: tokens.key.size,
      text: tokens.key.text,
    },
    quiet: tokens.role.inkQuiet,
    /** A row's height, and the unit of every other. */
    row: tokens.space.row,
    /** The selected row's tint. */
    selected: tokens.row.selected,
    text: tokens.role.ink,
    type: {
      line: tokens.type.line,
      mono: tokens.type.body,
      size: tokens.type.size,
      small: tokens.type.under,
    },
  };
}

export type Look = ReturnType<typeof look>;

/** Whether the window is a phone's: a layer is then a sheet across its width. */
export const isNarrow = () => windowSize().width < 768;
