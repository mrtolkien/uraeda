// Sizes that are no colour: the grid's row, the gap between panes, a pane's title, the status line.
import { choices } from "./choices";

export const space = {
  /** A row of a list: a line of the reading size, `type.line`, with 2 px over and under it. */
  row: 28,
  /** The gap between panes: 8 on a wide window, 4 on a narrow one, 2 on a phone. */
  gap: { wide: choices["pane.gap"], narrow: 4, phone: 2 },
  panePadding: 12,
};

/** The status line: a line of the reading size, 2 px over and under it, and its two 1 px rims. */
export const status = { height: 30, padding: 12 };

/** Every corner is square, at every height: it is the look, and no token changes it. */
export const radius = 0;
