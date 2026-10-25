// Lucide's glyphs for the spec's parts and the New page's cards, beside `lucide.ts`, which is near
// its size limit. Written
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

/** A badge with a check, for what a spec asks you to approve: Lucide's `badge-check`. */
export const badgeCheck = outline(
  h("path", {
    d: "M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z",
  }),
  h("path", { d: "m9 12 2 2 4-4" }),
);

/** A folded map, for a spec's user stories: Lucide's `map`. */
export const map = outline(
  h("path", {
    d: "M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z",
  }),
  h("path", { d: "M15 5.764v15" }),
  h("path", { d: "M9 3.236v15" }),
);

/** A pair of scales, for a spec's decisions: Lucide's `scale`. */
export const scale = outline(
  h("path", { d: "m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" }),
  h("path", { d: "m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" }),
  h("path", { d: "M7 21h10" }),
  h("path", { d: "M12 3v18" }),
  h("path", { d: "M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2" }),
);

/** An hourglass, for what waits on you in a New page's card: Lucide's `hourglass`. */
export const hourglass = outline(
  h("path", { d: "M5 22h14" }),
  h("path", { d: "M5 2h14" }),
  h("path", {
    d: "M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22",
  }),
  h("path", { d: "M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2" }),
);
