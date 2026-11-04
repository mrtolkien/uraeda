// lualine's sections, as LazyVim sets them, for the status line: `a` the mode, in its colour; `b`
// on a raised ground, in the mode's colour; `c` on the line's own ground. Between them, lualine's
// separators: triangles drawn here, as the bundled fonts have no Powerline glyphs. The colours are
// Catppuccin's, through the theme's tokens: NAV grey, NORMAL blue, INSERT green, the visual modes
// mauve, REPLACE red, COMMAND peach.
import { colorVars, fontWeightVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";
import type { Mode } from "../../fields/editor/modeStore.ts";

/** The line's colour: a Vim mode's, NAV's outside a field, or `off` with Vim off. */
export type Tone = "command" | "insert" | "nav" | "normal" | "off" | "replace" | "visual";

/** The tone of a mode, or `off` while Vim's keys are off. */
export function toneOf(mode: Mode | "nav", isVimOn: boolean): Tone {
  if (!isVimOn) {
    return "off";
  }
  return mode === "visual-line" || mode === "visual-block" ? "visual" : mode;
}

const styles = stylex.create({
  a: { fontWeight: fontWeightVars["--font-weight-bold"] },
  b: { backgroundColor: colorVars["--color-background-gray"] },
  line: { backgroundColor: colorVars["--color-background-muted"] },
  pointing: { clipPath: "polygon(0 0, 100% 50%, 0 100%)" },
  section: {
    alignItems: "center",
    display: "flex",
    flexShrink: 0,
    gap: spacingVars["--spacing-2"],
    paddingInline: spacingVars["--spacing-3"],
  },
  separator: { display: "flex", flexShrink: 0 },
  shape: { width: spacingVars["--spacing-3"] },
});

/** The mode's block: its colour, the text on it in the colour that reads on it. */
const fills = stylex.create({
  command: {
    backgroundColor: colorVars["--color-border-orange"],
    color: colorVars["--color-on-accent"],
  },
  insert: {
    backgroundColor: colorVars["--color-border-green"],
    color: colorVars["--color-on-accent"],
  },
  nav: {
    backgroundColor: colorVars["--color-text-secondary"],
    color: colorVars["--color-on-accent"],
  },
  normal: {
    backgroundColor: colorVars["--color-border-blue"],
    color: colorVars["--color-on-accent"],
  },
  off: {
    backgroundColor: colorVars["--color-text-secondary"],
    color: colorVars["--color-on-accent"],
  },
  replace: {
    backgroundColor: colorVars["--color-border-red"],
    color: colorVars["--color-on-accent"],
  },
  visual: {
    backgroundColor: colorVars["--color-border-purple"],
    color: colorVars["--color-on-accent"],
  },
});

/** Section b's text, in the mode's colour, on its raised ground. */
const inks = stylex.create({
  command: { color: colorVars["--color-text-orange"] },
  insert: { color: colorVars["--color-text-green"] },
  nav: { color: colorVars["--color-text-secondary"] },
  normal: { color: colorVars["--color-text-blue"] },
  off: { color: colorVars["--color-text-secondary"] },
  replace: { color: colorVars["--color-text-red"] },
  visual: { color: colorVars["--color-text-purple"] },
});

/** A section's kind, as lualine names them. */
export type Kind = "a" | "b" | "c";

/** A section's styles, for a section drawn by its own element, like the hints. */
export function sectionStyles(kind: Kind, tone: Tone) {
  switch (kind) {
    case "a":
      return [styles.section, styles.a, fills[tone]];
    case "b":
      return [styles.section, styles.b, inks[tone]];
    case "c":
      return [styles.section];
  }
}

/** A section of the line. */
export function Section({ children, kind, tone }: { children: ReactNode; kind: Kind; tone: Tone }) {
  return <div {...stylex.props(sectionStyles(kind, tone))}>{children}</div>;
}

/** A ground a separator joins: the line's own, section b's, or the mode's colour. */
export type Ground = "b" | "line" | "mode";

const ground = (of: Ground, tone: Tone) =>
  of === "mode" ? fills[tone] : of === "b" ? styles.b : styles.line;

/**
 * lualine's separator between two sections: a triangle in the colour of the section it comes
 * `from`, pointing rightward into the one it goes `into`, on that one's ground.
 */
export function Separator({ from, into, tone }: { from: Ground; into: Ground; tone: Tone }) {
  return (
    <span aria-hidden {...stylex.props(styles.separator, ground(into, tone))}>
      <span {...stylex.props(styles.shape, ground(from, tone), styles.pointing)} />
    </span>
  );
}
