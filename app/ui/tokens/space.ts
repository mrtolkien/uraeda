// Sizes that are no colour: the grid's row, the gap between panes, a pane's title, the status line.
import { choices } from "./choices";

export const space = {
  /** A row of a list, and the unit every height is a multiple of. */
  row: 24,
  /** The gap between panes: 8 on a wide window, 4 on a narrow one, 2 on a phone. */
  gap: { wide: choices["pane.gap"], narrow: 4, phone: 2 },
  panePadding: 12,
};

export const status = { height: 26, padding: 12 };

/** Every corner is square, at every height: it is the look, and no token changes it. */
export const radius = 0;
