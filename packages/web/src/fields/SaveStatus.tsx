import { HStack } from "@astryxdesign/core/HStack";
import { Text } from "@astryxdesign/core/Text";
import * as stylex from "@stylexjs/stylex";
import type { SaveState } from "../useSave.ts";
import { StatusText } from "./StatusText.tsx";

const styles = stylex.create({
  // Every state in one cell, over the room "Unsaved changes" takes: the row around keeps its
  // place, and wraps the same, whichever shows.
  cell: { gridArea: "1 / 1", minWidth: 0 },
  // Drawn by the style alone, so the page's text holds the status shown only.
  reserved: { "::before": { content: '"Unsaved changes"' }, visibility: "hidden" },
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
        {state.kind === "error" && <StatusText tone="error">Not saved: {state.message}</StatusText>}
        {dirty && state.kind !== "saving" && (
          <Text color="secondary" type="supporting">
            Unsaved changes
          </Text>
        )}
        {!dirty && state.kind === "saved" && <StatusText tone="saved">saved ✓</StatusText>}
      </HStack>
    </span>
  );
}
