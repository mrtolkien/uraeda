import { HStack } from "@astryxdesign/core/HStack";
import { Text } from "@astryxdesign/core/Text";
import { colorVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import type { SaveState } from "../useSave.ts";

const styles = stylex.create({
  error: { color: colorVars["--color-error"] },
  saved: { color: colorVars["--color-success"] },
});

/**
 * What a field's Save button did, next to it: "Unsaved changes" while the text differs from the
 * saved one, "saving…", "saved ✓" once nothing differs, or the error, kept until the next save.
 */
export function SaveStatus({ dirty, state }: { dirty: boolean; state: SaveState }) {
  return (
    <HStack align="center" gap={2} wrap="wrap">
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
  );
}
