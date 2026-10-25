// Lucide's glyphs for the session's column, beside `lucide.ts`, which is near its size limit.
// Written without JSX, which the theme's build does not compile; registered with Astryx by
// `icons.ts`.
import { createElement as h } from "react";
import { outline } from "./lucide.ts";

/** Two branches compared, for the files a session changed: Lucide's `git-compare`. */
export const gitCompare = outline(
  h("circle", { cx: 18, cy: 18, r: 3 }),
  h("circle", { cx: 6, cy: 6, r: 3 }),
  h("path", { d: "M13 6h3a2 2 0 0 1 2 2v7" }),
  h("path", { d: "M11 18H8a2 2 0 0 1-2-2V9" }),
);

/** A list with two ticks, for the plan's progress: Lucide's `list-checks`. */
export const listChecks = outline(
  h("path", { d: "m3 17 2 2 4-4" }),
  h("path", { d: "m3 7 2 2 4-4" }),
  h("path", { d: "M13 6h8" }),
  h("path", { d: "M13 12h8" }),
  h("path", { d: "M13 18h8" }),
);

/** A file with a pen, for a file the session edited: Lucide's `file-pen-line`. */
export const filePenLine = outline(
  h("path", {
    d: "m18 5-2.414-2.414A2 2 0 0 0 14.172 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2",
  }),
  h("path", {
    d: "M21.378 12.626a1 1 0 0 0-3.004-3.004l-4.01 4.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z",
  }),
  h("path", { d: "M8 18h1" }),
);

/** Two people, for the session's sub-agents: Lucide's `users`. */
export const users = outline(
  h("path", { d: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" }),
  h("path", { d: "M16 3.128a4 4 0 0 1 0 7.744" }),
  h("path", { d: "M22 21v-2a4 4 0 0 0-3-3.87" }),
  h("circle", { cx: 9, cy: 7, r: 4 }),
);
