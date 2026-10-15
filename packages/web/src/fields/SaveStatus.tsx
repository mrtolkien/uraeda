import { HStack } from "@astryxdesign/core/HStack";
import { Text } from "@astryxdesign/core/Text";
import { colorVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import type { SaveState } from "../useSave.ts";

const styles = stylex.create({
  // Every state in one cell, over the room "Unsaved changes" takes: the row around keeps its
  // place, and wraps the same, whichever shows.
  cell: { gridArea: "1 / 1", minWidth: 0 },
  error: { color: colorVars["--color-error"] },
  // Drawn by the style alone, so the page's text holds the status shown only.
  reserved: { "::before": { content: '"Unsaved changes"' }, visibility: "hidden" },
  saved: { color: colorVars["--color-success"] },
  status: { display: "inline-grid", maxWidth: "100%" },
});

/**
 * What a field's Save button did, next to it: "Unsaved changes" while the text differs from the
 * saved one, "saving…", "saved ✓" once nothing differs, or the error, kept until the next save. It
 * always takes the room of "Unsaved changes", shown or not, so the first letter typed moves
 * nothing on the page (US6).
 */
export function SaveStatus({ dirty, state }: { dirty: boolean; state: SaveState }) {
  return (
    <span {...stylex.props(styles.status)}>
      <Text
        aria-hidden
        color="secondary"
        type="supporting"
        xstyle={[styles.cell, styles.reserved]}
      />
      <HStack align="center" gap={2} wrap="wrap" xstyle={styles.cell}>
        {state.kind === "saving" && (
          <Text color="secondary" type="supporting">
            saving…
          </Text>
        )}
        {state.kind === "error" && (
          <span {...stylex.props(styles.error)}>Not saved: {state.message}</span>
        )}
        {dirty && state.kind !== "saving" && (
          <Text color="secondary" type="supporting">
            Unsaved changes
          </Text>
        )}
        {!dirty && state.kind === "saved" && <span {...stylex.props(styles.saved)}>saved ✓</span>}
      </HStack>
    </span>
  );
}
