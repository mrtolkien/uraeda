// A titled pane, the UI look's group of content: a square border whose title sits in its top
// border, as a terminal tool draws it. An Astryx gap (plan, Complexity tracking): `Card` and
// `Section` have no title in their border, so it is a `section` styled on the theme's tokens.
import { Heading, type HeadingLevel } from "@astryxdesign/core/Heading";
import { Icon } from "@astryxdesign/core/Icon";
import {
  borderVars,
  colorVars,
  fontWeightVars,
  spacingVars,
  typeScaleVars,
} from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { type ComponentProps, type ReactNode, useId } from "react";

/** What a pane's colour tells: it needs the human, or it holds a problem. */
export type PaneTone = "attention" | "problem";

const styles = stylex.create({
  active: { borderColor: colorVars["--color-accent"] },
  activeTitle: { color: colorVars["--color-text-accent"] },
  attention: { borderColor: colorVars["--color-border-orange"] },
  attentionTitle: { color: colorVars["--color-text-orange"] },
  pane: {
    // The title's background hides the border behind it: both are the pane's own.
    backgroundColor: colorVars["--color-background-body"],
    borderColor: colorVars["--color-border"],
    borderStyle: "solid",
    borderWidth: borderVars["--border-width"],
    // Room above for the half of the title over the border.
    marginBlockStart: spacingVars["--spacing-3"],
    minWidth: 0,
    paddingBlockEnd: spacingVars["--spacing-1"],
    paddingBlockStart: spacingVars["--spacing-3"],
    paddingInline: spacingVars["--spacing-1"],
    position: "relative",
  },
  problem: { borderColor: colorVars["--color-border-red"] },
  problemTitle: { color: colorVars["--color-text-red"] },
  title: {
    alignItems: "center",
    backgroundColor: colorVars["--color-background-body"],
    // Catppuccin's lavender, a local token of the theme (`theme.ts`).
    color: "var(--color-text-lavender)",
    display: "inline-flex",
    fontSize: typeScaleVars["--text-supporting-size"],
    fontWeight: fontWeightVars["--font-weight-semibold"],
    gap: spacingVars["--spacing-1"],
    insetBlockStart: 0,
    insetInlineStart: spacingVars["--spacing-3"],
    maxWidth: `calc(100% - 2 * ${spacingVars["--spacing-3"]})`,
    paddingInline: spacingVars["--spacing-2"],
    position: "absolute",
    // Centred on the top border.
    transform: "translateY(-50%)",
    whiteSpace: "nowrap",
  },
});

/** The border's and the title's colours, by the pane's state: active, then its tone. */
function colours(isActive: boolean, tone: PaneTone | undefined) {
  if (isActive) {
    return [styles.active, styles.activeTitle] as const;
  }
  if (tone === "attention") {
    return [styles.attention, styles.attentionTitle] as const;
  }
  if (tone === "problem") {
    return [styles.problem, styles.problemTitle] as const;
  }
  return [null, null] as const;
}

/**
 * A pane: a `section` named by its title, the title a heading at the caller's level, set in the
 * top border with its icon and its count. The accent colours its border and title while it is
 * active, else its tone does. `isGroup` makes it a group rather than a region, as the panes of a
 * navigation are, which a list of landmarks would repeat.
 */
export function Pane({
  children,
  count,
  icon,
  id,
  isActive = false,
  isGroup = false,
  level = 2,
  title,
  tone,
}: {
  children: ReactNode;
  count?: number;
  icon?: ComponentProps<typeof Icon>["icon"];
  id?: string;
  isActive?: boolean;
  isGroup?: boolean;
  level?: HeadingLevel;
  title: string;
  tone?: PaneTone;
}) {
  const titleId = useId();
  const [border, ink] = colours(isActive, tone);
  return (
    <section
      aria-labelledby={titleId}
      id={id}
      role={isGroup ? "group" : undefined}
      {...stylex.props(styles.pane, border)}
    >
      <Heading level={level} xstyle={[styles.title, ink]}>
        {icon && <Icon icon={icon} size="sm" />}
        <span id={titleId}>{title}</span>
        {count !== undefined && <span>· {count}</span>}
      </Heading>
      {children}
    </section>
  );
}
