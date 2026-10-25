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
import {
  type ComponentProps,
  type ReactNode,
  type RefObject,
  createContext,
  use,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { SinceSign, useSinceTitle } from "../sinceMarks.tsx";
import { useScrollMargin } from "./scrollMargin.ts";
import { isNarrow, useWidthClass } from "./useWidthClass.ts";

/** Whether a pane is inside another: there, it keeps its borders on the phone too. */
const InPane = createContext(false);

/**
 * What a pane's colour tells: it needs the human, it shows an example, or it holds a problem; a
 * decision new, changed, or removed; or a live window, whose border is double.
 */
export type PaneTone = "attention" | "changed" | "example" | "live" | "new" | "problem" | "removed";

/** A colour for a pane's title alone, as a list's section tells its kind; its border stays. */
export type PaneTint = "blue" | "gray" | "green";

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
  // The actions, in the top border at its end, centred on it, hiding the border behind them as the
  // title does.
  actions: {
    alignItems: "center",
    backgroundColor: colorVars["--color-background-body"],
    display: "flex",
    gap: spacingVars["--spacing-1"],
    insetBlockStart: "var(--pane-border-middle)",
    insetInlineEnd: `calc(${spacingVars["--spacing-3"]} - ${spacingVars["--spacing-1"]})`,
    paddingInline: spacingVars["--spacing-1"],
    position: "absolute",
    transform: "translateY(-50%)",
  },
  active: { borderColor: colorVars["--color-accent"] },
  activeTitle: { color: colorVars["--color-text-accent"] },
  attention: { borderColor: colorVars["--color-border-orange"] },
  attentionTitle: { color: colorVars["--color-text-orange"] },
  changed: { borderColor: colorVars["--color-border-purple"] },
  changedTitle: { color: colorVars["--color-text-purple"] },
  tintBlue: { color: colorVars["--color-text-blue"] },
  tintGray: { color: colorVars["--color-text-secondary"] },
  tintGreen: { color: colorVars["--color-text-green"] },
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
  // A live window: the theme's own sapphire, a local token (`theme.ts`), and a double border,
  // three times the border's width so its two lines and the gap between them show.
  live: {
    "--pane-border": `calc(3 * ${borderVars["--border-width"]})`,
    borderColor: "var(--color-border-sapphire)",
    borderStyle: "double",
  },
  liveTitle: { color: "var(--color-text-sapphire)" },
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
  new: { borderColor: colorVars["--color-border-green"] },
  newTitle: { color: colorVars["--color-text-green"] },
  // On the phone, a round's pane keeps only its titled top border, so its text takes the screen's
  // width: no side or bottom border, no inset, and no background of its own, so it shows no band
  // over the page, whose surface its content then sits on. Its widths are the pane's own
  // properties, which merge in the props: a longhand over the pane's shorthand would win or lose by
  // the order of the stylesheet's rules.
  openOnPhone: {
    "--pane-surface": colorVars["--color-background-surface"],
    backgroundColor: "transparent",
    borderBlockEndWidth: 0,
    borderInlineEndWidth: 0,
    borderInlineStartWidth: 0,
    paddingInline: 0,
  },
  openOnPhoneActions: { backgroundColor: colorVars["--color-background-surface"] },
  // Its title hides the border behind it with the page's surface, which a round on the phone is
  // drawn on, and leaves a run of the border after it, so a title of several lines still shows
  // the pane's top border.
  openOnPhoneTitle: {
    backgroundColor: colorVars["--color-background-surface"],
    marginInlineStart: 0,
    maxWidth: `calc(100% - ${spacingVars["--spacing-3"]} - var(--pane-actions-room, 0px))`,
    paddingInlineStart: 0,
  },
  pane: {
    // The border's width, which a live window triples: the title and the actions centre on it.
    "--pane-border": borderVars["--border-width"],
    // Up from the content's top edge to the border's middle line.
    "--pane-border-middle": "calc(var(--pane-border) / -2)",
    // The title's first line centred on it, in the title's own line height, where it is used.
    "--pane-title-top": "calc(var(--pane-border) / -2 - 0.5lh)",
    // The surface its content sits on, which a soft colour is mixed over (`spec/RuleLine.tsx`).
    "--pane-surface": colorVars["--color-background-body"],
    // The title's background hides the border behind it: both are the pane's own.
    backgroundColor: colorVars["--color-background-body"],
    borderColor: colorVars["--color-border"],
    borderStyle: "solid",
    // Each side's width, which `openOnPhone` sets to none but the top.
    borderBlockEndWidth: "var(--pane-border)",
    borderBlockStartWidth: "var(--pane-border)",
    borderInlineEndWidth: "var(--pane-border)",
    borderInlineStartWidth: "var(--pane-border)",
    // Room above for the half of the title over the border.
    marginBlockStart: spacingVars["--spacing-3"],
    minWidth: 0,
    paddingBlockEnd: spacingVars["--spacing-1"],
    // The title, in the flow, takes the room above the content.
    paddingBlockStart: 0,
    // The theme's room, or a narrower one an ancestor sets, as the shell's column does.
    paddingInline: `var(--pane-inset, ${spacingVars["--spacing-3"]})`,
    position: "relative",
  },
  problem: { borderColor: colorVars["--color-border-red"] },
  problemTitle: { color: colorVars["--color-text-red"] },
  // Beside the actions, the title wraps before them: their width, and the gap, kept free.
  reserve: (room: string) => ({ "--pane-actions-room": room }),
  // Actions too wide to leave the title room beside them: the title goes under them, inside the
  // pane, from below the actions' lower half.
  under: (below: string) => ({
    marginBlockStart: below,
  }),
  // What follows the title, such as a live window's size and scale: secondary, in the title's line,
  // taking the room the title leaves, its words wrapping in it, or under the title when that room
  // is narrower than a few words.
  suffix: {
    // A few words of the suffix's own text.
    "--pane-suffix-room": "12ch",
    color: colorVars["--color-text-secondary"],
    flexBasis: 0,
    flexGrow: 1,
    fontWeight: fontWeightVars["--font-weight-normal"],
    minWidth: "var(--pane-suffix-room)",
  },
  // A tinted pane, as a picked card: its background the accent's muted tint. Its title's band is
  // the page's above the border's middle and the tint's below it, so the title sits on both.
  tinted: {
    "--pane-surface": colorVars["--color-accent-muted"],
    backgroundColor: colorVars["--color-accent-muted"],
  },
  tintedTitle: {
    backgroundImage: `linear-gradient(to bottom, ${colorVars["--color-background-body"]} 50%, ${colorVars["--color-accent-muted"]} 50%)`,
  },
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
    marginBlockEnd: `calc(${spacingVars["--spacing-3"]} + var(--pane-border) / 2 - 0.5lh)`,
    marginBlockStart: "var(--pane-title-top)",
    marginInlineStart: `calc(${spacingVars["--spacing-3"]} - ${spacingVars["--spacing-1"]})`,
    maxWidth: `calc(100% - 2 * (${spacingVars["--spacing-3"]} - ${spacingVars["--spacing-1"]}) - var(--pane-actions-room, 0px))`,
    // Each side's, which `openOnPhoneTitle` sets at the start.
    paddingInlineEnd: spacingVars["--spacing-2"],
    paddingInlineStart: spacingVars["--spacing-2"],
    position: "relative",
    width: "fit-content",
    // Focused by a jump (`roundJump.ts`), without a ring: the jump shows where it went.
    outlineStyle: { ":focus:not(:focus-visible)": "none", default: null },
  },
});

