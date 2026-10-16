// A page's column at the window's right edge, on wide screens: resized from its edge, its width kept
// in the browser, and hidden or shown from one button at the page's top right, which keeps its spot
// in both states (C3): shown under the pointer over the column, always to the keyboard and on
// touch, and always while the column is hidden; `]` does the same. The page keeps its place in the
// tree as the column comes and goes, or the width changes, so its transcript, focus, and errors
// stay.
import { useHotkeys } from "@astryxdesign/core/hooks";
import { Icon } from "@astryxdesign/core/Icon";
import { IconButton } from "@astryxdesign/core/IconButton";
import { Layout, LayoutPanel } from "@astryxdesign/core/Layout";
import { ResizeHandle, useResizable } from "@astryxdesign/core/Resizable";
import { Text } from "@astryxdesign/core/Text";
import { sizeVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { type ReactNode, useState } from "react";
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
    // Beside the page, in view while the window scrolls, scrolling on its own when taller than the
    // window.
    alignSelf: "flex-start",
    maxHeight: "var(--size-viewport-height)",
    overflowY: "auto",
    position: "sticky",
    top: 0,
  },
});

export function SideColumn({
  children,
  content,
  isRevealed: revealedByStory,
  isShown,
  label,
  onShownChange,
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
  /** Where its width is kept in the browser. */
  storageKey: string;
}) {
  const wide = useWidthClass() === "wide";
  const resizable = useResizable({
    autoSaveId: storageKey,
    defaultSize: 320,
    maxSize: 560,
    minSize: 280,
  });
  const [pointer, setPointer] = useState(false);
  const revealed = revealedByStory ?? pointer;
  const shown = wide && isShown;
  const toggle = () => onShownChange(!isShown);
  useHotkeys([{ isDisabled: !wide, keys: "]", onPress: toggle }]);
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
          shown ? (
            <>
              <ResizeHandle isReversed label={`Resize ${name}`} resizable={resizable.props} />
              <LayoutPanel
                label={label}
                resizable={resizable.props}
                role="complementary"
                xstyle={styles.panel}
              >
                <div
                  onPointerEnter={() => setPointer(true)}
                  onPointerLeave={() => setPointer(false)}
                >
                  <div {...stylex.props(styles.header)}>
                    <Text type="label">{label}</Text>
                  </div>
                  {children}
                </div>
              </LayoutPanel>
            </>
          ) : undefined
        }
        height="auto"
      />
    </div>
  );
}
