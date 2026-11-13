// The confirmation of an act that cannot be taken back: one that spends an agent's time, leaves
// this machine, or loses something for good. Its key, or its button, opens this instead of doing
// it, and it says what will be done, in words, with the numbers and the names: "Push 3 commits to
// origin/main?", never "Are you sure?". Escape, or a press outside, leaves everything as it was.
//
// Two kinds. An act that spends or sends but loses nothing: Enter confirms, and so does the key
// that asked, one press more. An act that `loses` something for good: Cancel has the focus, so
// Enter changes nothing, as it presses Cancel; `y`, or the key that asked, confirms. Its words,
// what is lost, sit on the error colour's quiet wash, and its button is a red tube, never the
// lamp.
import { type Accessor, computed, effect, type JSX, untracked, View } from "nsh";
import { AlertDialog } from "nsh/base";
import { Dialog } from "../surfaces";
import { Button } from "./Button";
import type { IconName } from "./Icon";
import { Text } from "./Text";
import { keyScope, registerKey } from "../keys/registry";
import { apple, feltOutcome, mac } from "../native";
import type { Scope } from "../keys/store";
import { tokens } from "../tokens";

export type ConfirmProps = {
  /** More than its words: a list of what it takes, a refusal. */
  children?: JSX.Element;
  /**
   * It loses something for good, with no undo: Enter changes nothing, `y` or its key confirms,
   * its words say what is lost on the error colour's wash, and its button is a danger's.
   */
  loses?: boolean;
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

/** A key in the confirmation's own layer, whatever has the focus there. */
function Key(props: { keys: string; label: string; run: () => void; scope: Scope }) {
  registerKey({ keys: props.keys, label: props.label, run: props.run }, props.scope);
  return null;
}

/** What is lost, on the error colour's quiet wash, with a bar of it on its left edge. */
function Lost(props: { words: string }) {
  const colour = tokens.control.tone("danger");
  return (
    <View
      style={{
        backgroundColor: tokens.control.wash(colour),
        borderColor: colour,
        borderLeftWidth: 2,
        paddingHorizontal: 12,
        paddingVertical: 8,
      }}
    >
      <Text>{props.words}</Text>
    </View>
  );
}

/**
 * The confirmation on iOS and on a Mac: the system's own alert, as every app's there. On iOS an
 * act that loses something is a sheet of actions from the bottom, its button in the system's red,
 * felt as a warning; any other is an alert. On a Mac every one is an alert on the window, its
 * button red where something is lost, which Return never presses. A press outside a sheet, its
 * Cancel, or Escape leaves everything as it was.
 */
function SystemConfirm(props: ConfirmProps) {
  let asking = false;
  effect(() => {
    if (!props.open || asking) return;
    asking = true;
    untracked(() => {
      const loses = props.loses === true;
      if (loses) feltOutcome("warning");
      void AlertDialog.show({
        actions: [
          { id: "keep", label: props.keep ?? "Cancel", role: "cancel" },
          { id: "confirm", label: props.label, role: loses ? "destructive" : "default" },
        ],
        description: props.words,
        presentation: loses && !mac ? "actionSheet" : "alert",
        title: props.title,
      })
        .then(({ action }) => {
          if (action === "confirm" && props.open) props.onConfirm();
        })
        .finally(() => {
          asking = false;
          props.onClose();
        });
    });
  });
  return null;
}

export function Confirm(props: ConfirmProps) {
  // The system's alert holds words alone: a confirmation with a list of its own stays the app's.
  if (apple && props.children === undefined) return <SystemConfirm {...props} />;
  const confirm = () => {
    // Once: the key and Enter may both come.
    if (!props.open) return;
    props.onConfirm();
    props.onClose();
  };
  const loses = () => props.loses === true;
  // The dialog's layer, made here and given to its keys and its button: in a browser, content
  // written here runs in the caller's scope, where the key that asked is declared already (the
  // jobs' `r`), and the registry refused the second (`Float`'s `scope`, ruling R478).
  const layer = keyScope({ kind: "layer", name: props.title, on: () => props.open });
  return (
    <Dialog
      icon={props.icon ?? (loses() ? "triangle-alert" : undefined)}
      onClose={props.onClose}
      open={props.open}
      scope={layer}
      testID={props.testID}
      title={props.title}
      width={480}
    >
      <If when={props.open}>
        <View style={{ gap: 14 }}>
          <If
            when={loses()}
            else={
              <>
                <Key keys="Enter" label={props.label} run={confirm} scope={layer} />
                <Text>{props.words}</Text>
              </>
            }
          >
            {/* Without a key of its own, its button takes `y`. */}
            <If when={props.keys !== undefined}>
              <Key keys="y" label={props.label} run={confirm} scope={layer} />
            </If>
            <Lost words={props.words} />
          </If>
          {props.children}
          <View
            style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "flex-end" }}
          >
            <Button first={loses()} label={props.keep ?? "Cancel"} onPress={props.onClose} />
            <Button
              first={!loses()}
              icon={props.icon}
              keys={props.keys ?? (loses() ? "y" : undefined)}
              label={props.label}
              onPress={confirm}
              scope={layer}
              testID="confirm"
              variant={loses() ? "danger" : "main"}
            />
          </View>
        </View>
      </If>
    </Dialog>
  );
}