/** Each tone's border and title. A removed decision is red, as a problem is. */
const TONES = {
  attention: [styles.attention, styles.attentionTitle],
  changed: [styles.changed, styles.changedTitle],
  example: [styles.example, styles.exampleTitle],
  live: [styles.live, styles.liveTitle],
  new: [styles.new, styles.newTitle],
  problem: [styles.problem, styles.problemTitle],
  removed: [styles.problem, styles.problemTitle],
} as const;

/** Each tint's title style. */
const TINTS = { blue: styles.tintBlue, gray: styles.tintGray, green: styles.tintGreen } as const;

/**
 * The border's and the title's styles, by the pane's state: active, then its tone. An active live
 * window keeps its double border, in the accent.
 */
function colours(isActive: boolean, tone: PaneTone | undefined) {
  if (isActive) {
    return [[tone === "live" && styles.live, styles.active], styles.activeTitle] as const;
  }
  return tone === undefined ? ([null, null] as const) : TONES[tone];
}

/** The pane's and its title's styles, by its state, its colours and `isTinted`'s background. */
function looks(isActive: boolean, tone: PaneTone | undefined, isTinted: boolean) {
  const [border, ink] = colours(isActive, tone);
  return isTinted
    ? ([
        [border, styles.tinted],
        [styles.tintedTitle, ink],
      ] as const)
    : ([border, ink] as const);
}

/** The least room, in px, a title keeps beside the actions: less, and it goes under them. */
const TITLE_ROOM = 160;

/**
 * Where the title goes with the actions in the top border: beside them, wrapping before them, or,
 * where they leave it less than `TITLE_ROOM`, under them. Undefined without actions, or until
 * measured.
 */
