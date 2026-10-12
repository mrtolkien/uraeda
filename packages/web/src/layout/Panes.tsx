import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import * as stylex from "@stylexjs/stylex";
import { borderVars, colorVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import type { ReactNode } from "react";
import { useWidthClass } from "./useWidthClass.ts";

const styles = stylex.create({
  panes: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(var(--size-pane-min), 40%)",
    alignItems: "start",
  },
  list: {
    minWidth: 0,
  },
  // The detail stays in view beside the list, which scrolls with the page, and scrolls on its own.
  // As tall as the window, so its edge runs the whole height beside the list.
  detail: {
    position: "sticky",
    top: 0,
    boxSizing: "border-box",
    height: "var(--size-viewport-height)",
    overflowY: "auto",
    borderInlineStartWidth: borderVars["--border-width"],
    borderInlineStartStyle: "solid",
    borderInlineStartColor: colorVars["--color-border"],
  },
  close: {
    paddingBlockStart: spacingVars["--spacing-2"],
    paddingInline: spacingVars["--spacing-2"],
  },
});

/**
 * A list and the detail opened from it: side by side on wide screens, the detail 40% wide and at
 * least 400 px; on narrow screens, the detail alone when there is one, else the list.
 */
export function Panes({
  list,
  detail,
  onCloseDetail,
}: {
  list: ReactNode;
  detail: ReactNode | undefined;
  onCloseDetail: () => void;
}) {
  const wide = useWidthClass() === "wide";
  if (!wide) {
    return <>{detail ?? list}</>;
  }
  if (detail === undefined) {
    return <>{list}</>;
  }
  return (
    <div {...stylex.props(styles.panes)}>
      <div {...stylex.props(styles.list)}>{list}</div>
      <section {...stylex.props(styles.detail)} aria-label="Detail">
        <div {...stylex.props(styles.close)}>
          <HStack justify="end">
            <Button
              variant="ghost"
              label="Close"
              isIconOnly
              icon={<Icon icon="close" />}
              onClick={onCloseDetail}
            />
          </HStack>
        </div>
        {detail}
      </section>
    </div>
  );
}
