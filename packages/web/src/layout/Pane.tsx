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
  example: { borderColor: colorVars["--color-border-teal"] },
  exampleTitle: { color: colorVars["--color-text-teal"] },
  // A folding pane's title, a button drawn as the title it stands for: as tall as its text, so its
  // background hides no more than the title's around the border, and a target as tall as a control,
  // the theme's 44 px on a touch screen, centred on it.
  foldTitle: {
    "::before": {
      content: '""',
      insetBlock: `calc(50% - ${sizeVars["--size-element-sm"]} / 2)`,
      insetInline: 0,
      position: "absolute",
    },
    color: "inherit",
    fontSize: "inherit",
    fontWeight: "inherit",
    height: "auto",
    paddingBlock: 0,
    paddingInline: 0,
  },
  // On the phone, a round's pane keeps only its titled top border, so its text takes the screen's
  // width: no side or bottom border, no inset.
  openOnPhone: {
    borderBlockEndWidth: 0,
    borderInlineWidth: 0,
    paddingInline: 0,
  },
  openOnPhoneTitle: {
    insetInlineStart: 0,
    maxWidth: "100%",
    paddingInlineStart: 0,
  },
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
 * and closes it, and folded, its content is not mounted.
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
  const name = (
    <>
      {icon && <Icon icon={icon} size="sm" />}
      <span id={titleId}>{title}</span>
      {count !== undefined && <span>· {count}</span>}
    </>
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
            label={title}
            onClick={() => fold.onOpenChange(!fold.isOpen)}
            size="sm"
            variant="ghost"
            xstyle={styles.foldTitle}
          >
            <Icon icon={fold.isOpen ? "chevronDown" : "chevronRight"} size="sm" />
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
