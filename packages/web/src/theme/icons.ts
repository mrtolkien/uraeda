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

/** A cog, for the settings: Lucide's `settings`. */
const settings = outline(
  h("path", {
    d: "M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915",
  }),
  h("circle", { cx: 12, cy: 12, r: 3 }),
);

/** A pencil on a line, for a proposal to write: Lucide's `pencil-line`. */
const proposal = outline(
  h("path", { d: "M12 20h9" }),
  h("path", {
    d: "M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z",
  }),
);

/** A magnifying glass, for a discovery: Lucide's `search`. */
const discovery = outline(
  h("circle", { cx: 11, cy: 11, r: 8 }),
  h("path", { d: "m21 21-4.3-4.3" }),
);

/** A speech bubble holding a question mark, for questions: Lucide's `message-circle-question`. */
const questions = outline(
  h("path", { d: "M7.9 20A9 9 0 1 0 4 16.1L2 22Z" }),
  h("path", { d: "M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" }),
  h("path", { d: "M12 17h.01" }),
);

/** A page of text, for a spec: Lucide's `file-text`. */
const spec = outline(
  h("path", { d: "M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" }),
  h("path", { d: "M14 2v4a2 2 0 0 0 2 2h4" }),
  h("path", { d: "M16 13H8" }),
  h("path", { d: "M16 17H8" }),
);

/** A checklist, for a plan: Lucide's `list-checks`. */
const plan = outline(
  h("path", { d: "m3 17 2 2 4-4" }),
  h("path", { d: "m3 7 2 2 4-4" }),
  h("path", { d: "M13 6h8" }),
  h("path", { d: "M13 12h8" }),
  h("path", { d: "M13 18h8" }),
);

/** Angle brackets, for an implementation: Lucide's `code`. */
const implementation = outline(
  h("path", { d: "m16 18 6-6-6-6" }),
  h("path", { d: "m8 6-6 6 6 6" }),
);

/** An eye, for a review: Lucide's `eye`. */
const review = outline(
  h("path", {
    d: "M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0",
  }),
  h("circle", { cx: 12, cy: 12, r: 3 }),
);

/** Two branches joining, for a pull request: Lucide's `git-pull-request`. */
const pullRequest = outline(
  h("circle", { cx: 18, cy: 18, r: 3 }),
  h("circle", { cx: 6, cy: 6, r: 3 }),
  h("path", { d: "M13 6h3a2 2 0 0 1 2 2v7" }),
  h("line", { x1: 6, x2: 6, y1: 9, y2: 21 }),
);

/** A prompt, for a background command: Lucide's `terminal`. */
const terminal = outline(h("path", { d: "M12 19h8" }), h("path", { d: "m4 17 6-6-6-6" }));

/** A house, for the way home: Lucide's `house`. */
const home = outline(
  h("path", { d: "M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" }),
  h("path", {
    d: "M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
  }),
);

/** A window with its left side marked, for the sidebar's button: Lucide's `panel-left`. */
const panelLeft = outline(
  h("rect", { height: 18, rx: 2, width: 18, x: 3, y: 3 }),
  h("path", { d: "M9 3v18" }),
);

/** A window with its right side marked, for the right column's button: Lucide's `panel-right`. */
const panelRight = outline(
  h("rect", { height: 18, rx: 2, width: 18, x: 3, y: 3 }),
  h("path", { d: "M15 3v18" }),
);

export const uraedaIcons = {
  "uraeda:attach": attach,
  "uraeda:comment": comment,
  "uraeda:home": home,
  "uraeda:panel-left": panelLeft,
  "uraeda:panel-right": panelRight,
  "uraeda:pick": pick,
  "uraeda:settings": settings,
  "uraeda:step-discovery": discovery,
  "uraeda:step-implementation": implementation,
  "uraeda:step-plan": plan,
  "uraeda:step-proposal": proposal,
  "uraeda:step-pull-request": pullRequest,
  "uraeda:step-questions": questions,
  "uraeda:step-review": review,
  "uraeda:step-spec": spec,
  "uraeda:terminal": terminal,
};
