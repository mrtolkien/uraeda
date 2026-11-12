// A comment of a review, written where it points: under its block in the reader, or the general
// one in the Review pane. Its text is the device's as it is typed, so nothing typed is lost, and
// leaving the page with some asks first; it goes into the review file with its button,
// Ctrl+Enter, or as the field leaves. A comment is a write of the review alone: nothing commits
// before the verdict.
import { signal, View } from "nsh";
import type { CommentItem, FileView } from "../../store/protocol";
import { Button, Text } from "../../ui/controls";
import { TextField, unsavedKey, unsavedText } from "../../ui/text";
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
  const pending = signal(false);
  const save = async () => {
    const words = text.text().trim();
    if (pending() || !text.dirty()) return;
    pending.set(true);
    refusal.set(null);
    try {
      if (props.editing !== undefined) {
        await (words === ""
          ? removeComment(props.args, props.editing)
          : editComment(props.args, props.editing, words));
      } else if (words !== "") {
        const written = props.about === undefined ? words : `${props.about}: ${words}`;
        await addComment(props.args, props.lines, props.heading ?? null, written);
      }
      text.discard();
      props.onClose?.();
    } catch (error) {
      refusal.set(`Not saved: ${(error as Error).message} Your text stays on this device.`);
    }
    pending.set(false);
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
          pending={pending()}
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
