// The app's own icons, registered with Astryx through the theme (`theme.ts`): Astryx has none of
// them. Written without JSX, which the theme's build does not compile.
import { createElement as h } from "react";
import {
  attach,
  bell,
  bot,
  calendarClock,
  comment,
  component,
  database,
  discovery,
  enter,
  fileText,
  flaskConical,
  folderGit2,
  gauge,
  gitBranch,
  given,
  history,
  home,
  implementation,
  keyRound,
  layers,
  layoutPanelLeft,
  layoutTemplate,
  mousePointerClick,
  packageIcon,
  palette,
  panelLeft,
  panelRight,
  pick,
  plan,
  proposal,
  pullRequest,
  questions,
  repeat,
  review,
  ruler,
  scanEye,
  settings,
  spec,
  squareTerminal,
  terminal,
  then,
  triangleAlert,
  when,
  workflow,
  wrench,
  outline,
} from "./lucide.ts";

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
  "uraeda:attach": attach,
  "uraeda:comment": comment,
  "uraeda:enter": enter,
  "uraeda:home": home,
  "uraeda:panel-left": panelLeft,
  "uraeda:panel-right": panelRight,
  "uraeda:pick": pick,
  "uraeda:settings": settings,
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
  "uraeda:terminal": terminal,
  ...Object.fromEntries(
    Object.entries(DECISION_ICONS).map(([name, icon]) => [`uraeda:decision-${name}`, icon]),
  ),
  ...Object.fromEntries(
    Object.entries(STRENGTH_ICONS).map(([name, icon]) => [`uraeda:strength-${name}`, icon]),
  ),
};
