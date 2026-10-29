// How the app draws a Lucide glyph itself: its outline, from its elements. Written without JSX,
// which the theme's build does not compile; `lucide.ts` and the icon files beside it draw with it.
import { createElement as h } from "react";

/** The outline of a Lucide icon, at the neutral theme's size, from its elements. */
export const outline = (...children: Array<ReturnType<typeof h>>) =>
  h(
    "svg",
    {
      "aria-hidden": true,
      fill: "none",
      height: "1em",
      stroke: "currentColor",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      strokeWidth: 2,
      viewBox: "0 0 24 24",
      width: "1em",
    },
    ...children,
  );
