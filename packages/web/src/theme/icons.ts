// The app's own icons, registered with Astryx through the theme (`theme.ts`): Astryx has none of
// them. Written without JSX, which the theme's build does not compile.
import { createElement as h } from "react";
import {
  activity,
  attach,
  bell,
  bookOpen,
  bot,
  calendarClock,
  comment,
  component,
  crop,
  database,
  discovery,
  enter,
  fileText,
  flag,
  flaskConical,
  folderGit2,
  gauge,
  gitBranch,
  given,
  globe,
  history,
  home,
  implementation,
  inbox,
  keyRound,
  layers,
  layoutPanelLeft,
  layoutTemplate,
  list,
  logOut,
  mousePointerClick,
  packageIcon,
  palette,
  panelLeft,
  panelRight,
  pencil,
  pick,
  plan,
  plug,
  plus,
  proposal,
  pullRequest,
  questions,
  repeat,
  review,
  ruler,
  scanEye,
  server,
  settings,
  spec,
  squareTerminal,
  target,
  terminal,
  then,
  triangleAlert,
  when,
  workflow,
  wrench,
  outline,
} from "./lucide.ts";
import { maximize, minimize, monitor, smartphone } from "./windowIcons.ts";
import { badgeCheck, lightbulb, map, scale, shield } from "./lucideParts.ts";

// The harnesses' marks: Codicons' drawings (https://github.com/microsoft/vscode-codicons), by
// Microsoft, under the Creative Commons Attribution 4.0 licence (CC BY 4.0), unchanged. The README's
// credits name them too.

/** A Codicons glyph, filled on its 16-unit grid, at the neutral theme's size. */
const codicon = (d: string) =>
  h(
    "svg",
    {
      "aria-hidden": true,
      fill: "currentColor",
      height: "1em",
      viewBox: "0 0 16 16",
      width: "1em",
    },
    h("path", { d }),
  );

/** Codicons' `claude`, for Claude Code. */
const claude = codicon(
  "M7.09001 14.3L7.29001 13.43L7.51001 12.31L7.69001 11.41L7.86001 10.3L7.96001 9.93998V9.90998L7.88001 9.91998L7.04001 11.07L5.77001 12.79L4.76001 13.85L4.52001 13.95L4.10001 13.74L4.14001 13.35L4.38001 13.01L5.77001 11.23L6.61001 10.12L7.16001 9.48998V9.40998H7.12001L3.42001 11.82L2.76001 11.9L2.47001 11.63L2.51001 11.2L2.65001 11.06L3.76001 10.29L6.52001 8.74998L6.56001 8.60998L6.52001 8.53998H6.38001L5.92001 8.50998L4.35001 8.46998L2.99001 8.40998L1.66001 8.33998L1.32001 8.26998L1.01001 7.84998L1.04001 7.63998L1.32001 7.45998L1.73001 7.48998L2.61001 7.55998L3.94001 7.63998L4.91001 7.69998L6.34001 7.84998H6.56001L6.59001 7.74998L6.52001 7.68998L6.46001 7.62998L5.07001 6.70998L3.59001 5.72998L2.81001 5.15998L2.39001 4.86998L2.18001 4.59998L2.10001 4.00998L2.48001 3.58998L3.00001 3.62998L3.13001 3.65998L3.65001 4.06998L4.76001 4.91998L6.22001 5.99998L6.43001 6.16998L6.53001 6.10998V6.06998L6.43001 5.91998L5.65001 4.48998L4.81001 3.02998L4.43001 2.42998L4.33001 2.06998C4.29001 1.93998 4.27001 1.79998 4.27001 1.64998L4.70001 1.05998L4.94001 0.97998L5.53001 1.05998L5.77001 1.26998L6.13001 2.09998L6.70001 3.39998L7.61001 5.15998L7.88001 5.68998L8.02001 6.16998L8.08001 6.31998H8.18001V6.23998L8.25001 5.22998L8.39001 4.00998L8.53001 2.43998L8.57001 1.98998L8.79001 1.45998L9.22001 1.17998L9.56001 1.32998L9.84001 1.73998L9.80001 1.98998L9.65001 3.06998L9.31001 4.75998L9.10001 5.90998H9.23001L9.37001 5.75998L9.94001 4.99998L10.91 3.79998L11.33 3.31998L11.83 2.78998L12.15 2.53998H12.75L13.18 3.19998L12.98 3.88998L12.36 4.66998L11.84 5.32998L11.1 6.31998L10.65 7.11998L10.69 7.17998H10.79L12.46 6.81998L13.37 6.66998L14.43 6.48998L14.92 6.70998L14.98 6.92998L14.78 7.40998L13.63 7.68998L12.29 7.95998L10.29 8.43998H10.26L10.29 8.49998L11.19 8.57998L11.58 8.60998H12.53L14.29 8.73998L14.75 9.04998L15.02 9.40998L14.98 9.69998L14.27 10.05L13.32 9.82998L11.08 9.29998L10.32 9.11998H10.21V9.17998L10.85 9.80998L12.01 10.86L13.48 12.22L13.55 12.56L13.37 12.84L13.17 12.81L11.88 11.83L11.38 11.4L10.26 10.46H10.19V10.56L10.44 10.94L11.81 13L11.88 13.63L11.78 13.83L11.42 13.96L11.04 13.89L10.23 12.77L9.40001 11.5L8.73001 10.37L8.66001 10.43L8.25001 14.66L8.07001 14.87L7.65001 15.04L7.30001 14.77L7.10001 14.34L7.09001 14.3Z",
);

