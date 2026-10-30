// Lucide's glyphs for the phone's bottom bar's buttons, beside `lucide.ts`, which is near its size
// limit. Written without JSX, which the theme's build does not compile; registered with Astryx by
// `icons.ts`.
import { createElement as h } from "react";
import { outline } from "./lucide.ts";

/** A triangle pointing on, for starting a proposal: Lucide's `play`. */
export const play = outline(
  h("path", {
    d: "M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z",
  }),
);
