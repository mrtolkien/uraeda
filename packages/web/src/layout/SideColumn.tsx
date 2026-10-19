// A page's column at the window's right edge, on wide screens: resized from a bar along its edge,
// its width kept in the browser, and folded to a rail or unfolded from one button at the page's top
// right, which keeps its spot in both states (C3): shown under the pointer over the column, always
// to the keyboard and on touch, and always while the column is folded; `]` does the same, and so
// does a click on the rail's empty space. The width eases over 200 ms, at once under reduced
// motion. The page keeps its place in the tree as the column folds and unfolds, or the width
// changes, so its transcript, focus, and errors stay.
import { useHotkeys } from "@astryxdesign/core/hooks";
import { Icon } from "@astryxdesign/core/Icon";
import { IconButton } from "@astryxdesign/core/IconButton";
import { Layout, LayoutPanel } from "@astryxdesign/core/Layout";
import { ResizeHandle, useResizable } from "@astryxdesign/core/Resizable";
import { Text } from "@astryxdesign/core/Text";
import { easeVars, sizeVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { type MouseEvent, type ReactNode, useState } from "react";
import { useWidthClass } from "./useWidthClass.ts";

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
  header: {
    alignItems: "center",
    display: "flex",
    minHeight: sizeVars["--size-element-md"],
    paddingBlock: spacingVars["--spacing-2"],
    paddingInline: spacingVars["--spacing-3"],
  },
  hidden: {
    // Still focusable, and shown once focused: only its look waits for the pointer.
    opacity: { ":focus-visible": 1, "@media (hover: none)": 1, default: 0 },
  },
  panel: {
    // As tall as the window, so the column and its edge run the whole height, scrolling on its own
    // when its content is taller.
    boxSizing: "border-box",
    height: "100%",
    overflowX: "hidden",
    overflowY: "auto",
  },
  rail: {
    // Folded: the rail's icons, under the button that unfolds it.
    alignItems: "center",
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    gap: spacingVars["--spacing-3"],
    minHeight: "100%",
    paddingBlockStart: spacingVars["--spacing-12"],
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

/** The folded rail's width, the left sidebar's. */
const RAIL = 48;

/**
 * The column itself: its content at its width, or its rail, with the resize bar along its edge
 * while shown.
 */
function Column({
  children,
  easing,
  isShown,
  label,
  onPointer,
  onUnfold,
  rail,
  resizable,
}: {
  children: ReactNode;
  easing: boolean;
  isShown: boolean;
  label: string;
  onPointer: (over: boolean) => void;
  onUnfold: (event: MouseEvent) => void;
  rail: ReactNode;
  resizable: ReturnType<typeof useResizable>;
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
        xstyle={[styles.panel, easing && styles.easing]}
      >
        {isShown ? (
          <div
            onPointerEnter={() => onPointer(true)}
            onPointerLeave={() => onPointer(false)}
            {...stylex.props(styles.full, widths.of(resizable.size))}
          >
            <div {...stylex.props(styles.header)}>
              <Text type="label">{label}</Text>
            </div>
            {children}
          </div>
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

export function SideColumn({
  children,
  content,
  isRevealed: revealedByStory,
  isShown,
  label,
  onShownChange,
  rail,
  sizes = { default: 320, min: 280 },
  storageKey,
}: {
  /** The column's own content. */
  children: ReactNode;
  /** The page beside it. */
  content: ReactNode;
  /** Shows its hide button as under the pointer, for a story. */
  isRevealed?: boolean;
  isShown: boolean;
  /** Its name, "Progress": its heading, and its buttons' names. */
  label: string;
  onShownChange: (shown: boolean) => void;
  /** What the folded rail shows: its key information, as icons and short counts. */
  rail?: ReactNode;
  /** Its width at first and its least, in px: 320 and 280 unless its content needs more. */
  sizes?: { default: number; min: number };
  /** Where its width is kept in the browser. */
  storageKey: string;
}) {
  const wide = useWidthClass() === "wide";
  const resizable = useResizable({
    autoSaveId: storageKey,
    defaultSize: sizes.default,
    maxSize: 560,
    minSize: sizes.min,
  });
  const [pointer, setPointer] = useState(false);
  const [easing, setEasing] = useState(false);
  const revealed = revealedByStory ?? pointer;
  const folded = wide && !isShown;
  const change = (next: boolean) => {
    setEasing(true);
    setTimeout(() => setEasing(false), EASE_MS);
    onShownChange(next);
  };
  const toggle = () => change(!isShown);
  useHotkeys([{ isDisabled: !wide, keys: "]", onPress: toggle }]);
  // A click on the rail's space, not on a control or a link in it, unfolds the column.
  const unfold = (event: MouseEvent) => {
    if (folded && !(event.target as Element).closest("a, button")) {
      change(true);
    }
  };
  const name = label.toLowerCase();
  return (
    <div>
      {wide && (
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
          wide ? (
            <Column
              easing={easing}
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
