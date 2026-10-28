// What an outline's field does with its text, apart from the keys that call it (see
// `OutlineEditor`): it grows with the text, opens focused with its caret at the end, and closes
// once, saving, cancelling, or indenting.
import { useLayoutEffect, useRef, useState } from "react";
import { DISCARD_CHANGES, useConfirm } from "../fields/Confirm.tsx";
import type { OutlineEditorProps } from "./OutlineEditor.tsx";

/**
 * The field's text and what closes it: `finish` as it is left, `save` on Enter, `cancel` on
 * Escape, `indent` on Tab, and `close` for any other way out, each once.
 */
export function useOutlineField({
  isNew = false,
  onCancel,
  onIndent,
  onSave,
  value,
}: Omit<OutlineEditorProps, "label">) {
  const [text, setText] = useState(value);
  const field = useRef<HTMLTextAreaElement>(null);
  // Closed once: a key that closed it is not followed by the blur it causes.
  const closed = useRef(false);
  // While Escape asks whether to discard the change: the blur the question causes saves nothing.
  const asking = useRef(false);
  const confirm = useConfirm();
  useLayoutEffect(() => {
    const element = field.current;
    if (element) {
      element.style.height = "auto";
      element.style.height = `${element.scrollHeight}px`;
    }
  }, [text]);
  useLayoutEffect(() => {
    const element = field.current;
    element?.focus({ preventScroll: true });
    element?.setSelectionRange(element.value.length, element.value.length);
  }, []);

  const close = (then: () => void) => {
    if (!closed.current) {
      closed.current = true;
      then();
    }
  };
  /** Whether the text is one to save: some text, new, or changed. */
  const isToSave = (trimmed: string) => trimmed !== "" && (isNew || trimmed !== value.trim());
  /** Saves the text when there is one to save; else closes with nothing saved. */
  const finish = () => {
    if (asking.current) {
      return;
    }
    const trimmed = text.trim();
    close(() => (isToSave(trimmed) ? onSave(trimmed, "left") : onCancel()));
  };

  /** Enter: saves the text when there is one to save, else closes. */
  const save = () => {
    const trimmed = text.trim();
    close(() => (isToSave(trimmed) ? onSave(trimmed, "enter") : onCancel()));
  };
  /**
   * Escape: closes with nothing saved, after the shared confirmation when the text changed, as
   * every field that holds typed text asks; Keep editing gives the field its focus back.
   */
  const cancel = async () => {
    if (!isToSave(text.trim())) {
      close(onCancel);
      return;
    }
    asking.current = true;
    const discards = await confirm(DISCARD_CHANGES);
    asking.current = false;
    if (discards) {
      close(onCancel);
    } else {
      field.current?.focus({ preventScroll: true });
    }
  };
  /** Tab, or Shift+Tab with `isOut`. */
  const indent = (isOut: boolean) => {
    close(() => onIndent(isOut, text.trim()));
    // An indent with nowhere to go leaves the field open: it goes on taking keys. One that moved
    // the field closed this one, and its blur came before.
    queueMicrotask(() => {
      closed.current = false;
    });
  };
  return { cancel, close, field, finish, indent, save, setText, text };
}