/** Codicons' `openai`, for Codex. */
const openai = codicon(
  "M13.67 6.1C13.98 5.21 13.91 4.23 13.44 3.42C12.58 1.93 10.72 1.4 9.19996 2.14C8.58996 1.43 7.70996 1 6.75996 1C5.03996 1 3.63996 2.35 3.52996 4.04C2.60996 4.22 1.79996 4.77 1.31996 5.59C0.459957 7.08 0.929957 8.96 2.33996 9.9C2.02996 10.79 2.09996 11.77 2.56996 12.58C3.16996 13.62 4.26996 14.2 5.38996 14.2C5.86996 14.2 6.35996 14.08 6.81996 13.86C7.42996 14.57 8.30996 14.99 9.25996 14.99C10.98 14.99 12.38 13.64 12.49 11.95C13.41 11.77 14.22 11.22 14.7 10.4C15.56 8.91 15.09 7.03 13.68 6.09L13.67 6.1ZM12.57 3.92C12.86 4.43 12.93 5.02 12.8 5.58L10.25 4.11C10.1 4.02 9.89996 4.02 9.74996 4.11L6.49996 5.99V4.84L9.49996 3.11C10.57 2.49 11.95 2.86 12.57 3.93V3.92ZM9.49996 8.87L7.99996 9.74L6.49996 8.87V7.14L7.99996 6.27L9.49996 7.14V8.87ZM4.49996 4.25C4.49996 3.01 5.50996 2 6.74996 2C7.32996 2 7.87996 2.23 8.29996 2.63L5.74996 4.1C5.59996 4.19 5.49996 4.35 5.49996 4.53V8.28L4.49996 7.7V4.24V4.25ZM2.17996 6.08C2.46996 5.57 2.94996 5.22 3.49996 5.05V7.99C3.49996 8.17 3.59996 8.33 3.74996 8.42L6.99996 10.3L5.99996 10.88L2.99996 9.15C1.92996 8.53 1.55996 7.15 2.17996 6.08ZM3.42996 12.08C3.13996 11.57 3.06996 10.98 3.19996 10.42L5.74996 11.89C5.82996 11.93 5.90996 11.96 5.99996 11.96C6.08996 11.96 6.16996 11.94 6.24996 11.89L9.49996 10.01V11.16L6.49996 12.89C5.42996 13.51 4.04996 13.14 3.42996 12.07V12.08ZM11.5 11.75C11.5 12.99 10.49 14 9.24996 14C8.66996 14 8.11996 13.77 7.69996 13.37L10.25 11.9C10.4 11.81 10.5 11.65 10.5 11.47V7.72L11.5 8.3V11.76V11.75ZM13.82 9.92C13.53 10.43 13.05 10.78 12.5 10.95V8.01C12.5 7.83 12.4 7.67 12.25 7.58L8.99996 5.7L9.99996 5.12L13 6.85C14.07 7.47 14.44 8.85 13.82 9.92Z",
);

/**
 * Pi's mark, drawn for Uraeda as Pi has none in Codicons: a π on Lucide's 24-unit grid, in its
 * stroke, neutral like the other glyphs.
 */
const pi = outline(
  h("path", { d: "M4 7h16" }),
  h("path", { d: "M9 7v12" }),
  h("path", { d: "M15 7v9a3 3 0 0 0 3 3" }),
);

/**
 * A decision rule's strength, by the core's name for it (`Strength::as_str`): Lucide's
 * `chevrons-up` for MUST, `chevron-up` for SHOULD, `chevron-down` for SHOULD NOT, `chevrons-down`
 * for MUST NOT, and a dot for MAY.
 */
