// A row of the Git page's sections, as the mockups draw it: its text first, its counts, date, or
// actions at its end; on the phone, those on a head line over the text, which then takes the whole
// width. A row is one of the list's keys' rows (`data-row`, by `data-row-key`): the focus on
// anything in it picks it.
import { HStack } from "@astryxdesign/core/HStack";
import { spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";
import { pickedStyles } from "../layout/picked.ts";
import { isNarrow, useWidthClass } from "../layout/useWidthClass.ts";

const styles = stylex.create({
  end: { flexShrink: 0, justifyContent: "flex-end" },
  row: {
    alignItems: "center",
    display: "flex",
    gap: spacingVars["--spacing-2"],
    justifyContent: "space-between",
    minWidth: 0,
    paddingBlock: spacingVars["--spacing-1"],
    paddingInline: spacingVars["--spacing-2"],
  },
  rowNarrow: { alignItems: "stretch", flexDirection: "column-reverse", gap: 0 },
  text: { flexGrow: 1, minWidth: 0 },
});

/**
 * A row, `isPicked` when the keys or the pointer chose it: its text, then `end` beside it on wider
 * screens, and on a head line over it on the phone, unless `isInline`, a tree's short row, which
 * keeps its counts beside it so the tree stays compact. `rowKey` names it to the list's keys;
 * `onPick` is called as the focus enters it.
 */
export function Row({
  children,
  end,
  isInline = false,
  isPicked = false,
  onPick,
  rowKey,
}: {
  children: ReactNode;
  end?: ReactNode;
  isInline?: boolean;
  isPicked?: boolean;
  onPick?: () => void;
  rowKey?: string;
}) {
  const narrow = isNarrow(useWidthClass()) && !isInline;
  return (
    // A row of the list's keys: Astryx has no list row whose focusable parts the keys move over.
    <div
      data-row=""
      data-row-key={rowKey}
      onFocus={onPick}
      {...stylex.props(styles.row, narrow && styles.rowNarrow, isPicked && pickedStyles.picked)}
    >
      <div {...stylex.props(styles.text)}>{children}</div>
      {end && (
        // On the phone's head line, actions wrap rather than cut their labels.
        <HStack align="center" gap={2} wrap={narrow ? "wrap" : "nowrap"} xstyle={styles.end}>
          {end}
        </HStack>
      )}
    </div>
  );
}
