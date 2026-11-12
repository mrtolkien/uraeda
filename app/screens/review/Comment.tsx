// A comment of a review, written where it points: under its block in the reader, or the general
// one in the Review pane. Its text is the device's as it is typed, so nothing typed is lost, and
// leaving the page with some asks first; it goes into the review file with its button,
// Ctrl+Enter, or as the field leaves, as it was when asked: what is typed while it is saved stays
// in the field, which closes only once it holds nothing unsaved. A comment is a write of the
// review alone: nothing commits before the verdict.
import { signal, View } from "nsh";
import type { CommentItem, FileView } from "../../store/protocol";
import { Button, Text } from "../../ui/controls";
import { TextField, type TextFieldRef, unsavedKey, unsavedText } from "../../ui/text";
import type { FileArgs } from "../file/read";
import { addComment, editComment, removeComment } from "./writes";

/** Where a new comment points: lines of the file as reviewed, or the whole file. */
export type Lines = { endLine: number; startLine: number } | null;

export type CommentFieldProps = {
  args: FileArgs;
  file: FileView;
  /** A pending comment edited, or a new one on `lines`. */
  editing?: CommentItem;
  lines: Lines;
  /** What a new comment is about, its text's start: `Mockup ui.html, button “Save”`. */
  about?: string;
  /** The heading of the part a new comment is on, as its undo names it: none for the general one. */
  heading?: string | null;
  label: string;
  /** Asks the agent about the lines instead, with what is typed: the field then closes. */
  onAsk?: (text: string) => void;
  /** Closes the field: its text, if not saved, stays on the device. */
  onClose?: () => void;
  autoFocus?: boolean;
  /** Its field, for a key that writes in it. */
  ref?: (field: TextFieldRef) => void;
  testID?: string;
};

/** The field's key on the device: one per place a comment is written. */
function keyOf(props: CommentFieldProps) {
  const where =
    props.editing !== undefined
      ? `edit:${props.editing.number}`
      : props.lines === null
        ? "general"
        : `lines:${props.lines.startLine}-${props.lines.endLine}${props.about === undefined ? "" : `:${props.about}`}`;
  return unsavedKey(props.args.repo, `${props.file.path}#review:${where}`);
}

export function CommentField(props: CommentFieldProps) {
  const text = unsavedText(keyOf(props), () => props.editing?.text ?? "");
  const refusal = signal<string | null>(null);
  const save = async () => {
    if (text.pending() || !text.dirty()) return;
    refusal.set(null);
    const { about, args, editing, lines } = props;
    const heading = props.heading ?? null;
    // A change keeps its field over the comment; a new comment leaves it, as a message does.
    const done =
      editing !== undefined
        ? await text.save(async (typed) => {
            const words = typed.trim();
            await (words === "" ? removeComment(args, editing) : editComment(args, editing, words));
          })
        : await text.send((typed) => {
            const words = typed.trim();
            return addComment(
              args,
              lines,
              heading,
              about === undefined ? words : `${about}: ${words}`,
            );
          });
    if (!done.ok) {
      if (done.why !== null) {
        refusal.set(`Not saved: ${done.why} Your text stays on this device.`);
      }
      return;
    }
    // What was typed while it was saved keeps the field open.
    if (!text.dirty()) props.onClose?.();
  };
  return (
    <View style={{ gap: 6, paddingTop: 6 }}>
      <TextField
        autoFocus={props.autoFocus}
        hint={text.dirty() ? "Kept on this device until it is saved" : undefined}
        label={props.about === undefined ? props.label : `${props.label}, on ${props.about}`}
        onBlur={() => void save()}
        onQuit={props.onClose}
        onSave={() => void save()}
        onChange={text.change}
        placeholder="What should change, or be kept in mind"
        ref={props.ref}
        refusal={refusal()}
        rows={{ max: 10, min: 2 }}
        testID={props.testID}
        value={text.text()}
      />
      <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <Button
          icon="check"
          label={props.editing !== undefined ? "Save the change" : "Save the comment"}
          onPress={() => void save()}
          pending={text.pending()}
        />
        <If when={props.onAsk}>
          {(ask) => (
            <Button
              icon="message-circle-question"
              label="Ask the agent instead"
              onPress={() => {
                ask()(text.text());
                text.discard();
                props.onClose?.();
              }}
              testID="review-ask"
            />
          )}
        </If>
        <If when={props.onClose}>
          {(close) => <Button label="Close" onPress={() => close()()} />}
        </If>
        <Text style={{ flexShrink: 1 }} tone="faint">
          Saved in the review, sent with your verdict.
        </Text>
      </View>
    </View>
  );
}
