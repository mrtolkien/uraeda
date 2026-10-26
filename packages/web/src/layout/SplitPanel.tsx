// A split panel of the column (approval comment C1 of the session's spec): a panel holding two
// panels, one above the other, shown as one tab. The top one takes the room left, scrolling on its
// own; the bottom one sits under it, titled by its name, and takes at most 40% of the height,
// scrolling past it (the spec's assumption), so it never pushes the top one out of view. Each part
// is a region named by its panel, in the tab order, so the keyboard scrolls it: the column around
// them no longer scrolls. Each part is a container of its width, which its rows' parts size by. The
// session column splits Activity, or Sub-agents, over Changes this way.
import { spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { type ReactNode, useId } from "react";
import type { ColumnPanel } from "./DocumentColumn.tsx";
import { GroupTitle } from "./GroupTitle.tsx";
import { ruleStyles } from "./rules.ts";

const styles = stylex.create({
  // The bottom panel: a rule across the column's whole width over it, as between a terminal's
  // panes, its content kept in the column's inset (`SideColumn.tsx`'s `full`).
  bottom: {
    containerType: "inline-size",
    flexShrink: 0,
    marginInline: `calc(-1 * ${spacingVars["--spacing-4"]})`,
    maxHeight: "40%",
    overflowY: "auto",
    paddingBlockEnd: spacingVars["--spacing-2"],
    paddingInline: spacingVars["--spacing-4"],
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
  return (
    <div {...stylex.props(styles.split)}>
      <section aria-label={topLabel} tabIndex={0} {...stylex.props(styles.top)}>
        {top}
      </section>
      <section
        aria-labelledby={headingId}
        tabIndex={0}
        {...stylex.props(ruleStyles.above, styles.bottom)}
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
 * column. `bottom` is titled by its name, a level-3 heading, at most 40% of the column's height.
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
