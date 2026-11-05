import * as stylex from "@stylexjs/stylex";
import { borderVars, colorVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import { type ReactNode, useLayoutEffect, useRef } from "react";
import { useRestorePaneScroll } from "../routes.tsx";
import { useScreenCentre } from "./useScreenCentre.ts";
import { isNarrow, useWidthClass } from "./useWidthClass.ts";

const styles = stylex.create({
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
  framed: {
    // Its content draws its own pane, with a border: the edge would double it.
    borderInlineStartWidth: 0,
    paddingBlock: spacingVars["--spacing-3"],
    paddingInline: spacingVars["--spacing-2"],
  },
  // The detail's content grows to its foot (`fills`), as a diff in lazygit fills its side: held
  // at the page's top room as the list scrolls, and ending a step above the status line.
  filled: {
    display: "flex",
    flexDirection: "column",
    height: `calc(var(--size-viewport-height) - ${spacingVars["--spacing-6"]} - ${spacingVars["--spacing-3"]})`,
    paddingBlockEnd: 0,
    top: spacingVars["--spacing-6"],
  },
  list: {
    minWidth: 0,
  },
  panes: {
    alignItems: "start",
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(var(--size-pane-min), 40%)",
  },
  // Columns of their own, `columns`, the room's width up to `most`: the two together are put in
  // the middle of the room right of the sidebar (`useScreenCentre`).
  // A gutter between them, as two framed panes side by side read cramped without one.
  sized: (columns: string, most: string) => ({
    columnGap: spacingVars["--spacing-6"],
    gridTemplateColumns: columns,
    maxWidth: most,
    width: "100%",
  }),
});

/**
 * A list and the detail opened from it: side by side on wide screens, the detail 40% wide and at
 * least 400 px, keeping its own scroll position for Back, and shown from its top when it shows
 * another item, `detailKey`, in the same entry; on narrow screens, the detail alone when there is
 * one, else the list. The detail draws its own Close. With `columns`, the list and the detail
 * take those columns, up to `most` together, centred together, both drawing their own panes, so
 * the detail draws no edge.
 * `isSplit` says whether they are side by side, rather than the screen's width alone.
 */
export function Panes({
  columns,
  detail,
  detailKey,
  fills = false,
  isSplit,
  list,
  most = "none",
}: {
  /** The list's and the detail's columns, a grid's template: the detail's 40% by default. */
  columns?: string;
  detail: ReactNode | undefined;
  detailKey?: string;
  /** Whether the detail's content, given `flexGrow`, fills the detail down to its foot. */
  fills?: boolean;
  isSplit?: boolean;
  list: ReactNode;
  /** With `columns`, the most the two take together. */
  most?: string;
}) {
  const narrow = isNarrow(useWidthClass());
  const wide = isSplit ?? !narrow;
  const centred = useScreenCentre(wide && columns !== undefined && detail !== undefined);
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
    <div
      ref={centred}
      {...stylex.props(styles.panes, columns !== undefined && styles.sized(columns, most))}
    >
      <div {...stylex.props(styles.list)}>{list}</div>
      <section
        ref={pane}
        {...stylex.props(
          styles.detail,
          columns !== undefined && styles.framed,
          fills && styles.filled,
        )}
        aria-label="Detail"
      >
        {detail}
      </section>
    </div>
  );
}
