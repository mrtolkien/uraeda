import { Link } from "@astryxdesign/core/Link";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { VStack } from "@astryxdesign/core/VStack";
import { sizeVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { type ReactNode, useRef, useState } from "react";

const EMPTY = "A priority cannot be empty.";

const styles = stylex.create({
  // The text reads as text, from the start of its line, as tall as a control for a finger.
  text: {
    textAlign: "start",
    minHeight: sizeVars["--size-element-md"],
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
  value,
  label,
  onSave,
  display,
  stayOpen = false,
}: {
  value: string;
  label: string;
  onSave: (text: string) => Promise<string | undefined>;
  display?: ReactNode;
  stayOpen?: boolean;
}) {
  const [text, setText] = useState<string>();
  const [error, setError] = useState<string>();
  const [status, setStatus] = useState<"saving" | "saved">();
  // Escape and Enter end the edit before the field's blur, which then has nothing to do.
  const done = useRef(false);

  const save = async (blurred = false) => {
    if (text === undefined || done.current) {
      return;
    }
    if (!text.trim()) {
      if (stayOpen && blurred) {
        setError(undefined);
        setText(undefined);
      } else {
        setError(EMPTY);
      }
      return;
    }
    if (text === value) {
      setText(undefined);
      return;
    }
    done.current = true;
    setError(undefined);
    setStatus("saving");
    const failed = await onSave(text.trim());
    done.current = false;
    if (failed) {
      setStatus(undefined);
      setError(failed);
    } else {
      setStatus("saved");
      setText(stayOpen ? "" : undefined);
    }
  };

  if (text === undefined) {
    return (
      <VStack gap={1}>
        <Link
          type="inherit"
          color="primary"
          xstyle={styles.text}
          onClick={() => {
            setStatus(undefined);
            setText(value);
          }}
        >
          {display ?? value}
        </Link>
        {status === "saved" && (
          <Text type="supporting" color="secondary">
            Saved
          </Text>
        )}
      </VStack>
    );
  }
  return (
    <VStack gap={1}>
      <TextInput
        label={label}
        isLabelHidden
        value={text}
        hasAutoFocus
        isLoading={status === "saving"}
        status={error ? { type: "error", message: error } : undefined}
        onChange={(next: string) => {
          setText(next);
          setError(undefined);
          setStatus(undefined);
        }}
        onKeyDown={(event: React.KeyboardEvent<HTMLInputElement>) => {
          if (event.key === "Enter") {
            event.preventDefault();
            void save();
          } else if (event.key === "Escape") {
            event.preventDefault();
            done.current = false;
            setError(undefined);
            setText(undefined);
          }
        }}
        onBlur={() => void save(true)}
      />
      <Text type="supporting" color="secondary">
        {status === "saving"
          ? "Saving…"
          : status === "saved"
            ? "Saved"
            : "Enter saves · Escape cancels"}
      </Text>
    </VStack>
  );
}
