// A row of an outline edited in place, as an outliner edits it: its text in a field that wraps, in
// the row's own place, its keys in a bar under it. Enter saves, never a new line; Escape cancels,
// asking first when the text changed; Tab and Shift+Tab indent and outdent, the text saved first;
// Backspace in an empty new row drops it. Leaving the field saves what changed.
import { colorVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { type KeyboardEvent, useLayoutEffect, useRef, useState } from "react";
import { DISCARD_CHANGES, useConfirm } from "../fields/Confirm.tsx";
import { RowBar } from "./RowBar.tsx";

const styles = stylex.create({
  // The row's text, as it reads, on a surface of its own with the accent's ring: the field grows
  // with the text and wraps it, as the row does.
  field: {
    backgroundColor: colorVars["--color-background-card"],
    borderStyle: "none",
    boxSizing: "border-box",
    color: "inherit",
    display: "block",
    font: "inherit",
    lineHeight: "inherit",
    outlineColor: colorVars["--color-accent"],
    outlineStyle: "solid",
    outlineWidth: "1px",
    overflow: "hidden",
    padding: 0,
    paddingInline: spacingVars["--spacing-1"],
    resize: "none",
    width: "100%",
  },
});

/** What the editor does as it closes, or before it closes. */
export type OutlineEditorProps = {
  /** A new row: its text, even the one it opened with, is saved; a row's unchanged text is not. */
  isNew?: boolean;
  label: string;
  /** Closed with nothing saved: Escape, its discard confirmed when the text changed, or an empty new row left. */
  onCancel: () => void;
  /** Tab, or Shift+Tab with `isOut`: the text, saved first when it changed, then the indent. */
  onIndent: (isOut: boolean, text: string) => void;
  /** Enter, or the field left with a change, `how` says which: the text, trimmed, never empty. */
  onSave: (text: string, how: "enter" | "left") => void;
  /** The text it opens with: empty for a new row. */
  value: string;
};

/** The row's field, focused as it opens, its caret at the end. */
export function OutlineEditor({
  isNew = false,
  label,
  onCancel,
  onIndent,
  onSave,
  value,
}: OutlineEditorProps) {
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

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.nativeEvent.isComposing) {
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      save();
    } else if (event.key === "Escape") {
      event.preventDefault();
      void cancel();
    } else if (event.key === "Tab") {
      event.preventDefault();
      indent(event.shiftKey);
    } else if (event.key === "Backspace" && text === "" && value === "") {
      event.preventDefault();
      close(onCancel);
    }
  };

  return (
    <>
      <textarea
        aria-label={label}
        onBlur={finish}
        onChange={(event) => setText(event.target.value.replace(/\n/g, " "))}
        onKeyDown={onKeyDown}
        ref={field}
        rows={1}
        value={text}
        {...stylex.props(styles.field)}
      />
      {/* The keys of the field, for the mouse and the finger: a press leaves the focus in it. */}
      <RowBar
        actions={[
          { icon: "check", keys: "⏎", label: "save", run: save },
          { icon: "close", keys: "esc", label: "cancel", run: () => void cancel() },
          { icon: "uraeda:indent", keys: "⇥", label: "indent", run: () => indent(false) },
          { icon: "uraeda:outdent", keys: "⇧⇥", label: "outdent", run: () => indent(true) },
        ]}
        isField
      />
    </>
  );
}
