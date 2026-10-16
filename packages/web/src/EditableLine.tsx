import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import { Link } from "@astryxdesign/core/Link";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { VStack } from "@astryxdesign/core/VStack";
import {
  borderVars,
  colorVars,
  radiusVars,
  sizeVars,
  spacingVars,
} from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import type { KeyboardEvent, ReactNode } from "react";
import { RestoreNotice } from "./fields/RestoreNotice.tsx";
import { SaveStatus } from "./fields/SaveStatus.tsx";
import { useWidthClass } from "./layout/useWidthClass.ts";
import { useLineSave } from "./useLineSave.ts";

/** What the restore notice adds when the line changed since its unsaved text was typed. */
const LINE_CHANGED = "The line changed since: saving replaces it.";

const styles = stylex.create({
  text: {
    // The text reads as text, from the start of its line, as tall as a control for a finger.
    minHeight: sizeVars["--size-element-md"],
    textAlign: "start",
  },
  // A value to change, like a setting's: a box drawn as a field, at the control's height, the
  // value inside, so it reads as something to edit.
  field: {
    alignItems: "center",
    backgroundColor: colorVars["--color-background-surface"],
    borderColor: colorVars["--color-border"],
    borderRadius: radiusVars["--radius-element"],
    borderStyle: "solid",
    borderWidth: borderVars["--border-width"],
    boxSizing: "border-box",
    display: "flex",
    minHeight: sizeVars["--size-element-md"],
    paddingInline: spacingVars["--spacing-3"],
    textAlign: "start",
  },
});

/**
 * A line edited in place: its text, a button; tapped, a field with Save and Cancel. Enter or Save
 * saves, Escape or Cancel cancels, asking first when the text changed; leaving the field leaves it
 * open with its text. Its unsaved text is kept under `field`, its key in the unsaved store, and
 * restored with a notice. An empty text is refused; `onSave` resolves with the error to show under
 * the field, which keeps the typed text, or with nothing once saved. `display` is what the button
 * shows, the value by default. With `stayOpen`, as an Add row, a saved field empties and stays open
 * for the next line. `look` draws the closed line as text, by default, or as a bordered field, for
 * a value to change like a setting's. `empty` is the refusal of an empty text, a priority's by
 * default.
 */
export function EditableLine({
  display,
  empty,
  field: key,
  label,
  look = "text",
  onSave,
  stayOpen = false,
  value,
}: {
  display?: ReactNode;
  empty?: string;
  field: string;
  label: string;
  look?: "text" | "field";
  onSave: (text: string) => Promise<string | undefined>;
  stayOpen?: boolean;
  value: string;
}) {
  const line = useLineSave({ empty, field: key, onSave, stayOpen, value });

  if (!line.open) {
    return (
      <VStack gap={1}>
        <Link
          color="primary"
          onClick={line.openLine}
          type="inherit"
          xstyle={look === "field" ? styles.field : styles.text}
        >
          {display ?? value}
        </Link>
        {line.state.kind === "saved" && <SaveStatus dirty={false} state={line.state} />}
      </VStack>
    );
  }
  return <LineField label={label} line={line} />;
}

/**
 * A line's field, open: its text with Save and Cancel, Enter saving and Escape cancelling, the
 * restore notice of its unsaved text, and its save's status.
 */
export function LineField({
  label,
  line,
}: {
  label: string;
  line: ReturnType<typeof useLineSave>;
}) {
  const wide = useWidthClass() === "wide";
  const { field } = line;
  return (
    <VStack gap={1}>
      {field.restored && (
        <RestoreNotice changed={LINE_CHANGED} onDiscard={line.drop} restored={field.restored} />
      )}
      <TextInput
        hasAutoFocus
        isLabelHidden
        isLoading={line.state.kind === "saving"}
        label={label}
        onChange={line.change}
        onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
          if (event.key === "Enter" && !event.nativeEvent.isComposing) {
            event.preventDefault();
            void line.save();
          } else if (event.key === "Escape") {
            event.preventDefault();
            void line.cancel();
          }
        }}
        status={line.error ? { message: line.error, type: "error" } : undefined}
        value={field.text}
      />
      <HStack align="center" gap={2} wrap="wrap">
        <Button label="Cancel" onClick={() => void line.cancel()} size="sm" variant="secondary" />
        <Button
          isDisabled={!field.dirty}
          label="Save"
          onClick={() => void line.save()}
          size="sm"
          variant="primary"
        />
        <SaveStatus dirty={field.dirty} state={line.state} />
        {wide && (
          <Text color="secondary" type="supporting">
            Enter saves · Escape cancels
          </Text>
        )}
      </HStack>
    </VStack>
  );
}
