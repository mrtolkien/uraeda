// A split panel of the column (approval comment C1 of the session's spec): a panel holding two
// panels, one above the other, shown as one tab. The top one takes the room left, scrolling on its
// own; the bottom one sits under it, titled by its name, and takes at most 40% of the height,
// scrolling past it (the spec's assumption), so it never pushes the top one out of view. The
// session column splits Activity, or Sub-agents, over Changes this way.
import { Heading } from "@astryxdesign/core/Heading";
import { borderVars, colorVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { type ReactNode, useId } from "react";
import type { ColumnPanel } from "./DocumentColumn.tsx";

const styles = stylex.create({
  // The bottom panel: a rule across the column's whole width over it, as between a terminal's
  // panes, its content kept in the column's inset (`SideColumn.tsx`'s `full`).
  bottom: {
    borderBlockStartColor: colorVars["--color-border"],
    borderBlockStartStyle: "solid",
    borderBlockStartWidth: borderVars["--border-width"],
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
    flexGrow: 1,
    minHeight: 0,
    overflowY: "auto",
    paddingBlockEnd: spacingVars["--spacing-2"],
  },
});

/** `top` above, scrolling on its own, and `bottom` under it, a section named `label`. */
function Split({ bottom, label, top }: { bottom: ReactNode; label: string; top: ReactNode }) {
  const headingId = useId();
  return (
    <div {...stylex.props(styles.split)}>
      <div {...stylex.props(styles.top)}>{top}</div>
      <section aria-labelledby={headingId} {...stylex.props(styles.bottom)}>
        <Heading accessibilityLevel={3} id={headingId} level={4} xstyle={styles.heading}>
          {label}
        </Heading>
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
    content: <Split bottom={bottom.content} label={bottom.label} top={top.content} />,
    fills: true,
    icon: top.icon,
    key: top.key,
    label: top.label,
  };
}
