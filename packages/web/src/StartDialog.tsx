// The one question the New page asks once Ctrl+Enter starts a change or a feature: its slug, which
// names the change's folder and branch, or its title, which names the feature's proposal. Prefilled,
// so that Enter alone confirms; a dialog on wide screens, a bottom sheet on the phone, as the rename
// is. The page has no field for it: the composer is the page's one field.
import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import { TextInput } from "@astryxdesign/core/TextInput";
import { VStack } from "@astryxdesign/core/VStack";
import { useEffect, useRef, useState } from "react";
import { StatusText } from "./fields/StatusText.tsx";
import { Overlay } from "./layout/Overlay.tsx";

/** What the dialog asks, and how it reads: its field's name and its help. */
export type Question = { confirm: string; description: string; label: string; title: string };

function Ask({
  initial,
  onCancel,
  onConfirm,
  question,
}: {
  initial: string;
  onCancel: () => void;
  /** Starts with the value: the refusal to show under the field, or nothing once it started. */
  onConfirm: (value: string) => Promise<string | undefined>;
  question: Question;
}) {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string>();
  // The field takes the focus, its text selected, once the dialog has settled: the dialog's own
  // focus goes to its first control as it opens, and Enter must confirm from the first key.
  const field = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const timer = setTimeout(() => {
      field.current?.focus();
      field.current?.select();
    }, 80);
    return () => clearTimeout(timer);
  }, []);
  // One start at a time: Enter again, a held Enter, or the button while it runs starts nothing more.
  const starting = useRef(false);
  const confirm = async () => {
    if (starting.current) {
      return;
    }
    starting.current = true;
    setError(undefined);
    try {
      const refused = await onConfirm(value.trim());
      if (refused !== undefined) {
        setError(refused);
      }
    } finally {
      starting.current = false;
    }
  };
  return (
    <VStack gap={4}>
      <TextInput
        description={question.description}
        hasAutoFocus
        label={question.label}
        onChange={setValue}
        onEnter={() => {
          if (value.trim()) {
            void confirm();
          }
        }}
        ref={field}
        value={value}
      />
      {error && (
        <StatusText role="alert" tone="error" type="supporting">
          {error}
        </StatusText>
      )}
      <HStack align="center" gap={2} justify="end">
        <Button label="Cancel" onClick={onCancel} />
        <Button
          clickAction={confirm}
          isDisabled={!value.trim()}
          label={question.confirm}
          variant="primary"
        />
      </HStack>
    </VStack>
  );
}

/**
 * The question, over the page while `isOpen`, its field starting as `initial`. Closing it, by Cancel,
 * Escape, or Back, cancels the start: the composer keeps what it holds.
 */
export function StartDialog({
  initial,
  isOpen,
  onCancel,
  onConfirm,
  question,
}: {
  initial: string;
  isOpen: boolean;
  onCancel: () => void;
  onConfirm: (value: string) => Promise<string | undefined>;
  question: Question;
}) {
  return (
    <Overlay isOpen={isOpen} label={question.title} onClose={onCancel} sheetHeight="hug">
      {isOpen && (
        <Ask initial={initial} onCancel={onCancel} onConfirm={onConfirm} question={question} />
      )}
    </Overlay>
  );
}
