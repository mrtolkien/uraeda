// A field of a job typed in: its name, its prompt, its time. The text is kept on the device as it
// is typed (`unsavedText`), and an existing job's is saved as the field is left, or on Enter for a
// line, Ctrl+Enter for the prompt: never on a key that would start a run. A refusal keeps the text
// typed, for the human to fix, and says why under its row.
import { untracked } from "nsh";
import type { Field, Form, Values } from "./form";
import { TextField, type TextFieldRef, unsavedText } from "../../ui/text";

export type TypedProps = {
  at: Extract<Field, "name" | "prompt" | "time">;
  form: Form;
  /** Where the device keeps the text while it is not saved. */
  keptAs: string;
  label: string;
  /** A new job's: its text is the form's, until "Add the job". */
  isNew: boolean;
  lines?: "one" | "many";
  placeholder?: string;
  ref?: (field: TextFieldRef) => void;
  /** The form's value for this text, as the job holds it. */
  saved: () => string;
  /** Whether two texts are the same value: "3:00" is "03:00". */
  same?: (a: string, b: string) => boolean;
  testID?: string;
  width?: number;
  /** The job with the text in its field. */
  write: (all: Values, text: string) => Values;
};

export function Typed(props: TypedProps) {
  const field = unsavedText(props.keptAs, props.saved);
  const same = (a: string, b: string) => (props.same ?? ((x, y) => x === y))(a, b);
  const leave = async () => {
    const text = untracked(field.text);
    if (props.isNew) return;
    if (same(text, untracked(props.saved))) {
      field.discard();
      return;
    }
    const refused = await props.form.change(props.at, (all) => props.write(all, text));
    // Kept: the job shows it; text typed since stays.
    if (refused === null && untracked(field.text) === text) field.discard();
  };
  return (
    <TextField
      label={props.label}
      lines={props.lines ?? "one"}
      onBlur={() => void leave()}
      onChange={(next) => {
        field.change(next);
        if (props.isNew) props.form.change(props.at, (all) => props.write(all, next));
      }}
      onEnter={props.lines === "many" ? undefined : () => void leave()}
      onSave={() => void leave()}
      placeholder={props.placeholder}
      ref={props.ref}
      rows={props.lines === "many" ? { max: 18, min: 5 } : undefined}
      style={props.width === undefined ? { alignSelf: "stretch" } : { width: props.width }}
      testID={props.testID}
      value={field.text()}
    />
  );
}
