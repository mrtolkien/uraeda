// The title of a group inside a pane or a column, such as a list's "Decisions · 12": smaller than a
// pane's, its count in secondary text, its actions at its end. Every such title is drawn here, so a
// group reads the same on every page (UI components).
import { Heading, type HeadingLevel } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { colorVars, fontWeightVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

const styles = stylex.create({
  count: {
    color: colorVars["--color-text-secondary"],
    fontWeight: fontWeightVars["--font-weight-normal"],
  },
});

/**
 * A group's title at the size of a level-4 heading, `level` its level to assistive technology, its
 * `count` after it, "· 12", and `actions` at the end of its row, which wrap under it when the row is
 * too narrow. `id` names the heading, as a jump's target or a region's label.
 */
export function GroupTitle({
  actions,
  children,
  count,
  id,
  level,
}: {
  actions?: ReactNode;
  children: ReactNode;
  count?: number;
  id?: string;
  level: HeadingLevel;
}) {
  const heading = (
    <Heading accessibilityLevel={level} id={id} level={4}>
      {children}
      {count !== undefined && (
        <>
          {" "}
          <span {...stylex.props(styles.count)}>· {count}</span>
        </>
      )}
    </Heading>
  );
  return actions ? (
    <HStack align="center" gap={3} justify="between" wrap="wrap">
      {heading}
      {actions}
    </HStack>
  ) : (
    heading
  );
}
