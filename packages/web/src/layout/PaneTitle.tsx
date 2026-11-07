// A pane's title, in its top border (`Pane.tsx`): its words, its icons, its count, what follows it,
// and its Δ, or, in a pane that folds, the button that opens and closes it around them.
import { Button } from "@astryxdesign/core/Button";
import { Icon } from "@astryxdesign/core/Icon";
import { sizeVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import type { ComponentProps, ReactNode } from "react";
import { SinceSign, useSinceTitle } from "../sinceMarks.tsx";
import { paneVars } from "./pane.stylex.ts";
import { PaneSuffix } from "./PaneSuffix.tsx";

/**
 * A pane that folds to its title: whether it is open, and what opens or closes it. `folded`, when
 * given, is a line in the folded pane's body that opens it too, such as "3 choices in the code
 * only".
 */
export type PaneFold = {
  folded?: string;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
};

const styles = stylex.create({
  // The count stays on the title's first line, whole.
  count: {
    flexShrink: 0,
  },
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
    // A pixel over the control's height (`--pane-title-slack`).
    marginBlock: `calc((1lh - ${paneVars["--pane-title-slack"]} - ${sizeVars["--size-element-sm"]}) / 2)`,
    paddingBlock: `calc((${sizeVars["--size-element-sm"]} + ${paneVars["--pane-title-slack"]} - 1lh) / 2)`,
    paddingInline: 0,
    textAlign: "start",
    whiteSpace: "normal",
  },
  // An icon in the title, centred on its first line.
  glyph: {
    // One line's height, a unit of the layout, not a token: the token lint takes it in a custom
    // property.
    "--pane-line": "1lh",
    alignItems: "center",
    display: "inline-flex",
    flexShrink: 0,
    height: "var(--pane-line)",
  },
  // The title's words, its icons, and its count, on lines of the title's width.
  head: {
    alignItems: "start",
    display: "flex",
    gap: spacingVars["--spacing-1"],
    minWidth: 0,
  },
  // The head, then what follows the title, which goes under it where both leave the title too
  // little room, never squeezing its words.
  name: {
    alignItems: "start",
    columnGap: spacingVars["--spacing-1"],
    display: "flex",
    flexWrap: "wrap",
    minWidth: 0,
  },
  // The title's words, which give up their room to the title's width: a title of one line, as the
  // Git page's detail draws, cuts itself there rather than run past the pane.
  words: { minWidth: 0 },
});

/** What a pane's title shows, and `paneId`, the pane's `id`, whose renamed title carries the Δ. */
type TitleProps = {
  count?: number | undefined;
  fold?: PaneFold | undefined;
  icon?: ComponentProps<typeof Icon>["icon"] | undefined;
  paneId: string | undefined;
  title: string;
  titleId: string;
  titleNode?: ReactNode;
  titleSuffix?: ReactNode;
};

/**
 * The title's words, or, in a pane that folds, the button that opens and closes it, named by its
 * title, its count, and a suffix of text, as it reads.
 */
export function PaneTitle(props: TitleProps) {
  const { count, fold, title, titleSuffix } = props;
  if (!fold) {
    return <PaneName {...props} />;
  }
  const counted = count === undefined ? title : `${title} · ${count}`;
  return (
    <Button
      aria-expanded={fold.isOpen}
      label={typeof titleSuffix === "string" ? `${counted} ${titleSuffix}` : counted}
      onClick={() => fold.onOpenChange(!fold.isOpen)}
      size="sm"
      variant="ghost"
      xstyle={styles.foldTitle}
    >
      <PaneName {...props} />
    </Button>
  );
}

/** The title's words, its icons, its count, what follows it, and its Δ, if it changed. */
function PaneName({
  count,
  fold,
  icon,
  paneId,
  title,
  titleId,
  titleNode,
  titleSuffix,
}: TitleProps) {
  // A title changed since your review, like a story renamed, carries the mark.
  const renamed = useSinceTitle(paneId);
  return (
    <span {...stylex.props(styles.name)}>
      <span {...stylex.props(styles.head)}>
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
        <span id={titleId} {...stylex.props(styles.words)}>
          {titleNode ?? title}
        </span>
        {/* The space is for the text's reading: flex items show no space between them. */}
        {count !== undefined && " "}
        {count !== undefined && <span {...stylex.props(styles.count)}>· {count}</span>}
        {renamed && <SinceSign />}
      </span>
      {titleSuffix !== undefined && <PaneSuffix>{titleSuffix}</PaneSuffix>}
    </span>
  );
}
