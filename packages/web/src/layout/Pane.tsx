// A titled pane, the UI look's group of content: a square border whose title sits in its top
// border, as a terminal tool draws it. An Astryx gap (plan, Complexity tracking): `Card` and
// `Section` have no title in their border, so it is a `section` styled on the theme's tokens.
import { Button } from "@astryxdesign/core/Button";
import { Heading, type HeadingLevel } from "@astryxdesign/core/Heading";
import { Icon } from "@astryxdesign/core/Icon";
import {
  borderVars,
  colorVars,
  fontWeightVars,
  sizeVars,
  spacingVars,
  typeScaleVars,
} from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { type ComponentProps, type ReactNode, useId } from "react";
import { useScrollMargin } from "./scrollMargin.ts";
import { isNarrow, useWidthClass } from "./useWidthClass.ts";

/** What a pane's colour tells: it needs the human, it shows an example, or it holds a problem. */
export type PaneTone = "attention" | "example" | "problem";

/**
 * A pane that folds to its title: whether it is open, and what opens or closes it. `folded`, when
 * given, is a line in the folded pane's body that opens it too, such as "3 choices in the code only".
 */
export type PaneFold = {
  folded?: string;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
};

const styles = stylex.create({
  active: { borderColor: colorVars["--color-accent"] },
  activeTitle: { color: colorVars["--color-text-accent"] },
  attention: { borderColor: colorVars["--color-border-orange"] },
  attentionTitle: { color: colorVars["--color-text-orange"] },
  // The count stays on the title's first line, whole.
  count: {
    flexShrink: 0,
  },
  example: { borderColor: colorVars["--color-border-teal"] },
  exampleTitle: { color: colorVars["--color-text-teal"] },
  // A folding pane's title, a button drawn as the title it stands for, wrapping as the title does:
  // a target as tall as a control, the theme's 44 px on a touch screen, around its first line, its
  // padding taking no room from the title, and its background, on a hover, kept to its lines.
  foldTitle: {
    backgroundClip: "content-box",
    color: "inherit",
    fontSize: "inherit",
    fontWeight: "inherit",
    height: "auto",
    justifyContent: "start",
    lineHeight: "inherit",
    // A pixel over the control's height, so a line's fractional height cannot round it under.
    marginBlock: `calc((1lh - 1px - ${sizeVars["--size-element-sm"]}) / 2)`,
    paddingBlock: `calc((${sizeVars["--size-element-sm"]} + 1px - 1lh) / 2)`,
    paddingInline: 0,
    textAlign: "start",
    whiteSpace: "normal",
  },
  // An icon in the title, centred on its first line.
  glyph: {
    // One line's height, which StyleX's height values do not list.
    "--pane-line": "1lh",
    alignItems: "center",
    display: "inline-flex",
    flexShrink: 0,
    height: "var(--pane-line)",
  },
  // The title's words, its icons, and its count, on lines of the title's width.
  name: {
    alignItems: "start",
    display: "flex",
    gap: spacingVars["--spacing-1"],
    minWidth: 0,
  },
  // On the phone, a round's pane keeps only its titled top border, so its text takes the screen's
  // width: no side or bottom border, no inset, and no background of its own, so it shows no band
  // over the page. Its widths are the pane's own properties, which merge in the props: a longhand
  // over the pane's shorthand would win or lose by the order of the stylesheet's rules.
  openOnPhone: {
    backgroundColor: "transparent",
    borderBlockEndWidth: 0,
    borderInlineEndWidth: 0,
    borderInlineStartWidth: 0,
    paddingInline: 0,
  },
  // Its title hides the border behind it with the page's surface, which a round on the phone is
  // drawn on.
  openOnPhoneTitle: {
    backgroundColor: colorVars["--color-background-surface"],
    marginInlineStart: 0,
    maxWidth: "100%",
    paddingInlineStart: 0,
  },
  pane: {
    // The title's background hides the border behind it: both are the pane's own.
    backgroundColor: colorVars["--color-background-body"],
    borderColor: colorVars["--color-border"],
    borderStyle: "solid",
    // Each side's width, which `openOnPhone` sets to none but the top.
    borderBlockEndWidth: borderVars["--border-width"],
    borderBlockStartWidth: borderVars["--border-width"],
    borderInlineEndWidth: borderVars["--border-width"],
    borderInlineStartWidth: borderVars["--border-width"],
    // Room above for the half of the title over the border.
    marginBlockStart: spacingVars["--spacing-3"],
    minWidth: 0,
    paddingBlockEnd: spacingVars["--spacing-1"],
    // The title, in the flow, takes the room above the content.
    paddingBlockStart: 0,
    paddingInline: spacingVars["--spacing-1"],
    position: "relative",
  },
  problem: { borderColor: colorVars["--color-border-red"] },
  problemTitle: { color: colorVars["--color-text-red"] },
  // The title, in the flow so that its further lines push the content down: its first line
  // centred on the top border, its further lines below it, inside the pane, as wide as it at most.
  title: {
    backgroundColor: colorVars["--color-background-body"],
    // Catppuccin's lavender, a local token of the theme (`theme.ts`).
    color: "var(--color-text-lavender)",
    display: "flex",
    fontSize: typeScaleVars["--text-supporting-size"],
    fontWeight: fontWeightVars["--font-weight-semibold"],
    lineHeight: typeScaleVars["--text-supporting-leading"],
    // Up by half the border and half its first line, then down to the content's usual room.
    marginBlockEnd: `calc(${spacingVars["--spacing-3"]} + ${borderVars["--border-width"]} / 2 - 0.5lh)`,
    marginBlockStart: `calc(-1 * (${borderVars["--border-width"]} / 2 + 0.5lh))`,
    marginInlineStart: `calc(${spacingVars["--spacing-3"]} - ${spacingVars["--spacing-1"]})`,
    maxWidth: `calc(100% - 2 * (${spacingVars["--spacing-3"]} - ${spacingVars["--spacing-1"]}))`,
    // Each side's, which `openOnPhoneTitle` sets at the start.
    paddingInlineEnd: spacingVars["--spacing-2"],
    paddingInlineStart: spacingVars["--spacing-2"],
    position: "relative",
    width: "fit-content",
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
  if (tone === "example") {
    return [styles.example, styles.exampleTitle] as const;
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
 * navigation are, which a list of landmarks would repeat. `isOpenOnPhone` keeps only its titled top
 * border on narrow screens, as the round's panes do. With `fold`, its title is a button that opens
 * and closes it, named by its title and its count, and folded, its content is not mounted.
 */
export function Pane({
  children,
  count,
  fold,
  icon,
  id,
  isActive = false,
  isGroup = false,
  isOpenOnPhone = false,
  level = 2,
  title,
  tone,
}: {
  children: ReactNode;
  count?: number;
  fold?: PaneFold;
  icon?: ComponentProps<typeof Icon>["icon"];
  id?: string;
  isActive?: boolean;
  isGroup?: boolean;
  isOpenOnPhone?: boolean;
  level?: HeadingLevel;
  title: string;
  tone?: PaneTone;
}) {
  const titleId = useId();
  const [border, ink] = colours(isActive, tone);
  const margin = useScrollMargin("pane");
  const width = useWidthClass();
  const isOpen = isOpenOnPhone && isNarrow(width);
  // The fold button's name, as it reads: the title and its count.
  const label = count === undefined ? title : `${title} · ${count}`;
  const name = (
    <span {...stylex.props(styles.name)}>
      {fold && (
        <span {...stylex.props(styles.glyph)}>
          <Icon icon={fold.isOpen ? "chevronDown" : "chevronRight"} size="sm" />
        </span>
      )}
      {icon && (
        <span {...stylex.props(styles.glyph)}>
          <Icon icon={icon} size="sm" />
        </span>
      )}
      <span id={titleId}>{title}</span>
      {count !== undefined && <span {...stylex.props(styles.count)}>· {count}</span>}
    </span>
  );
  return (
    <section
      aria-labelledby={titleId}
      id={id}
      role={isGroup ? "group" : undefined}
      {...stylex.props(styles.pane, isOpen && styles.openOnPhone, margin, border)}
    >
      <Heading level={level} xstyle={[styles.title, isOpen && styles.openOnPhoneTitle, ink]}>
        {fold ? (
          <Button
            aria-expanded={fold.isOpen}
            label={label}
            onClick={() => fold.onOpenChange(!fold.isOpen)}
            size="sm"
            variant="ghost"
            xstyle={styles.foldTitle}
          >
            {name}
          </Button>
        ) : (
          name
        )}
      </Heading>
      {!fold || fold.isOpen
        ? children
        : fold.folded !== undefined && (
            <Button
              label={fold.folded}
              onClick={() => fold.onOpenChange(true)}
              size="sm"
              variant="ghost"
            />
          )}
    </section>
  );
}
