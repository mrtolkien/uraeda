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

/** A floppy disk, for committing the saved edits: Lucide's `save`. */
export const save = outline(
  h("path", {
    d: "M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z",
  }),
  h("path", { d: "M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7" }),
  h("path", { d: "M7 3v4a1 1 0 0 0 1 1h7" }),
);
