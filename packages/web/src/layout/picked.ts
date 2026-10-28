// What the keys or the pointer picked, drawn the same on every page: a list's selected row, home's
// picked card, the repository picker's cursor; and the keyboard's ring around a whole card.
import { colorVars, focusVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { createContext } from "react";

export const pickedStyles = stylex.create({
  // The mauve tint of a selected row, apart from the pane's own background, with a bar at its start.
  picked: {
    backgroundColor: colorVars["--color-accent-muted"],
    boxShadow: `inset 2px 0 0 0 ${colorVars["--color-accent"]}`,
  },
  // The keyboard's focus ring around the whole card, drawn just inside it, from the pseudo-class
  // alone: a default of the app's own, unlayered, would override Astryx's layered rule on any
  // element that shares the atomic class.
  ringWithin: {
    outlineColor: { ":has(:focus-visible)": colorVars["--color-accent"], default: null },
    outlineOffset: {
      ":has(:focus-visible)": `calc(-1 * ${focusVars["--focus-outline-width"]})`,
      default: null,
    },
    outlineStyle: { ":has(:focus-visible)": "solid", default: null },
    outlineWidth: { ":has(:focus-visible)": focusVars["--focus-outline-width"], default: null },
  },
});

/**
 * The address of the shell's card or done row the keys or the pointer picked, on a page that moves
 * along them, the sessions page: its card is tinted and ringed whole as a picked row is. None in the
 * column, where a card is selected by its page.
 */
export const PickedCard = createContext<string | undefined>(undefined);
