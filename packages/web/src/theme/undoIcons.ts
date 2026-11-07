// Lucide's glyph of undo, for the Undo decision. Written without JSX, which the theme's build does
// not compile; registered with Astryx by `icons.ts`.
import { createElement as h } from "react";
import { outline } from "./lucide.ts";

/** An arrow turning back: Lucide's `undo-2`. */
export const undo2 = outline(
  h("path", { d: "M9 14 4 9l5-5" }),
  h("path", { d: "M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11" }),
);
