// A page's column at the window's right edge, on semi-wide and wide screens: resized from a bar along its edge,
// its width kept in the browser, and folded to a rail or unfolded from one button at the page's top
// right, which keeps its spot in both states (C3): shown under the pointer over the column, always
// to the keyboard and on touch, and always while the column is folded; `]` does the same, and so
// does a click on the rail's empty space. The width eases over 200 ms, at once under reduced
// motion. The page keeps its place in the tree as the column folds and unfolds, or the width
// changes, so its transcript, focus, and errors stay. Its caller keeps its width, as the document's
// column does (`DocumentColumn.tsx`). On a semi-wide window where the page beside it would keep
// less than a reading pane, it is a rail of its icons instead, which opens over the page as the
// sidebar's rail does (`RailedColumn`), unless it keeps beside its page (`isBeside`), a session's.
import { Icon } from "@astryxdesign/core/Icon";
import { IconButton } from "@astryxdesign/core/IconButton";
import { Layout, LayoutPanel } from "@astryxdesign/core/Layout";
import { ResizeHandle, type useResizable } from "@astryxdesign/core/Resizable";
import { Text } from "@astryxdesign/core/Text";
import { colorVars, easeVars, sizeVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import {
  type MouseEvent,
  type ReactNode,
  type RefObject,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useKeys } from "../keys/registry.tsx";
import { useRail } from "../shell/Rail.tsx";
import { useOpenOnShow } from "./documentColumnWidth.ts";
import { useLengthIn } from "./useWidthOf.ts";
import { isNarrow, useWidthClass } from "./useWidthClass.ts";

const styles = stylex.create({
  bar: {
    // Of no height, in view while the window scrolls: the button hangs from it at the same spot,
    // over the column's heading or the page's top right.
    display: "flex",
    height: 0,
    justifyContent: "flex-end",
    paddingInline: spacingVars["--spacing-2"],
    position: "sticky",
    top: 0,
    zIndex: 1,
  },
  button: {
    marginBlockStart: spacingVars["--spacing-2"],
  },
  easing: {
    // The width eases as the column folds or unfolds, never while its edge is dragged.
    transitionDuration: { "@media (prefers-reduced-motion: reduce)": "0s", default: "200ms" },
    transitionProperty: "width",
    transitionTimingFunction: easeVars["--ease-standard"],
  },
  edge: {
    // The resize bar runs along the column's start edge, not the window's.
    insetInlineEnd: "auto",
    insetInlineStart: 0,
  },
  full: {
    // The column's content keeps the column's width while it eases, so it slides rather than
    // reflows: set from the width.
    paddingBlockEnd: spacingVars["--spacing-4"],
    paddingInline: spacingVars["--spacing-4"],
  },
  // Filled: the content takes the column's height, a column of its header and its parts, each
  // scrolling on its own, and the column does not scroll as a whole.
  filled: {
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    height: "100%",
  },
  filledPanel: {
    overflowY: "hidden",
  },
  header: {
    alignItems: "center",
    display: "flex",
    flexShrink: 0,
    minHeight: sizeVars["--size-element-md"],
    paddingBlock: spacingVars["--spacing-2"],
    paddingInline: spacingVars["--spacing-3"],
  },
  hidden: {
    // Still focusable, and shown once focused: only its look waits for the pointer.
    opacity: { ":focus-visible": 1, "@media (hover: none)": 1, default: 0 },
  },
  panel: {
    // On the secondary surface, as the sidebar at the window's other edge.
    backgroundColor: colorVars["--color-background-body"],
    // As tall as the window, so the column and its edge run the whole height, scrolling on its own
    // when its content is taller.
    boxSizing: "border-box",
    height: "100%",
    overflowX: "hidden",
    overflowY: "auto",
  },
  rail: {
    // Folded: the rail's icons, in a column under the button that unfolds it.
    alignItems: "center",
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    gap: spacingVars["--spacing-3"],
    minHeight: "100%",
    paddingBlockStart: spacingVars["--spacing-12"],
  },
  // A railed column's place in the page's flow: the rail's width, whatever is open over the page.
  railRoom: {
    width: "var(--size-rail)",
  },
  // A railed column, at the window's right edge, over the page when open.
  over: {
    height: "100%",
    insetBlockStart: 0,
    insetInlineEnd: 0,
    position: "absolute",
    zIndex: 3,
  },
  sticky: {
    // Beside the page, in view while the window scrolls.
    alignSelf: "flex-start",
    flexShrink: 0,
    height: "var(--size-viewport-height)",
    position: "sticky",
    top: 0,
  },
});

const widths = stylex.create({
  of: (width: number) => ({ width }),
});

/** The milliseconds the width eases over as the column folds or unfolds. */
const EASE_MS = 200;

/** The folded rail's width, the left sidebar's (R3). */
const RAIL = "var(--size-rail)";

/**
 * The least room a page takes beside the column on a half screen: a reading pane, and the wide
 * page's inset at each side (`Page.tsx`).
 */
const PAGE_LEAST = "calc(var(--size-reading-pane) + 2 * var(--spacing-8))";

/** What the column draws, beside its page or over it. */
type ColumnParts = {
  children: ReactNode;
  header: ReactNode;
  isFilled: boolean;
  label: string;
  rail: ReactNode;
  resizable: ReturnType<typeof useResizable>;
};

/** The column's content at its width, under its header. */
function Content({
  children,
  header,
  isFilled,
  label,
  onPointer,
  width,
}: Pick<ColumnParts, "children" | "header" | "isFilled" | "label"> & {
  onPointer?: (over: boolean) => void;
  width: number;
}) {
  return (
    <div
      onPointerEnter={() => onPointer?.(true)}
      onPointerLeave={() => onPointer?.(false)}
      {...stylex.props(styles.full, isFilled && styles.filled, widths.of(width))}
    >
      <div {...stylex.props(styles.header)}>{header ?? <Text type="label">{label}</Text>}</div>
      {children}
    </div>
  );
}

/**
 * The column itself: its content at its width, or its rail, with the resize bar along its edge
 * while shown.
 */
function Column({
  children,
  easing,
  header,
  isFilled,
  isShown,
  label,
  onPointer,
  onUnfold,
  rail,
  resizable,
}: ColumnParts & {
  easing: boolean;
  isShown: boolean;
  onPointer: (over: boolean) => void;
  onUnfold: (event: MouseEvent) => void;
}) {
  return (
    <div {...stylex.props(styles.sticky)}>
      <LayoutPanel
        hasDivider
        label={label}
        onClick={onUnfold}
        padding={0}
        role="complementary"
        width={isShown ? resizable.size : RAIL}
        xstyle={[styles.panel, easing && styles.easing, isShown && isFilled && styles.filledPanel]}
      >
        {isShown ? (
          <Content
            header={header}
            isFilled={isFilled}
            label={label}
            onPointer={onPointer}
            width={resizable.size}
          >
            {children}
          </Content>
        ) : (
          <div {...stylex.props(styles.rail)}>{rail}</div>
        )}
      </LayoutPanel>
      {isShown && (
        <ResizeHandle
          isAlwaysVisible={false}
          isReversed
          label={`Resize ${label.toLowerCase()}`}
          pillPlacement="end"
          position="overlay"
          resizable={resizable.props}
          xstyle={styles.edge}
        />
      )}
    </div>
  );
}

/**
 * Keeps the keyboard's focus as the railed column opens and closes, as its button goes with the
 * rail: opened from the button, the focus moves to the open tab; closed by Escape from inside it,
 * back to the button, which `useRail` keeps from opening it again.
 */
function useRailFocus(
  isOpen: boolean,
  wasEscaped: () => boolean,
  place: RefObject<HTMLElement | null>,
  button: RefObject<HTMLButtonElement | null>,
) {
  // Whether the button held the focus as the column opened, which removed it.
  const onButton = useRef(false);
  useLayoutEffect(() => {
    const lost = document.activeElement === null || document.activeElement === document.body;
    if (isOpen && lost && onButton.current) {
      place.current?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')?.focus();
    }
    if (!isOpen && lost && wasEscaped()) {
      button.current?.focus();
    }
    onButton.current = false;
  }, [button, isOpen, place, wasEscaped]);
  /** The button's own focus handlers. */
  return {
    onBlur: () => {
      onButton.current = false;
    },
    onFocus: () => {
      onButton.current = true;
    },
  };
}

/**
 * The column railed on a half screen: its rail in the page's flow, which opens over the page at
 * the column's width, without moving it, as the sidebar's rail does (`useRail`): the mouse resting
 * on it, the keyboard's focus in it, a tap on its button or its space, `]`, or
 * `showDocumentColumn`. It closes as the sidebar's: the mouse or the focus leaving, Escape, a tap
 * outside, `]`, or its button. Mounted only while railed, so it starts closed.
 */
function RailedColumn({
  children,
  header,
  isFilled,
  keyed,
  label,
  rail,
  resizable,
}: ColumnParts & { keyed: (run: (() => void) | undefined) => void }) {
  const place = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const railed = useRail(true, place, button);
  const { isOpen, tap } = railed;
  const buttonFocus = useRailFocus(isOpen, railed.wasEscaped, place, button);
  const open = useCallback(() => {
    if (!isOpen) {
      tap();
    }
  }, [isOpen, tap]);
  useOpenOnShow(open);
  // `]` is the column's own key, `ColumnAt`'s: railed, it opens or closes the rail.
  useLayoutEffect(() => {
    keyed(tap);
    return () => keyed(undefined);
  }, [keyed, tap]);
  const name = label.toLowerCase();
  // A tap on the rail's space, not on a control or a link in it, opens the column.
  const opens = (event: MouseEvent) => {
    if (!isOpen && !(event.target as Element).closest("a, button")) {
      tap();
    }
  };
  return (
    <div {...stylex.props(styles.sticky, styles.railRoom)}>
      <div ref={place} {...railed.handlers} {...stylex.props(styles.over)}>
        <LayoutPanel
          hasDivider
          label={label}
          onClick={opens}
          padding={0}
          role="complementary"
          width={isOpen ? resizable.size : RAIL}
          xstyle={[styles.panel, styles.easing, isOpen && isFilled && styles.filledPanel]}
        >
          {isOpen ? (
            <Content header={header} isFilled={isFilled} label={label} width={resizable.size}>
              {children}
            </Content>
          ) : (
            <div {...stylex.props(styles.rail)}>
              <IconButton
                aria-expanded={false}
                icon={<Icon icon="uraeda:panel-right" />}
                label={`Show ${name}`}
                onClick={tap}
                ref={button}
                {...buttonFocus}
                variant="ghost"
              />
              {rail}
            </div>
          )}
        </LayoutPanel>
      </div>
    </div>
  );
}

/** The column's own props, whichever keeps its width. */
type ColumnProps = {
  /** The column's own content. */
  children: ReactNode;
  /** The page beside it. */
  content: ReactNode;
  /** What its top shows in place of its name, like its tabs. */
  header?: ReactNode;
  /** Keeps it beside its page on a half screen, never a rail over it, as a session's column. */
  isBeside?: boolean;
  /**
   * Whether its content fills its height, a column of parts that scroll on their own, as a split
   * panel's do, rather than the column scrolling as a whole.
   */
  isFilled?: boolean;
  /** Shows its hide button as under the pointer, for a story. */
  isRevealed?: boolean;
  isShown: boolean;
  /** Its name, "The session's column": its landmark's, and its buttons' and its edge's. */
  label: string;
  onShownChange: (shown: boolean) => void;
  /** What the folded rail shows: its key information, as icons and short counts. */
  rail?: ReactNode;
};

/**
 * The column, at the width `width` holds, which its caller keeps, as the document's column does
 * (`DocumentColumn.tsx`).
 */
export function SideColumn({
  width,
  ...props
}: ColumnProps & { width: ReturnType<typeof useResizable> }) {
  return <ColumnAt {...props} resizable={width} />;
}

/** The column beside its page, at the width `resizable` holds. */
function ColumnAt({
  children,
  content,
  header,
  isBeside = false,
  isFilled = false,
  isRevealed: revealedByStory,
  isShown,
  label,
  onShownChange,
  rail,
  resizable,
}: ColumnProps & { resizable: ReturnType<typeof useResizable> }) {
  const widthClass = useWidthClass();
  const wide = !isNarrow(widthClass);
  // Railed on a half screen when the page beside the column would keep less than a reading pane.
  const box = useRef<HTMLDivElement>(null);
  const page = useLengthIn(box, PAGE_LEAST);
  const railed =
    widthClass === "semi" && !isBeside && page.width > 0 && page.width - resizable.size < page.px;
  const beside = wide && !railed;
  const [pointer, setPointer] = useState(false);
  const [easing, setEasing] = useState(false);
  const revealed = revealedByStory ?? pointer;
  const folded = wide && !isShown;
  const change = (next: boolean) => {
    setEasing(true);
    setTimeout(() => setEasing(false), EASE_MS);
    onShownChange(next);
  };
  // Railed, the rail's own open and close (`RailedColumn`); else the fold.
  const railTap = useRef<() => void>(undefined);
  const keyRail = useCallback((run: (() => void) | undefined) => {
    railTap.current = run;
  }, []);
  const toggle = () => (railed ? railTap.current?.() : change(!isShown));
  const keyLabel = railed ? "Open right column" : "Fold right column";
  // Wide and semi-wide only, as the column is: the leader's `u ]` is the same key, named in full.
  useKeys(
    wide
      ? [
          { keys: "]", label: keyLabel, run: toggle },
          { icon: "uraeda:panel-right", keys: "space u ]", label: keyLabel, run: toggle },
        ]
      : [],
    "shell",
  );
  // A click on the rail's space, not on a control or a link in it, unfolds the column.
  const unfold = (event: MouseEvent) => {
    if (folded && !(event.target as Element).closest("a, button")) {
      change(true);
    }
  };
  const name = label.toLowerCase();
  const parts = { header, isFilled, label, rail, resizable };
  return (
    <div ref={box}>
      {beside && (
        <div {...stylex.props(styles.bar)}>
          <IconButton
            icon={<Icon icon="uraeda:panel-right" />}
            label={isShown ? `Hide ${name}` : `Show ${name}`}
            onClick={toggle}
            onPointerEnter={() => setPointer(true)}
            onPointerLeave={() => setPointer(false)}
            variant="ghost"
            xstyle={[styles.button, isShown && !revealed && styles.hidden]}
          />
        </div>
      )}
      <Layout
        content={content}
        end={
          railed ? (
            <RailedColumn {...parts} keyed={keyRail}>
              {children}
            </RailedColumn>
          ) : beside ? (
            <Column
              easing={easing}
              header={header}
              isFilled={isFilled}
              isShown={isShown}
              label={label}
              onPointer={setPointer}
              onUnfold={unfold}
              rail={rail}
              resizable={resizable}
            >
              {children}
            </Column>
          ) : undefined
        }
        height="auto"
      />
    </div>
  );
}
