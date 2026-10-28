// A row of an outline edited in place, as an outliner edits it: its text in a field that wraps, in
// the row's own place, its keys in a bar under it. Enter saves, never a new line; Escape cancels,
// asking first when the text changed; Tab and Shift+Tab indent and outdent, the text saved first;
// Backspace in an empty new row drops it. Leaving the field saves what changed.
import { borderVars, colorVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import type { KeyboardEvent } from "react";
import { RowBar } from "./RowBar.tsx";
import { useOutlineField } from "./useOutlineField.ts";

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
    outlineWidth: borderVars["--border-width"],
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
  const { cancel, close, field, finish, indent, save, setText, text } = useOutlineField({
    isNew,
    onCancel,
    onIndent,
    onSave,
    value,
  });

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
      {/* oxlint-disable-next-line react/forbid-elements -- the row's text edited in its own place, in the row's font, with no frame or padding of a field, growing with the text: Astryx's TextArea draws a field of its own, with its label, border, and height (an Astryx gap) */}
      <textarea
        aria-label={label}
        onBlur={finish}
        onChange={(event) => setText(event.target.value.replaceAll("\n", " "))}
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
