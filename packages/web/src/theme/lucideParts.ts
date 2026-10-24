// Lucide's glyphs for the spec's parts, beside `lucide.ts`, which is near its size limit. Written
// without JSX, which the theme's build does not compile; registered with Astryx by `icons.ts`.
import { createElement as h } from "react";
import { outline } from "./lucide.ts";

/** A shield, for a spec's edge cases: Lucide's `shield`. */
export const shield = outline(
  h("path", {
    d: "M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z",
  }),
);

/** A light bulb, for a spec's assumptions: Lucide's `lightbulb`. */
export const lightbulb = outline(
  h("path", {
    d: "M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5",
  }),
  h("path", { d: "M9 18h6" }),
  h("path", { d: "M10 22h4" }),
);
