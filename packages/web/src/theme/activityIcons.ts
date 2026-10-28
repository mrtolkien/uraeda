// Lucide's glyphs for the rows of a session's Activity, beside `sessionIcons.ts`. Written without
// JSX, which the theme's build does not compile; registered with Astryx by `icons.ts`.
import { createElement as h } from "react";
import { outline } from "./lucide.ts";

/** A brain, for a thought of the agent's: Lucide's `brain`. */
export const brain = outline(
  h("path", { d: "M12 18V5" }),
  h("path", { d: "M15 13a4.17 4.17 0 0 1-3-4 4.17 4.17 0 0 1-3 4" }),
  h("path", { d: "M17.598 6.5A3 3 0 1 0 12 5a3 3 0 1 0-5.598 1.5" }),
  h("path", { d: "M17.997 5.125a4 4 0 0 1 2.526 5.77" }),
  h("path", { d: "M18 18a4 4 0 0 0 2-7.464" }),
  h("path", { d: "M19.967 17.483A4 4 0 1 1 12 18a4 4 0 1 1-7.967-.517" }),
  h("path", { d: "M6 18a4 4 0 0 1-2-7.464" }),
  h("path", { d: "M6.003 5.125a4 4 0 0 0-2.526 5.77" }),
);

/** A bin, for a file the agent deleted: Lucide's `trash-2`. */
export const trash = outline(
  h("path", { d: "M10 11v6" }),
  h("path", { d: "M14 11v6" }),
  h("path", { d: "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" }),
  h("path", { d: "M3 6h18" }),
  h("path", { d: "M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" }),
);

/** Lines with an arrow in, for a row of a list that indents: Lucide's `list-indent-increase`. */
export const indent = outline(
  h("path", { d: "M21 12H11" }),
  h("path", { d: "M21 18H11" }),
  h("path", { d: "M21 6H11" }),
  h("path", { d: "m3 8 4 4-4 4" }),
);

/** Lines with an arrow out, for a row of a list that outdents: Lucide's `list-indent-decrease`. */
export const outdent = outline(
  h("path", { d: "M21 12H11" }),
  h("path", { d: "M21 18H11" }),
  h("path", { d: "M21 6H11" }),
  h("path", { d: "m7 8-4 4 4 4" }),
);

/** Two arrows, for a file the agent moved: Lucide's `arrow-right-left`. */
export const arrowRightLeft = outline(
  h("path", { d: "m16 3 4 4-4 4" }),
  h("path", { d: "M20 7H4" }),
  h("path", { d: "m8 21-4-4 4-4" }),
  h("path", { d: "M4 17h16" }),
);
