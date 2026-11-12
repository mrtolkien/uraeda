// The confirmation of an act that cannot be taken back: one that spends an agent's time, leaves
// this machine, or loses something for good. Its key, or its button, opens this instead of doing
// it, and it says what will be done, in words, with the numbers and the names: "Push 3 commits to
// origin/main?", never "Are you sure?". Enter confirms, and so does the key that asked: one press
// more, and a slip of one key does nothing. Escape, or a press outside, leaves everything as it
// was.
import { type Accessor, computed, type JSX, View } from "nsh";
import { Dialog } from "../surfaces";
import { Button } from "./Button";
import type { IconName } from "./Icon";
import { Text } from "./Text";
import { registerKey } from "../keys/registry";

export type ConfirmProps = {
  /** More than its words: a list of what it takes, a refusal. */
  children?: JSX.Element;
  /** It loses something for good: its button is a danger's. */
  danger?: boolean;
  icon?: IconName;
  /** The way out, in words: "Cancel" unless given, "Keep it" where something would be lost. */
  keep?: string;
  /** The key that asked, which confirms too. */
  keys?: string;
  /** The act on its button, in a few words: "Push 3 commits". */
  label: string;
  onClose: () => void;
  /** Does it: the confirmation closes after. */
  onConfirm: () => void;
  open: boolean;
  testID?: string;
  /** What will be done, whole, as a question: "Push 3 commits to origin/main?". */
  title: string;
  /** What it costs, or what follows, in a sentence or two. */
  words: string;
};

/**
 * What a confirmation was last asked about, kept once `now` is `null` again: its words stay whole
 * while it closes.
 */
export function lastAsked<T>(now: Accessor<T | null>): Accessor<T | null> {
  return computed<T | null>((before) => now() ?? before ?? null);
}

/** Enter, in the confirmation's own layer, whatever has the focus there. */
function Enter(props: { label: string; run: () => void }) {
  registerKey({ keys: "Enter", label: props.label, run: props.run });
  return null;
}

export function Confirm(props: ConfirmProps) {
  const confirm = () => {
    // Once: the key and Enter may both come.
    if (!props.open) return;
    props.onConfirm();
    props.onClose();
  };
  return (
    <Dialog
      icon={props.icon ?? (props.danger === true ? "triangle-alert" : undefined)}
      onClose={props.onClose}
      open={props.open}
      testID={props.testID}
      title={props.title}
      width={480}
    >
      <If when={props.open}>
        <View style={{ gap: 14 }}>
          <Enter label={props.label} run={confirm} />
          <Text>{props.words}</Text>
          {props.children}
          <View
            style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "flex-end" }}
          >
            <Button label={props.keep ?? "Cancel"} onPress={props.onClose} />
            <Button
              first
              icon={props.icon}
              keys={props.keys}
              label={props.label}
              onPress={confirm}
              testID="confirm"
              variant={props.danger === true ? "danger" : "main"}
            />
          </View>
        </View>
      </If>
    </Dialog>
  );
}
