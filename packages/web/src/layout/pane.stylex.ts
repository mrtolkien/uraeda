// The panes' own tokens, global: one value each for every pane of the app, which a part of the page
// may set otherwise for the panes in it, as the shell's column does.
import * as stylex from "@stylexjs/stylex";

export const paneVars = stylex.defineVars({
  // The room under a pane's last line, a button's too: the room under its title, `--spacing-3`,
  // so that a pane ending with a button does not end tight on it.
  "--pane-end": "0.75rem",
});
