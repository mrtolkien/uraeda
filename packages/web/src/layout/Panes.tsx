import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import * as stylex from "@stylexjs/stylex";
import { borderVars, colorVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import { type ReactNode, useLayoutEffect, useRef } from "react";
import { useRestorePaneScroll } from "../routes.tsx";
import { useWidthClass } from "./useWidthClass.ts";

const styles = stylex.create({
  close: {
    paddingBlockStart: spacingVars["--spacing-2"],
    paddingInline: spacingVars["--spacing-2"],
  },
  detail: {
    // The detail stays in view beside the list, which scrolls with the page, and scrolls on its
    // own. As tall as the window, so its edge runs the whole height beside the list.
    borderInlineStartColor: colorVars["--color-border"],
    borderInlineStartStyle: "solid",
    borderInlineStartWidth: borderVars["--border-width"],
    boxSizing: "border-box",
    height: "var(--size-viewport-height)",
    overflowY: "auto",
    position: "sticky",
    top: 0,
  },
  list: {
    minWidth: 0,
  },
  panes: {
    alignItems: "start",
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(var(--size-pane-min), 40%)",
  },
});

/**
 * A list and the detail opened from it: side by side on wide screens, the detail 40% wide and at
 * least 400 px, keeping its own scroll position for Back, and shown from its top when it shows
 * another item, `detailKey`, in the same entry; on narrow screens, the detail alone when there is
 * one, else the list. `onCloseDetail` draws a Close above the detail; without it, the detail draws
 * its own.
 */
export function Panes({
  detail,
  detailKey,
  list,
  onCloseDetail,
}: {
  detail: ReactNode | undefined;
  detailKey?: string;
  list: ReactNode;
  onCloseDetail?: () => void;
}) {
  const wide = useWidthClass() === "wide";
  const pane = useRef<HTMLElement>(null);
  // Back returns to where the detail was scrolled, as it does the page.
  useRestorePaneScroll(pane, wide && detail !== undefined);
  // Another item, as the list's keys follow: read from its top, not where the last one was.
  const shown = useRef(detailKey);
  useLayoutEffect(() => {
    if (shown.current !== detailKey && pane.current) {
      pane.current.scrollTop = 0;
    }
    shown.current = detailKey;
  }, [detailKey]);
  if (!wide) {
    return <>{detail ?? list}</>;
  }
  if (detail === undefined) {
    return <>{list}</>;
  }
  return (
    <div {...stylex.props(styles.panes)}>
      <div {...stylex.props(styles.list)}>{list}</div>
      <section ref={pane} {...stylex.props(styles.detail)} aria-label="Detail">
        {onCloseDetail && (
          <div {...stylex.props(styles.close)}>
            <HStack justify="end">
              <Button
                icon={<Icon icon="close" />}
                isIconOnly
                label="Close"
                onClick={onCloseDetail}
                variant="ghost"
              />
            </HStack>
          </div>
        )}
        {detail}
      </section>
    </div>
  );
}
