// Lucide's glyphs for text editing, beside `lucide.ts`, which is near its size limit. Written
// without JSX, which the theme's build does not compile; registered with Astryx by `icons.ts`.
import { createElement as h } from "react";
import { outline } from "./lucide.ts";

/** A field with its caret, for the Text editing decision: Lucide's `text-cursor-input`. */
export const textCursorInput = outline(
  h("path", { d: "M12 20h-1a2 2 0 0 1-2-2 2 2 0 0 1-2 2H6" }),
  h("path", { d: "M13 8h7a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-7" }),
  h("path", { d: "M5 16H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h1" }),
  h("path", { d: "M6 4h1a2 2 0 0 1 2 2 2 2 0 0 1 2-2h1" }),
  h("path", { d: "M9 6v12" }),
);
