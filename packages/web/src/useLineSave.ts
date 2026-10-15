import { useRef, useState } from "react";
import { DISCARD_CHANGES, useConfirm } from "./fields/Confirm.tsx";
import { useTextField } from "./fields/useTextField.ts";
import type { SaveState } from "./useSave.ts";

const EMPTY = "A priority cannot be empty.";

/**
 * A line edited in place, its text and its save. Its text is a field of the unsaved store, `field`
 * its key, over `value`, the line as the file holds it: a line holding unsaved text opens as it is
 * drawn, restored. `save`, from Enter or Save, refuses an empty text, closes an unchanged one, and
 * otherwise calls `onSave`, which resolves with the error to show, the typed text kept, or with
 * nothing once saved. `cancel`, from Escape or Cancel, asks "Discard your changes?" first when the
 * text changed. Leaving the field does nothing. With `stayOpen`, as an Add row, a saved field
 * empties and stays open for the next line. `empty` is the refusal of an empty text, a priority's
 * by default.
 */
export function useLineSave({
  empty = EMPTY,
  field: key,
  onSave,
  stayOpen,
  value,
}: {
  empty?: string;
  field: string;
  onSave: (text: string) => Promise<string | undefined>;
  stayOpen: boolean;
  value: string;
}) {
  const field = useTextField(key, value);
  const confirm = useConfirm();
  const [open, setOpen] = useState(() => field.entry !== undefined);
  const [error, setError] = useState<string>();
  const [status, setStatus] = useState<"saving" | "saved">();
  // A save under way: a second Enter or Save waits for it. Set and read in handlers only.
  const saving = useRef(false);

  /** Forgets the text typed, and closes the line. */
  const drop = () => {
    field.discard();
    setError(undefined);
    setOpen(false);
  };

  const save = async () => {
    const text = field.text;
    if (saving.current) {
      return;
    }
    if (!text.trim()) {
      setError(empty);
      return;
    }
    if (!field.dirty) {
      drop();
      return;
    }
    saving.current = true;
    setError(undefined);
    setStatus("saving");
    const failed = await onSave(text.trim());
    saving.current = false;
    if (failed) {
      setStatus(undefined);
      setError(failed);
    } else if (stayOpen) {
      setStatus("saved");
      // Emptied for the next line, unless more was typed during the save.
      if (field.unsavedNow()?.text === text) {
        field.discard();
      }
    } else {
      setStatus("saved");
      field.saved(text);
      setOpen(false);
    }
  };

  const cancel = async () => {
    if (field.dirty && !(await confirm(DISCARD_CHANGES))) {
      return;
    }
    drop();
  };

  const change = (next: string) => {
    field.change(next);
    setError(undefined);
    setStatus(undefined);
  };

  const state: SaveState =
    status === undefined
      ? { kind: "idle" }
      : status === "saving"
        ? { kind: "saving" }
        : { kind: "saved" };

  return {
    cancel,
    change,
    drop,
    error,
    field,
    open,
    openLine: () => {
      setStatus(undefined);
      setOpen(true);
    },
    save,
    state,
  };
}
