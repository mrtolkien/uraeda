// Home's parts: its rows, the shell's two-line card row with a whole title; the "Overview" line
// between the core and the widgets; two columns from semi-wide; a pane's empty line and its link.
import { Button } from "@astryxdesign/core/Button";
import { Grid } from "@astryxdesign/core/Grid";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Text } from "@astryxdesign/core/Text";
import {
  borderVars,
  colorVars,
  spacingVars,
  typeScaleVars,
} from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";
import { isNarrow, useWidthClass } from "../layout/useWidthClass.ts";
import type { Status } from "../sidebar/cards.ts";
import { CardRow } from "../sidebar/CardRow.tsx";
import { StatusMark } from "../StatusMark.tsx";

const styles = stylex.create({
  // The core's two panes: the first the wider, as the mockup draws them.
  core: { alignItems: "start", gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 1fr)" },
  empty: {
    paddingBlock: spacingVars["--spacing-2"],
    paddingInline: spacingVars["--spacing-2"],
  },
  foot: {
    paddingInline: spacingVars["--spacing-1"],
  },
  one: { gridTemplateColumns: "minmax(0, 1fr)" },
  rule: {
    borderBlockStartColor: colorVars["--color-border"],
    borderBlockStartStyle: "dashed",
    borderBlockStartWidth: borderVars["--border-width"],
    flexGrow: 1,
  },
  separator: {
    alignItems: "center",
    display: "flex",
    gap: spacingVars["--spacing-3"],
    marginBlockStart: spacingVars["--spacing-4"],
  },
  separatorTitle: {
    color: colorVars["--color-text-secondary"],
    fontSize: typeScaleVars["--text-supporting-size"],
    textTransform: "uppercase",
  },
  two: { alignItems: "start", gridTemplateColumns: "repeat(2, minmax(0, 1fr))" },
});

/**
 * A row of home: its icon, its whole title, wrapping, its information on a second line, and at its
 * end what it asks of the human, or its session's status. The shell's card row, read whole by
 * screen readers in the order it shows.
 */
export function HomeRow({
  action,
  href,
  icon,
  status,
  sub,
  title,
}: {
  /** What it asks, like "Answer". */
  action?: string;
  href: string;
  icon: ReactNode;
  /** Its session's status, as the shell's cards show it. */
  status?: Status | undefined;
  sub?: string | undefined;
  title: string;
}) {
  return (
    <CardRow
      endContent={
        action ? (
          <HStack align="center" gap={1}>
            <Text color="accent" type="supporting" weight="semibold">
              {action}
            </Text>
            <Text aria-hidden="true" color="secondary" type="supporting">
              ›
            </Text>
          </HStack>
        ) : (
          status && <StatusMark label={status.label} status={status.status} />
        )
      }
      href={href}
      icon={icon}
      isSelected={false}
      label={title}
      name={[title, sub, action ?? status?.label].filter(Boolean).join(", ")}
      sub={sub}
    />
  );
}

/** A pane's line when it has no row. */
export function Empty({ children }: { children: string }) {
  return (
    <Text color="secondary" display="block" type="supporting" xstyle={styles.empty}>
      {children}
    </Text>
  );
}

/** A pane's link to the page it sums up, at its foot. */
export function PaneLink({ href, label }: { href: string; label: string }) {
  return (
    <div {...stylex.props(styles.foot)}>
      <Button href={href} label={label} size="sm" variant="ghost" />
    </div>
  );
}

/**
 * The dashed line between the core and the widgets, its title "Overview" in the middle: a heading
 * of the panes under it, the line itself drawn for the eye alone.
 */
export function Overview() {
  return (
    <div {...stylex.props(styles.separator)}>
      <span aria-hidden="true" {...stylex.props(styles.rule)} />
      <Heading level={2} xstyle={styles.separatorTitle}>
        Overview
      </Heading>
      <span aria-hidden="true" {...stylex.props(styles.rule)} />
    </div>
  );
}

/**
 * Two columns from semi-wide, one on the phone: `isCore`, the core's, its first the wider; else the
 * widgets', even.
 */
export function Columns({ children, isCore = false }: { children: ReactNode; isCore?: boolean }) {
  const narrow = isNarrow(useWidthClass());
  return (
    <Grid gap={narrow ? 1 : 4} xstyle={narrow ? styles.one : isCore ? styles.core : styles.two}>
      {children}
    </Grid>
  );
}
