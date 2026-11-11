// A session's message field: the text field, growing with its text up to a limit, with its send
// key written under it, its attachments above it, and the hint a queue gives. Its whole purpose is
// a send, so it says which key sends: Enter in a session's composer, as a chat sends, with
// Shift+Enter for a line; Ctrl+Enter where a stray Enter would start work, as the New page's. Under
// a finger, whose keyboard has no Shift+Enter, Enter adds a line, and the Send button sends.
import { type JSX, View } from "nsh";
import { IconButton, Kbd, Text } from "../controls";
import { isNarrow } from "../width";
import { TextField, type TextFieldRef } from "./TextField";

export type ComposerProps = {
  /**
   * How many images or files are attached: with one or more, the composer sends without words, as
   * a message of images alone is one. None unless given, so blank text sends nothing.
   */
  attached?: number;
  /** What is attached, above the text: images and files, drawn by the screen. */
  attachments?: JSX.Element;
  autoFocus?: boolean;
  /** The send is off, with why: no agent, a turn that cannot take one. */
  disabled?: boolean;
  label: string;
  onChange: (value: string) => void;
  onSend: () => void;
  placeholder?: string;
  /** Said beside the keys while a turn runs: "Sent once this turn ends". */
  queued?: string;
  ref?: (field: TextFieldRef) => void;
  refusal?: string | null;
  /** The rows it grows to before its text scrolls: 12 unless given. */
  rows?: number;
  /** The key that sends: `enter` in a session, `mod+enter` where Enter must stay a line. */
  sendOn?: "enter" | "mod+enter";
  testID?: string;
  value: string;
};

/** The keys that send and add a line, as written under the field. */
function Keys(props: { sendOn: "enter" | "mod+enter"; touch: boolean }) {
  const enterSends = () => props.sendOn === "enter" && !props.touch;
  return (
    <View style={{ alignItems: "center", flexDirection: "row", gap: 6 }}>
      <Kbd keys={enterSends() ? "Enter" : "mod+Enter"} />
      <Text size="under" tone="faint">
        send
      </Text>
      <Kbd keys={enterSends() ? "shift+Enter" : "Enter"} />
      <Text size="under" tone="faint">
        new line
      </Text>
    </View>
  );
}

export function Composer(props: ComposerProps) {
  const sendOn = () => props.sendOn ?? "enter";
  const touch = isNarrow;
  /** Words, or something attached: blank text alone is nothing to send. */
  const sendable = () =>
    props.disabled !== true && (props.value.trim() !== "" || (props.attached ?? 0) > 0);
  const send = () => {
    if (sendable()) {
      props.onSend();
    }
  };
  return (
    <View style={{ alignSelf: "stretch", gap: 4 }} testID={props.testID}>
      {props.attachments}
      <View style={{ alignItems: "flex-end", flexDirection: "row", gap: 8 }}>
        <TextField
          autoFocus={props.autoFocus}
          label={props.label}
          onChange={props.onChange}
          onEnter={sendOn() === "enter" && !touch() ? send : undefined}
          onSave={send}
          placeholder={props.placeholder}
          ref={props.ref}
          refusal={props.refusal}
          rows={{ max: props.rows ?? 12, min: 2 }}
          style={{ flexBasis: 0, flexGrow: 1, minWidth: 0 }}
          value={props.value}
        />
        <IconButton disabled={!sendable()} icon="arrow-up" label="Send" onPress={send} />
      </View>
      <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        <If when={!touch()}>
          <Keys sendOn={sendOn()} touch={touch()} />
        </If>
        <If when={props.queued}>
          {(queued) => (
            <Text size="under" tone="quiet">
              {queued()}
            </Text>
          )}
        </If>
      </View>
    </View>
  );
}
