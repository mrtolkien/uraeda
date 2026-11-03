import { Field, type FieldStatusInput } from "@astryxdesign/core/Field";
import { useId } from "react";
import { Editor, type EditorProps, type FieldKey } from "./editor/Editor.tsx";

/**
 * The app's one-line text field: the shared editor, `line` variant, under its label, shown or for
 * screen readers only, with its help and its status, as Astryx's field draws them. It wraps its
 * text and grows with it to 9 lines, then scrolls inside, and never breaks its line: Enter runs
 * `onEnter`. Escape leaves it, or inside a dialog closes the dialog, unless `onEscape` says.
 */
export function TextLine({
  description,
  hasAutoFocus,
  id,
  isLabelHidden = false,
  label,
  status,
  width,
  ...props
}: Omit<EditorProps, "isAutoFocused" | "rows" | "variant"> & {
  /** The help under the label. */
  description?: string;
  hasAutoFocus?: boolean;
  isLabelHidden?: boolean;
  /** A message under the field, as an error. */
  status?: FieldStatusInput;
  /** The field's width, its label's and status's with it; the whole line by default. */
  width?: string;
}) {
  const ownId = useId();
  const inputID = id ?? ownId;
  return (
    <Field
      description={description}
      inputID={inputID}
      isLabelHidden={isLabelHidden}
      label={label}
      status={status}
      width={width}
    >
      <Editor {...props} id={inputID} isAutoFocused={hasAutoFocus} label={label} variant="line" />
    </Field>
  );
}

/** Down and Up in a field over a list, as a search's: `move` steps along its rows, by 1 or -1. */
export function arrowKeys(move: (step: 1 | -1) => void): Array<FieldKey> {
  const run = (step: 1 | -1) => () => {
    move(step);
    return true;
  };
  return [
    { key: "ArrowDown", run: run(1) },
    { key: "ArrowUp", run: run(-1) },
  ];
}
