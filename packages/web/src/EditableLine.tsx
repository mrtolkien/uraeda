import { Link } from "@astryxdesign/core/Link";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { VStack } from "@astryxdesign/core/VStack";
import { sizeVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";
import { useLineSave } from "./useLineSave.ts";

const styles = stylex.create({
  text: {
    // The text reads as text, from the start of its line, as tall as a control for a finger.
    minHeight: sizeVars["--size-element-md"],
    textAlign: "start",
  },
});

/**
 * A line edited in place: its text, a button; tapped, a field. Enter or leaving the field saves,
 * Escape cancels. An empty text is refused; `onSave` resolves with the error to show under the
 * field, which keeps the typed text, or with nothing once saved. `display` is what the button
 * shows, the value by default. With `stayOpen`, as an Add row, a saved field empties and stays open
 * for the next line, and leaving it empty closes it.
 */
export function EditableLine({
  display,
  label,
  onSave,
  stayOpen = false,
  value,
}: {
  display?: ReactNode;
  label: string;
  onSave: (text: string) => Promise<string | undefined>;
  stayOpen?: boolean;
  value: string;
}) {
  const { cancel, change, error, open, save, status, text } = useLineSave({
    onSave,
    stayOpen,
    value,
  });

  if (text === undefined) {
    return (
      <VStack gap={1}>
        <Link color="primary" onClick={open} type="inherit" xstyle={styles.text}>
          {display ?? value}
        </Link>
        {status === "saved" && (
          <Text color="secondary" type="supporting">
            Saved
          </Text>
        )}
      </VStack>
    );
  }
  return (
    <VStack gap={1}>
      <TextInput
        hasAutoFocus
        isLabelHidden
        isLoading={status === "saving"}
        label={label}
        onBlur={() => void save(true)}
        onChange={change}
        onKeyDown={(event: React.KeyboardEvent<HTMLInputElement>) => {
          if (event.key === "Enter") {
            event.preventDefault();
            void save();
          } else if (event.key === "Escape") {
            event.preventDefault();
            cancel();
          }
        }}
        status={error ? { message: error, type: "error" } : undefined}
        value={text}
      />
      <Text color="secondary" type="supporting">
        {status === "saving"
          ? "Saving…"
          : status === "saved"
            ? "Saved"
            : "Enter saves · Escape cancels"}
      </Text>
    </VStack>
  );
}
