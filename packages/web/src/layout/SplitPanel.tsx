// A split panel of the column (approval comment C1 of the session's spec): a panel holding two
// panels, one above the other, shown as one tab. The top one takes the room left, scrolling on its
// own; the bottom one sits under it, titled by its name, 40% of the height at first, scrolling
// past it, and resized from the rule between them, dragged or with the arrows, its height kept in
// the browser: it never pushes the top one out of view. Each part
// is a region named by its panel, in the tab order, so the keyboard scrolls it: the column around
// them no longer scrolls. Each part is a container of its width, which its rows' parts size by. The
// session column splits Activity, or Sub-agents, over Changes this way.
import { ResizeHandle, useResizable } from "@astryxdesign/core/Resizable";
import { spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { type ReactNode, useId, useRef } from "react";
import type { ColumnPanel } from "./DocumentColumn.tsx";
import { GroupTitle } from "./GroupTitle.tsx";

const styles = stylex.create({
  // The bottom panel, at the height its handle holds, its content kept in the column's inset
  // (`SideColumn.tsx`'s `full`).
  bottom: (height: number) => ({
    containerType: "inline-size",
    flexShrink: 0,
    height,
    marginInline: `calc(-1 * ${spacingVars["--spacing-4"]})`,
    overflowY: "auto",
    paddingBlockEnd: spacingVars["--spacing-2"],
    paddingInline: spacingVars["--spacing-4"],
  }),
  // The handle is the rule over the bottom panel, across the column's whole width, as between a
  // terminal's panes.
  handle: {
    marginInline: `calc(-1 * ${spacingVars["--spacing-4"]})`,
    width: "auto",
  },
  heading: {
    marginBlock: spacingVars["--spacing-2"],
  },
  split: {
    display: "flex",
    flexDirection: "column",
    flexGrow: 1,
    minHeight: 0,
  },
  top: {
    containerType: "inline-size",
    flexGrow: 1,
    minHeight: 0,
    overflowY: "auto",
    paddingBlockEnd: spacingVars["--spacing-2"],
  },
});

/**
 * `top` above, a region named `topLabel` scrolling on its own, and `bottom` under it, a section
 * named `label`: both take the focus, so the keyboard scrolls them.
 */
function Split({
  bottom,
  label,
  top,
  topLabel,
}: {
  bottom: ReactNode;
  label: string;
  top: ReactNode;
  topLabel: string;
}) {
  const headingId = useId();
  const split = useRef<HTMLDivElement>(null);
  const height = useResizable({
    autoSaveId: "uraeda.split-bottom",
    containerRef: split,
    defaultSize: "40%",
    direction: "vertical",
    maxSize: "85%",
    minSize: 64,
  });
  return (
    <div ref={split} {...stylex.props(styles.split)}>
      <section aria-label={topLabel} tabIndex={0} {...stylex.props(styles.top)}>
        {top}
      </section>
      <ResizeHandle
        direction="vertical"
        hasDivider
        isAlwaysVisible={false}
        isReversed
        label={`Resize ${label.toLowerCase()}`}
        resizable={height.props}
        xstyle={styles.handle}
      />
      <section
        aria-labelledby={headingId}
        tabIndex={0}
        {...stylex.props(styles.bottom(height.size))}
      >
        <div {...stylex.props(styles.heading)}>
          <GroupTitle id={headingId} level={3}>
            {label}
          </GroupTitle>
        </div>
        {bottom}
      </section>
    </div>
  );
}

/**
 * A panel of `top` over `bottom`, shown as `top`'s tab: its key, name, icon, and badge, filling the
 * column. `bottom` is titled by its name, a level-3 heading, under a rule that resizes it.
 */
export function splitPanel(top: ColumnPanel, bottom: ColumnPanel): ColumnPanel {
  return {
    ...(top.badge === undefined ? {} : { badge: top.badge }),
    content: (
      <Split bottom={bottom.content} label={bottom.label} top={top.content} topLabel={top.label} />
    ),
    fills: true,
    icon: top.icon,
    key: top.key,
    label: top.label,
  };
}
