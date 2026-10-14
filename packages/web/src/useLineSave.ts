import { useRef, useState } from "react";

const EMPTY = "A priority cannot be empty.";

/**
 * A line edited in place, its text and its save: `text` is undefined while the line is closed.
 * Enter or leaving the field saves, Escape cancels. An empty text is refused; `onSave` resolves
 * with the error to show, the typed text kept, or with nothing once saved. With `stayOpen`, as an
 * Add row, a saved field empties and stays open, and leaving it empty closes it.
 */
export function useLineSave({
  onSave,
  stayOpen,
  value,
}: {
  onSave: (text: string) => Promise<string | undefined>;
  stayOpen: boolean;
  value: string;
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

  const open = () => {
    setStatus(undefined);
    setText(value);
  };

  const change = (next: string) => {
    setText(next);
    setError(undefined);
    setStatus(undefined);
  };

  const cancel = () => {
    done.current = false;
    setError(undefined);
    setText(undefined);
  };

  return { cancel, change, error, open, save, status, text };
}
