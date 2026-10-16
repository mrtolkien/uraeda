// A page's column at the window's right edge, on wide screens: resized from its edge, its width kept
// in the browser, and hidden from the button at its top, shown under the pointer and always to the
// keyboard and on touch. Hidden, the page shows the button that brings it back at its top right.
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { IconButton } from "@astryxdesign/core/IconButton";
import { Layout, LayoutPanel } from "@astryxdesign/core/Layout";
import { ResizeHandle, useResizable } from "@astryxdesign/core/Resizable";
import { Text } from "@astryxdesign/core/Text";
import { spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { type ReactNode, useState } from "react";

const styles = stylex.create({
  header: {
    paddingBlock: spacingVars["--spacing-2"],
    paddingInline: spacingVars["--spacing-3"],
  },
  hidden: {
    // Still focusable, and shown once focused: only its look waits for the pointer.
    opacity: { ":focus-visible": 1, "@media (hover: none)": 1, default: 0 },
  },
  show: {
    paddingBlock: spacingVars["--spacing-2"],
    paddingInline: spacingVars["--spacing-3"],
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
  const resizable = useResizable({
    autoSaveId: storageKey,
    defaultSize: 320,
    maxSize: 560,
    minSize: 280,
  });
  const [pointer, setPointer] = useState(false);
  const revealed = revealedByStory ?? pointer;
  if (!isShown) {
    return (
      <Layout
        content={
          <>
            <HStack justify="end" xstyle={styles.show}>
              <IconButton
                icon={<Icon icon="uraeda:panel-right" />}
                label={`Show ${label.toLowerCase()}`}
                onClick={() => onShownChange(true)}
                variant="ghost"
              />
            </HStack>
            {content}
          </>
        }
        height="auto"
      />
    );
  }
  return (
    <Layout
      content={content}
      end={
        <>
          <ResizeHandle
            isReversed
            label={`Resize ${label.toLowerCase()}`}
            resizable={resizable.props}
          />
          <LayoutPanel label={label} resizable={resizable.props} role="complementary">
            <div onPointerEnter={() => setPointer(true)} onPointerLeave={() => setPointer(false)}>
              <HStack align="center" justify="between" xstyle={styles.header}>
                <Text type="label">{label}</Text>
                <IconButton
                  icon={<Icon icon="uraeda:panel-right" />}
                  label={`Hide ${label.toLowerCase()}`}
                  onClick={() => onShownChange(false)}
                  variant="ghost"
                  xstyle={revealed ? undefined : styles.hidden}
                />
              </HStack>
              {children}
            </div>
          </LayoutPanel>
        </>
      }
      height="auto"
    />
  );
}
