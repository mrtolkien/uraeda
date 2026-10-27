// Lucide's glyphs the app draws itself, at the neutral theme's size: `lucide-react` is not a
// dependency of the app. Written without JSX, which the theme's build does not compile; registered
// with Astryx by `icons.ts`.
import { createElement as h } from "react";

/** A paperclip, for attaching images: the outline of Lucide's, at the neutral theme's size. */
export const attach = h(
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

/** A crosshair, for picking an element of a story: Lucide's. */
export const pick = outline(
  h("circle", { cx: 12, cy: 12, r: 10 }),
  h("line", { x1: 22, x2: 18, y1: 12, y2: 12 }),
  h("line", { x1: 6, x2: 2, y1: 12, y2: 12 }),
  h("line", { x1: 12, x2: 12, y1: 6, y2: 2 }),
  h("line", { x1: 12, x2: 12, y1: 22, y2: 18 }),
);

/** A speech bubble, for commenting: Lucide's `message-square`. */
export const comment = outline(
  h("path", { d: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" }),
);

/** A cog, for the settings: Lucide's `settings`. */
export const settings = outline(
  h("path", {
    d: "M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915",
  }),
  h("circle", { cx: 12, cy: 12, r: 3 }),
);

/** A pencil on a line, for a proposal to write: Lucide's `pencil-line`. */
export const proposal = outline(
  h("path", { d: "M12 20h9" }),
  h("path", {
    d: "M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z",
  }),
);

/** A magnifying glass, for a discovery: Lucide's `search`. */
export const discovery = outline(
  h("circle", { cx: 11, cy: 11, r: 8 }),
  h("path", { d: "m21 21-4.3-4.3" }),
);

/** A speech bubble holding a question mark, for questions: Lucide's `message-circle-question`. */
export const questions = outline(
  h("path", { d: "M7.9 20A9 9 0 1 0 4 16.1L2 22Z" }),
  h("path", { d: "M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" }),
  h("path", { d: "M12 17h.01" }),
);

/** A page of text, for a spec: Lucide's `file-text`. */
export const spec = outline(
  h("path", { d: "M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" }),
  h("path", { d: "M14 2v4a2 2 0 0 0 2 2h4" }),
  h("path", { d: "M16 13H8" }),
  h("path", { d: "M16 17H8" }),
);

/** A checklist, for a plan: Lucide's `list-checks`. */
export const plan = outline(
  h("path", { d: "m3 17 2 2 4-4" }),
  h("path", { d: "m3 7 2 2 4-4" }),
  h("path", { d: "M13 6h8" }),
  h("path", { d: "M13 12h8" }),
  h("path", { d: "M13 18h8" }),
);

/** Angle brackets, for an implementation: Lucide's `code`. */
export const implementation = outline(
  h("path", { d: "m16 18 6-6-6-6" }),
  h("path", { d: "m8 6-6 6 6 6" }),
);

/** An eye, for a review: Lucide's `eye`. */
export const review = outline(
  h("path", {
    d: "M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0",
  }),
  h("circle", { cx: 12, cy: 12, r: 3 }),
);

/** Two branches joining, for a pull request: Lucide's `git-pull-request`. */
export const pullRequest = outline(
  h("circle", { cx: 18, cy: 18, r: 3 }),
  h("circle", { cx: 6, cy: 6, r: 3 }),
  h("path", { d: "M13 6h3a2 2 0 0 1 2 2v7" }),
  h("line", { x1: 6, x2: 6, y1: 9, y2: 21 }),
);

/** A prompt, for a background command: Lucide's `terminal`. */
export const terminal = outline(h("path", { d: "M12 19h8" }), h("path", { d: "m4 17 6-6-6-6" }));

/** A house, for the way home: Lucide's `house`. */
export const home = outline(
  h("path", { d: "M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" }),
  h("path", {
    d: "M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
  }),
);

/** A window with its left side marked, for the sidebar's button: Lucide's `panel-left`. */
export const panelLeft = outline(
  h("rect", { height: 18, rx: 2, width: 18, x: 3, y: 3 }),
  h("path", { d: "M9 3v18" }),
);

/** A box in three columns, for a list shown as columns: Lucide's `columns-3`. */
export const columns3 = outline(
  h("rect", { height: 18, rx: 2, width: 18, x: 3, y: 3 }),
  h("path", { d: "M9 3v18" }),
  h("path", { d: "M15 3v18" }),
);

/** A box in three rows, for a list shown as one table: Lucide's `rows-3`. */
export const rows3 = outline(
  h("rect", { height: 18, rx: 2, width: 18, x: 3, y: 3 }),
  h("path", { d: "M21 9H3" }),
  h("path", { d: "M21 15H3" }),
);

/** A window with its right side marked, for the right column's button: Lucide's `panel-right`. */
export const panelRight = outline(
  h("rect", { height: 18, rx: 2, width: 18, x: 3, y: 3 }),
  h("path", { d: "M15 3v18" }),
);

// The shell's rows and tabs.

/** A tray, for the inbox: Lucide's `inbox`. */
export const inbox = outline(
  h("polyline", { points: "22 12 16 12 14 15 10 15 8 12 2 12" }),
  h("path", {
    d: "M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z",
  }),
);

/** A list, for the priorities: Lucide's `list`. */
export const list = outline(
  h("path", { d: "M3 5h.01" }),
  h("path", { d: "M3 12h.01" }),
  h("path", { d: "M3 19h.01" }),
  h("path", { d: "M8 5h13" }),
  h("path", { d: "M8 12h13" }),
  h("path", { d: "M8 19h13" }),
);

/** A plus, for starting something new: Lucide's `plus`. */
export const plus = outline(h("path", { d: "M5 12h14" }), h("path", { d: "M12 5v14" }));

/** A pencil, for jotting a note down: Lucide's `pencil`. */
export const pencil = outline(
  h("path", {
    d: "M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z",
  }),
  h("path", { d: "m15 5 4 4" }),
);

/** A pulse, for the sessions at work: Lucide's `activity`. */
export const activity = outline(
  h("path", {
    d: "M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2",
  }),
);

/** The Enter key, for the button Enter presses: Lucide's `corner-down-left`. */
export const enter = outline(
  h("path", { d: "M20 4v7a4 4 0 0 1-4 4H4" }),
  h("path", { d: "m9 10-5 5 5 5" }),
);

// The decisions' icons, by their Lucide name in a decision's frontmatter (R2): those
// `specs/decisions/` uses, and `file-text`, the default for a name not registered here.

/** Lucide's `bot`. */
export const bot = outline(
  h("path", { d: "M12 8V4H8" }),
  h("rect", { height: 12, rx: 2, width: 16, x: 4, y: 8 }),
  h("path", { d: "M2 14h2" }),
  h("path", { d: "M20 14h2" }),
  h("path", { d: "M15 13v2" }),
  h("path", { d: "M9 13v2" }),
);

/** Lucide's `circle-dot`, a scenario's Given: where it starts. */
export const given = outline(
  h("circle", { cx: 12, cy: 12, r: 10 }),
  h("circle", { cx: 12, cy: 12, r: 1 }),
);

/** Lucide's `mouse-pointer-click`, a scenario's When: what you do. */
export const when = outline(
  h("path", { d: "M14 4.1 12 6" }),
  h("path", { d: "m5.1 8-2.9-.8" }),
  h("path", { d: "m6 12-1.9 2" }),
  h("path", { d: "M7.2 2.2 8 5.1" }),
  h("path", {
    d: "M9.037 9.69a.498.498 0 0 1 .653-.653l11 4.5a.5.5 0 0 1-.074.949l-4.349 1.041a1 1 0 0 0-.74.739l-1.04 4.35a.5.5 0 0 1-.95.074z",
  }),
);

/** Lucide's `arrow-right`, a scenario's Then: what follows. */
export const then = outline(h("path", { d: "M5 12h14" }), h("path", { d: "m12 5 7 7-7 7" }));

/** Lucide's `bell`. */
export const bell = outline(
  h("path", { d: "M10.268 21a2 2 0 0 0 3.464 0" }),
  h("path", {
    d: "M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326",
  }),
);

/** Lucide's `calendar-clock`. */
export const calendarClock = outline(
  h("path", { d: "M16 14v2.2l1.6 1" }),
  h("path", { d: "M16 2v3" }),
  h("path", { d: "M21 7.338V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2h2.338" }),
  h("path", { d: "M3 9h5.859" }),
  h("path", { d: "M8 2v3" }),
  h("circle", { cx: "16", cy: "16", r: "6" }),
);

/** Lucide's `component`. */
export const component = outline(
  h("path", {
    d: "M15.536 11.293a1 1 0 0 0 0 1.414l2.376 2.377a1 1 0 0 0 1.414 0l2.377-2.377a1 1 0 0 0 0-1.414l-2.377-2.377a1 1 0 0 0-1.414 0z",
  }),
  h("path", {
    d: "M2.297 11.293a1 1 0 0 0 0 1.414l2.377 2.377a1 1 0 0 0 1.414 0l2.377-2.377a1 1 0 0 0 0-1.414L6.088 8.916a1 1 0 0 0-1.414 0z",
  }),
  h("path", {
    d: "M8.916 17.912a1 1 0 0 0 0 1.415l2.377 2.376a1 1 0 0 0 1.414 0l2.377-2.376a1 1 0 0 0 0-1.415l-2.377-2.376a1 1 0 0 0-1.414 0z",
  }),
  h("path", {
    d: "M8.916 4.674a1 1 0 0 0 0 1.414l2.377 2.376a1 1 0 0 0 1.414 0l2.377-2.376a1 1 0 0 0 0-1.414l-2.377-2.377a1 1 0 0 0-1.414 0z",
  }),
);

/** Lucide's `database`. */
export const database = outline(
  h("ellipse", { cx: "12", cy: "5", rx: "9", ry: "3" }),
  h("path", { d: "M3 5V19A9 3 0 0 0 21 19V5" }),
  h("path", { d: "M3 12A9 3 0 0 0 21 12" }),
);

/** Lucide's `folder-git-2`. */
export const folderGit2 = outline(
  h("path", { d: "M18 19a5 5 0 0 1-5-5v8" }),
  h("path", {
    d: "M9 20H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H20a2 2 0 0 1 2 2v5",
  }),
  h("circle", { cx: 13, cy: 12, r: 2 }),
  h("circle", { cx: 20, cy: 19, r: 2 }),
);

/** Lucide's `flask-conical`. */
export const flaskConical = outline(
  h("path", {
    d: "M14 2v6a2 2 0 0 0 .245.96l5.51 10.08A2 2 0 0 1 18 22H6a2 2 0 0 1-1.755-2.96l5.51-10.08A2 2 0 0 0 10 8V2",
  }),
  h("path", { d: "M6.453 15h11.094" }),
  h("path", { d: "M8.5 2h7" }),
);

/** Lucide's `git-branch`. */
export const gitBranch = outline(
  h("path", { d: "M15 6a9 9 0 0 0-9 9V3" }),
  h("circle", { cx: 18, cy: 6, r: 3 }),
  h("circle", { cx: 6, cy: 18, r: 3 }),
);

/** Lucide's `key-round`. */
export const keyRound = outline(
  h("path", {
    d: "M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z",
  }),
  h("circle", { cx: 16.5, cy: 7.5, fill: "currentColor", r: 0.5 }),
);

/** Lucide's `layers`. */
export const layers = outline(
  h("path", {
    d: "M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z",
  }),
  h("path", { d: "M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12" }),
  h("path", { d: "M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17" }),
);

/** Lucide's `layout-template`. */
export const layoutTemplate = outline(
  h("rect", { height: 7, rx: 1, width: 18, x: 3, y: 3 }),
  h("rect", { height: 7, rx: 1, width: 9, x: 3, y: 14 }),
  h("rect", { height: 7, rx: 1, width: 5, x: 16, y: 14 }),
);

/** Lucide's `layout-panel-left`. */
export const layoutPanelLeft = outline(
  h("rect", { height: 18, rx: 1, width: 7, x: 3, y: 3 }),
  h("rect", { height: 7, rx: 1, width: 7, x: 14, y: 3 }),
  h("rect", { height: 7, rx: 1, width: 7, x: 14, y: 14 }),
);

/** Lucide's `mouse-pointer-click`. */
export const mousePointerClick = outline(
  h("path", { d: "M14 4.1 12 6" }),
  h("path", { d: "m5.1 8-2.9-.8" }),
  h("path", { d: "m6 12-1.9 2" }),
  h("path", { d: "M7.2 2.2 8 5.1" }),
  h("path", {
    d: "M9.037 9.69a.498.498 0 0 1 .653-.653l11 4.5a.5.5 0 0 1-.074.949l-4.349 1.041a1 1 0 0 0-.74.739l-1.04 4.35a.5.5 0 0 1-.95.074z",
  }),
);

/** Lucide's `package`. */
/** Lucide's `palette`. */
export const palette = outline(
  h("path", {
    d: "M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z",
  }),
  h("circle", { cx: 13.5, cy: 6.5, fill: "currentColor", r: 0.5 }),
  h("circle", { cx: 17.5, cy: 10.5, fill: "currentColor", r: 0.5 }),
  h("circle", { cx: 6.5, cy: 12.5, fill: "currentColor", r: 0.5 }),
  h("circle", { cx: 8.5, cy: 7.5, fill: "currentColor", r: 0.5 }),
);

export const packageIcon = outline(
  h("path", {
    d: "M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z",
  }),
  h("path", { d: "M12 22V12" }),
  h("polyline", { points: "3.29 7 12 12 20.71 7" }),
  h("path", { d: "m7.5 4.27 9 5.15" }),
);

/** Lucide's `gauge`. */
export const gauge = outline(
  h("path", { d: "m12 14 4-4" }),
  h("path", { d: "M3.34 19a10 10 0 1 1 17.32 0" }),
);

/** Lucide's `repeat`. */
export const repeat = outline(
  h("path", { d: "m17 2 4 4-4 4" }),
  h("path", { d: "M3 11v-1a4 4 0 0 1 4-4h14" }),
  h("path", { d: "m7 22-4-4 4-4" }),
  h("path", { d: "M21 13v1a4 4 0 0 1-4 4H3" }),
);

/** Lucide's `ruler`. */
export const ruler = outline(
  h("path", {
    d: "M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z",
  }),
  h("path", { d: "m14.5 12.5 2-2" }),
  h("path", { d: "m11.5 9.5 2-2" }),
  h("path", { d: "m8.5 6.5 2-2" }),
  h("path", { d: "m17.5 15.5 2-2" }),
);

/** Lucide's `scan-eye`. */
export const scanEye = outline(
  h("path", { d: "M3 7V5a2 2 0 0 1 2-2h2" }),
  h("path", { d: "M17 3h2a2 2 0 0 1 2 2v2" }),
  h("path", { d: "M21 17v2a2 2 0 0 1-2 2h-2" }),
  h("path", { d: "M7 21H5a2 2 0 0 1-2-2v-2" }),
  h("circle", { cx: 12, cy: 12, r: 1 }),
  h("path", {
    d: "M18.944 12.33a1 1 0 0 0 0-.66 7.5 7.5 0 0 0-13.888 0 1 1 0 0 0 0 .66 7.5 7.5 0 0 0 13.888 0",
  }),
);

/** Lucide's `triangle-alert`. */
export const triangleAlert = outline(
  h("path", { d: "m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" }),
  h("path", { d: "M12 9v4" }),
  h("path", { d: "M12 17h.01" }),
);

/** Lucide's `square-terminal`. */
export const squareTerminal = outline(
  h("path", { d: "m7 11 2-2-2-2" }),
  h("path", { d: "M11 13h4" }),
  h("rect", { height: 18, rx: 2, ry: 2, width: 18, x: 3, y: 3 }),
);

/** Lucide's `wrench`. */
export const wrench = outline(
  h("path", {
    d: "M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.106-3.105c.32-.322.863-.22.983.218a6 6 0 0 1-8.259 7.057l-7.91 7.91a1 1 0 0 1-2.999-3l7.91-7.91a6 6 0 0 1 7.057-8.259c.438.12.54.662.219.984z",
  }),
);

/** Lucide's `history`. */
export const history = outline(
  h("path", { d: "M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" }),
  h("path", { d: "M3 3v5h5" }),
  h("path", { d: "M12 7v5l4 2" }),
);

/** Lucide's `workflow`. */
export const workflow = outline(
  h("rect", { height: 8, rx: 2, width: 8, x: 3, y: 3 }),
  h("path", { d: "M7 11v4a2 2 0 0 0 2 2h4" }),
  h("rect", { height: 8, rx: 2, width: 8, x: 13, y: 13 }),
);

/** Lucide's `file-text`. */
export const fileText = outline(
  h("path", {
    d: "M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z",
  }),
  h("path", { d: "M14 2v5a1 1 0 0 0 1 1h5" }),
  h("path", { d: "M10 9H8" }),
  h("path", { d: "M16 13H8" }),
  h("path", { d: "M16 17H8" }),
);

/** Lucide's `server`, for the server's settings. */
export const server = outline(
  h("rect", { height: 8, rx: 2, width: 20, x: 2, y: 2 }),
  h("rect", { height: 8, rx: 2, width: 20, x: 2, y: 14 }),
  h("path", { d: "M6 6h.01" }),
  h("path", { d: "M6 18h.01" }),
);

/** Lucide's `globe`, for the host names the server answers to. */
export const globe = outline(
  h("circle", { cx: 12, cy: 12, r: 10 }),
  h("path", { d: "M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" }),
  h("path", { d: "M2 12h20" }),
);

/** Lucide's `plug`, for the server's port. */
export const plug = outline(
  h("path", { d: "M12 22v-5" }),
  h("path", { d: "M9 8V2" }),
  h("path", { d: "M15 8V2" }),
  h("path", { d: "M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z" }),
);

/** Lucide's `log-out`, for signing out. */
export const logOut = outline(
  h("path", { d: "m16 17 5-5-5-5" }),
  h("path", { d: "M21 12H9" }),
  h("path", { d: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" }),
);

/** A target, for a round's goal: Lucide's `target`. */
export const target = outline(
  h("circle", { cx: 12, cy: 12, r: 10 }),
  h("circle", { cx: 12, cy: 12, r: 6 }),
  h("circle", { cx: 12, cy: 12, r: 2 }),
);

/** A crop, for a round's scope: Lucide's `crop`. */
export const crop = outline(
  h("path", { d: "M6 2v14a2 2 0 0 0 2 2h14" }),
  h("path", { d: "M18 22V8a2 2 0 0 0-2-2H2" }),
);

/** An open book, for a round's sources: Lucide's `book-open`. */
export const bookOpen = outline(
  h("path", { d: "M12 7v14" }),
  h("path", {
    d: "M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z",
  }),
);

/** A flag, for the points a round asks to check: Lucide's `flag`. */
export const flag = outline(
  h("path", { d: "M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" }),
  h("path", { d: "M4 22v-7" }),
);

/** A space bar, for the Space key: Lucide's `space`. */
export const space = outline(h("path", { d: "M22 17v1c0 .5-.5 1-1 1H3c-.5 0-1-.5-1-1v-1" }));
