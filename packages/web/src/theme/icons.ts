// The app's own icons, registered with Astryx through the theme (`theme.ts`): Astryx has none of
// them. Written without JSX, which the theme's build does not compile.
import { createElement as h } from "react";

/** A paperclip, for attaching images: the outline of Lucide's, at the neutral theme's size. */
const attach = h(
  "svg",
  {
    width: "1em",
    height: "1em",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
  },
  h("path", {
    d: "m16 6-8.414 8.586a2 2 0 0 0 2.829 2.829l8.414-8.586a4 4 0 1 0-5.657-5.657l-8.379 8.551a6 6 0 1 0 8.485 8.485l8.379-8.551",
  }),
);

export const uraedaIcons = { "uraeda:attach": attach };
