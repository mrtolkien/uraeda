import { Text } from "@astryxdesign/core/Text";
import { useWidthClass } from "../layout/useWidthClass.ts";

/**
 * Beside a multi-line field's Save, on a wide screen, its key: "Ctrl+Enter saves", as the mockups
 * draw it. Ctrl+Enter or Cmd+Enter both save; the phone has no such key, and shows nothing.
 */
export function SaveKeys() {
  return useWidthClass() === "wide" ? (
    <Text color="secondary" type="supporting">
      Ctrl+Enter saves
    </Text>
  ) : null;
}
