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

// The Vim modes' marks in the status line (`shell/status/Mode.tsx`): NAV's `compass`, NORMAL's
// `square`, the visual modes' `square-dashed`, REPLACE's `replace`. INSERT's `pencil` and COMMAND's
// `terminal` are in `lucide.ts`.

/** Lucide's `compass`: the page's keys, outside any field. */
export const compass = outline(
  h("circle", { cx: 12, cy: 12, r: 10 }),
  h("path", {
    d: "m16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z",
  }),
);

/** Lucide's `square`: Vim's normal mode, its cursor a block. */
export const square = outline(h("rect", { height: 18, rx: 2, width: 18, x: 3, y: 3 }));

/** Lucide's `square-dashed`: Vim's visual modes, a selection. */
export const squareDashed = outline(
  ...[
    "M5 3a2 2 0 0 0-2 2",
    "M19 3a2 2 0 0 1 2 2",
    "M21 19a2 2 0 0 1-2 2",
    "M5 21a2 2 0 0 1-2-2",
    "M9 3h1",
    "M9 21h1",
    "M14 3h1",
    "M14 21h1",
    "M3 9v1",
    "M21 9v1",
    "M3 14v1",
    "M21 14v1",
  ].map((d) => h("path", { d, key: d })),
);

/** Lucide's `replace`: Vim's replace mode. */
export const replace = outline(
  h("path", { d: "M14 4a1 1 0 0 1 1-1" }),
  h("path", { d: "M15 10a1 1 0 0 1-1-1" }),
  h("path", { d: "M21 4a1 1 0 0 0-1-1" }),
  h("path", { d: "M21 9a1 1 0 0 1-1 1" }),
  h("path", { d: "m3 7 3 3 3-3" }),
  h("path", { d: "M6 10V5a2 2 0 0 1 2-2h2" }),
  h("rect", { height: 7, rx: 1, width: 7, x: 3, y: 14 }),
);

/** Lucide's `swatch-book`: the Colour themes decision's icon. */
export const swatchBook = outline(
  h("path", { d: "M11 17a4 4 0 0 1-8 0V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2Z" }),
  h("path", { d: "M16.7 13H19a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H7" }),
  h("path", { d: "M 7 17h.01" }),
  h("path", {
    d: "m11 8 2.3-2.3a2.4 2.4 0 0 1 3.404.004L18.6 7.6a2.4 2.4 0 0 1 .026 3.434L9.9 19.8",
  }),
);