const STRENGTH_ICONS = {
  may: outline(h("circle", { cx: 12, cy: 12, fill: "currentColor", r: 3 })),
  must: outline(h("path", { d: "m17 11-5-5-5 5" }), h("path", { d: "m17 18-5-5-5 5" })),
  "must-not": outline(h("path", { d: "m7 6 5 5 5-5" }), h("path", { d: "m7 13 5 5 5-5" })),
  should: outline(h("path", { d: "m18 15-6-6-6 6" })),
  "should-not": outline(h("path", { d: "m6 9 6 6 6-6" })),
};

/** A strength the core names, as the core's `Strength::as_str` names it. */
export type Strength = keyof typeof STRENGTH_ICONS;

/** Whether a name is one of the core's strengths. */
export function isStrength(name: string | null | undefined): name is Strength {
  return name != null && Object.hasOwn(STRENGTH_ICONS, name);
}

/** The registered name of a strength's icon. */
export function strengthIcon(strength: Strength): `uraeda:strength-${Strength}` {
  return `uraeda:strength-${strength}`;
}

/** A decision's icons, by the Lucide name its frontmatter's `icon` gives. */
const DECISION_ICONS = {
  bell,
  bot,
  "calendar-clock": calendarClock,
  component,
  database,
  eye: review,
  "file-text": fileText,
  "flask-conical": flaskConical,
  "folder-git-2": folderGit2,
  gauge,
  "git-branch": gitBranch,
  history,
  "key-round": keyRound,
  layers,
  "layout-panel-left": layoutPanelLeft,
  "layout-template": layoutTemplate,
  "mouse-pointer-click": mousePointerClick,
  package: packageIcon,
  palette,
  paperclip: attach,
  repeat,
  ruler,
  "scan-eye": scanEye,
  settings,
  "square-terminal": squareTerminal,
  terminal,
  "triangle-alert": triangleAlert,
  workflow,
  wrench,
};

/**
 * The registered name of a decision's icon, from its frontmatter's Lucide name: `file-text`'s for
 * a name not registered, or none.
 */
export function decisionIcon(name: string | null | undefined): `uraeda:decision-${string}` {
  const known = name != null && Object.hasOwn(DECISION_ICONS, name);
  return `uraeda:decision-${known ? name : "file-text"}`;
}

export const uraedaIcons = {
  "uraeda:activity": activity,
  "uraeda:attach": attach,
  "uraeda:badge-check": badgeCheck,
  "uraeda:book-open": bookOpen,
  "uraeda:comment": comment,
  "uraeda:crop": crop,
  "uraeda:database": database,
  "uraeda:enter": enter,
  "uraeda:eye": review,
  "uraeda:flag": flag,
  "uraeda:globe": globe,
  // An unknown harness: Lucide's `bot`.
  "uraeda:harness-agent": bot,
  "uraeda:harness-claude": claude,
  "uraeda:harness-openai": openai,
  "uraeda:harness-pi": pi,
  "uraeda:history": history,
  "uraeda:home": home,
  "uraeda:inbox": inbox,
  "uraeda:key-round": keyRound,
  "uraeda:layers": layers,
  "uraeda:lightbulb": lightbulb,
  "uraeda:list": list,
  "uraeda:log-out": logOut,
  "uraeda:map": map,
  "uraeda:maximize": maximize,
  "uraeda:minimize": minimize,
  "uraeda:monitor": monitor,
  "uraeda:palette": palette,
  "uraeda:panel-left": panelLeft,
  "uraeda:panel-right": panelRight,
  "uraeda:pencil": pencil,
  "uraeda:pick": pick,
  "uraeda:plug": plug,
  "uraeda:plus": plus,
  "uraeda:ruler": ruler,
  "uraeda:scale": scale,
  "uraeda:server": server,
  "uraeda:settings": settings,
  "uraeda:shield": shield,
  "uraeda:smartphone": smartphone,
  "uraeda:step-discovery": discovery,
  "uraeda:step-given": given,
  "uraeda:step-implementation": implementation,
  "uraeda:step-plan": plan,
  "uraeda:step-proposal": proposal,
  "uraeda:step-pull-request": pullRequest,
  "uraeda:step-questions": questions,
  "uraeda:step-review": review,
  "uraeda:step-spec": spec,
  "uraeda:step-then": then,
  "uraeda:step-when": when,
  "uraeda:target": target,
  "uraeda:terminal": terminal,
  "uraeda:triangle-alert": triangleAlert,
  "uraeda:workflow": workflow,
  "uraeda:wrench": wrench,
  ...Object.fromEntries(
    Object.entries(DECISION_ICONS).map(([name, icon]) => [`uraeda:decision-${name}`, icon]),
  ),
  ...Object.fromEntries(
    Object.entries(STRENGTH_ICONS).map(([name, icon]) => [`uraeda:strength-${name}`, icon]),
  ),
};
