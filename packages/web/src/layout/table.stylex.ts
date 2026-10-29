// A document's tables' own lengths (`Blocks.tsx`).
import * as stylex from "@stylexjs/stylex";

export const tableVars = stylex.defineVars({
  // How far a table reaches into the margin past its text where nothing sets `--table-reach`, as
  // a pane or a question's card do.
  "--table-reach-free": "16rem",
});
