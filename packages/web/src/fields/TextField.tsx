import { Field } from "@astryxdesign/core/Field";
import * as stylex from "@stylexjs/stylex";
import { useId } from "react";
import { Editor, type EditorProps } from "./editor/Editor.tsx";

/** The rows of each kind of field: a little more than its usual text, the same everywhere. */
const ROWS = { comment: 7, editor: 20, line: 3, notes: 12 } as const;

/**
 * The app's several-lines text field: the shared editor, `kind` setting its height, scrolling past
 * it, under its label, shown or for screen readers only. Ctrl+Enter, or Cmd+Enter, calls
 * `onSubmit`, as its Save button does; `onEnter`, a one-line entry's, runs on Enter, Shift+Enter
 * adding a line. An image field's ref, paste, focus, and drop outline (`controlXstyle`) reach the
 * editor.
 */
export function TextField({
  controlXstyle,
  hasAutoFocus,
  id,
  isLabelHidden = false,
  kind,
  label,
  onChange,
  ...props
}: Omit<EditorProps, "isAutoFocused" | "onChange" | "rows" | "variant"> & {
  /** The editor's box's own style, like the outline of a drop's target. */
  controlXstyle?: stylex.StyleXStyles;
  hasAutoFocus?: boolean;
  isLabelHidden?: boolean;
  kind: keyof typeof ROWS;
  onChange?: (value: string) => void;
}) {
  const ownId = useId();
  const inputID = id ?? ownId;
  return (
    <Field inputID={inputID} isLabelHidden={isLabelHidden} label={label}>
      <div {...stylex.props(controlXstyle)}>
        <Editor
          {...props}
          id={inputID}
          isAutoFocused={hasAutoFocus}
          label={label}
          onChange={onChange ?? (() => {})}
          rows={ROWS[kind]}
          variant="lines"
        />
      </div>
    </Field>
  );
}