function useActionsRoom(
  pane: RefObject<HTMLElement | null>,
  actions: RefObject<HTMLDivElement | null>,
  hasActions: boolean,
) {
  const [room, setRoom] = useState<{ height: number; under: boolean; width: number }>();
  useLayoutEffect(() => {
    const own = pane.current;
    const box = actions.current;
    if (!hasActions || !own || !box) {
      return;
    }
    const measure = () => {
      const width = Math.ceil(box.getBoundingClientRect().width);
      const height = Math.ceil(box.getBoundingClientRect().height);
      const under = own.clientWidth - width < TITLE_ROOM;
      setRoom((known) =>
        known?.width === width && known.height === height && known.under === under
          ? known
          : { height, under, width },
      );
    };
    measure();
    if (typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver(measure);
    observer.observe(own);
    observer.observe(box);
    return () => observer.disconnect();
  }, [actions, hasActions, pane]);
  return hasActions ? room : undefined;
}

/** The title's room by the actions: the width it keeps free beside them, or its place under them. */
function besideActions(room: ReturnType<typeof useActionsRoom>) {
  if (!room) {
    return null;
  }
  return room.under
    ? styles.under(`calc(${room.height / 2}px + ${spacingVars["--spacing-1"]})`)
    : styles.reserve(`calc(${room.width}px + ${spacingVars["--spacing-2"]})`);
}

/** The title's words, its icons, its count, what follows it, and its Δ, if it changed. */
function PaneName({
  count,
  fold,
  icon,
  paneId,
  title,
  titleId,
  titleSuffix,
}: {
  count?: number;
  fold?: PaneFold;
  icon?: ComponentProps<typeof Icon>["icon"];
  paneId: string | undefined;
  title: string;
  titleId: string;
  titleSuffix?: ReactNode;
}) {
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
        <span id={titleId}>{title}</span>
        {/* The space is for the text's reading: flex items show no space between them. */}
        {count !== undefined && " "}
        {count !== undefined && <span {...stylex.props(styles.count)}>· {count}</span>}
        {renamed && <SinceSign />}
      </span>
      {titleSuffix !== undefined && <span {...stylex.props(styles.suffix)}>{titleSuffix}</span>}
    </span>
  );
}

/**
 * A pane: a `section` named by its title, the title a heading at the caller's level, set in the
 * top border with its icon and its count. The accent colours its border and title while it is
 * active, else its tone does. `isGroup` makes it a group rather than a region, as the panes of a
 * navigation are, which a list of landmarks would repeat. `isOpenOnPhone` keeps only its titled top
 * border on narrow screens, as the round's panes do, unless it is inside another pane, whose
 * background its own would show as a band. With `fold`, its title is a button that opens
 * and closes it, named by its title and its count, and folded, its content is not mounted.
 * `actions` sit in the top border at its end, as a live window's buttons do, the title wrapping
 * before them, or under them where they leave it too little room; `titleSuffix` follows
 * the title in secondary text, as a live window's size and scale do, outside the pane's name.
 * With `id`, its heading is `<id>-title`, focusable by script, which a jump to the pane focuses.
 * `isTinted` sets its background in the accent's muted tint, as a picked card's. `tint` colours the
 * title alone, under the accent and the tone's.
 */
export function Pane({
  actions,
  children,
  count,
  fold,
  icon,
  id,
  isActive = false,
  isGroup = false,
  isOpenOnPhone = false,
  isTinted = false,
  level = 2,
  tint,
  title,
  titleSuffix,
  tone,
}: {
  actions?: ReactNode;
  children: ReactNode;
  count?: number;
  fold?: PaneFold;
  icon?: ComponentProps<typeof Icon>["icon"];
  id?: string;
  isActive?: boolean;
  isGroup?: boolean;
  isOpenOnPhone?: boolean;
  isTinted?: boolean;
  level?: HeadingLevel;
  tint?: PaneTint;
  title: string;
  titleSuffix?: ReactNode;
  tone?: PaneTone;
}) {
  const titleId = useId();
  const own = useRef<HTMLElement>(null);
  const actionsBox = useRef<HTMLDivElement>(null);
  const beside = besideActions(useActionsRoom(own, actionsBox, actions !== undefined));
  const [border, ink] = looks(isActive, tone, isTinted);
  const margin = useScrollMargin("pane");
  const width = useWidthClass();
  const isOpen = isOpenOnPhone && isNarrow(width) && !use(InPane);
  // The fold button's name, as it reads: the title and its count.
  const label = count === undefined ? title : `${title} · ${count}`;
  const name = (
    <PaneName
      count={count}
      fold={fold}
      icon={icon}
      paneId={id}
      title={title}
      titleId={titleId}
      titleSuffix={titleSuffix}
    />
  );
  return (
    <section
      aria-labelledby={titleId}
      id={id}
      ref={own}
      role={isGroup ? "group" : undefined}
      {...stylex.props(
        styles.pane,
        isOpen && styles.openOnPhone,
        margin,
        border,
        isTinted && styles.tinted,
      )}
    >
      <Heading
        id={id === undefined ? undefined : `${id}-title`}
        level={level}
        tabIndex={id === undefined ? undefined : -1}
        xstyle={[styles.title, isOpen && styles.openOnPhoneTitle, tint && TINTS[tint], ink, beside]}
      >
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
      {actions !== undefined && (
        <div
          ref={actionsBox}
          {...stylex.props(styles.actions, isOpen && styles.openOnPhoneActions)}
        >
          {actions}
        </div>
      )}
      <PaneBody fold={fold}>{children}</PaneBody>
    </section>
  );
}

/** A pane's content, open, as inside a pane; folded, not mounted, but its line that opens it. */
function PaneBody({ children, fold }: { children: ReactNode; fold?: PaneFold }) {
  if (!fold || fold.isOpen) {
    return <InPane value>{children}</InPane>;
  }
  return (
    fold.folded !== undefined && (
      <Button
        label={fold.folded}
        onClick={() => fold.onOpenChange(true)}
        size="sm"
        variant="ghost"
      />
    )
  );
}
