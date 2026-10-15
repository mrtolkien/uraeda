// The app's own icons, registered with Astryx through the theme (`theme.ts`): Astryx has none of
// them. Written without JSX, which the theme's build does not compile.
import { createElement as h } from "react";

/** A paperclip, for attaching images: the outline of Lucide's, at the neutral theme's size. */
const attach = h(
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
  h("path", {
    d: "m16 6-8.414 8.586a2 2 0 0 0 2.829 2.829l8.414-8.586a4 4 0 1 0-5.657-5.657l-8.379 8.551a6 6 0 1 0 8.485 8.485l8.379-8.551",
  }),
);

/** The outline of a Lucide icon, at the neutral theme's size, from its elements. */
const outline = (...children: Array<ReturnType<typeof h>>) =>
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

/** A crosshair, for picking an element of a story: Lucide's. */
const pick = outline(
  h("circle", { cx: 12, cy: 12, r: 10 }),
  h("line", { x1: 22, x2: 18, y1: 12, y2: 12 }),
  h("line", { x1: 6, x2: 2, y1: 12, y2: 12 }),
  h("line", { x1: 12, x2: 12, y1: 6, y2: 2 }),
  h("line", { x1: 12, x2: 12, y1: 22, y2: 18 }),
);

/** A speech bubble, for commenting: Lucide's `message-square`. */
const comment = outline(
  h("path", { d: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" }),
);

export const uraedaIcons = {
  "uraeda:attach": attach,
  "uraeda:comment": comment,
  "uraeda:pick": pick,
};
