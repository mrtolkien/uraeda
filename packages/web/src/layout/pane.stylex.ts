// The panes' own tokens, global: one value each for every pane of the app, which a part of the page
// may set otherwise for the panes in it, as the shell's column does.
import * as stylex from "@stylexjs/stylex";

export const paneVars = stylex.defineVars({
  // The room under a pane's last line, a button's too: the room under its title, `--spacing-3`,
  // so that a pane ending with a button does not end tight on it.
  "--pane-end": "0.75rem",
  // A pane of prose's widest, a reading page's: its prose about 80 characters a line, filling it
  // to its border (the theme's `--size-reading-pane`).
  "--pane-prose": "var(--size-reading-pane)",
  // A pane of a file's text's widest, a draft's editor's: the formatter's 100 columns of the UI's
  // monospace font, not prose, with the pane's and the field's room around them.
  "--pane-code": "108ch",
  // The least room a title's suffix takes in the title's line before it wraps under it: a few
  // words of its own text.
  "--pane-suffix-least": "12ch",
  // A pixel a title's button stands over a control's height, so a line's fractional height cannot
  // round it under (`Pane.tsx`, `lists/CategoryPane.tsx`).
  "--pane-title-slack": "1px",
});
