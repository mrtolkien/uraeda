// The undo stack's part of the frame (`undoStack.ts`): its keys, declared at the shell's scope, so they
// work on every page outside a text field, whose own `Ctrl+Z` stays the field's; its toast, which
// says what was done with Undo, or what came back with Redo; and its one question, for an action
// committed since, which an undo writes over as a new change.
//
// After an undo or a redo the human is taken where the action happened. A refusal stays in its
// toast until closed: it concerns no control on the screen, and says what stays.
import { cleanup, effect, untracked, View } from "nsh";
import { asking, canRedo, canUndo, quiet, redo, said, type Said, undo } from "./undoStack";
import { navigate, pathOf, route } from "../../store";
import { Button, Confirm, IconButton, Kbd, lastAsked, Text } from "../../ui/controls";
import { registerKey, singleKeys } from "../../ui/keys";
import { Toast } from "../../ui/surfaces";
import { isNarrow } from "../../ui/width";

/** How long a toast of the stack stays, left alone, in ms: a refusal stays until closed. */
const SHOWN_MS = 5000;

/** Declares the stack's keys while the frame is drawn: a key with nothing to do goes on. */
/** What the keys run: `false` lets a key with nothing to do go on. */
const back = () => (undo() ? undefined : false);
const forth = () => (redo() ? undefined : false);

export function UndoKeys() {
  registerKey([
    {
      hint: "u",
      hintLabel: "undo",
      icon: "undo-2",
      keys: "u",
      label: "Undo",
      run: back,
      when: canUndo,
    },
    { icon: "undo-2", keys: "mod+z", label: "Undo", run: back, when: canUndo },
    {
      hint: "U",
      hintLabel: "redo",
      icon: "redo-2",
      keys: "U",
      label: "Redo",
      run: forth,
      when: canRedo,
    },
    { icon: "redo-2", keys: "mod+shift+z", label: "Redo", run: forth, when: canRedo },
  ]);
  // After a replay, the page where the action happened, unless it is the one shown.
  effect(() => {
    const now = said();
    if (now === null || (now.kind !== "undone" && now.kind !== "redone")) return;
    untracked(() => {
      if (pathOf(now.done.place) !== pathOf(route())) navigate(now.done.place);
    });
  });
  return null;
}

const TITLES: Record<Said["kind"], string> = {
  done: "Done",
  redone: "Redone",
  refused: "Not undone",
  undone: "Undone",
};

/** A button of the toast, with its key beside it where keys are typed. */
function Replay(props: { keys: string; label: string; onPress: () => void }) {
  return (
    <View style={{ alignItems: "center", flexDirection: "row", gap: 6 }}>
      <If when={!isNarrow() && singleKeys()}>
        <Kbd keys={props.keys} />
      </If>
      <Button
        icon={props.keys === "u" ? "undo-2" : "redo-2"}
        label={props.label}
        onPress={props.onPress}
      />
    </View>
  );
}

/** The toast of what the stack did last, until the next, or its time. */
export function UndoToast() {
  // Each new toast starts its own time; a refusal waits for its close.
  effect(() => {
    const now = said();
    if (now === null || now.kind === "refused") return;
    const timer = setTimeout(() => quiet(now.id), SHOWN_MS);
    cleanup(() => clearTimeout(timer));
  });
  return (
    <If when={said()}>
      {(now) => (
        <Toast
          icon={now().kind === "refused" ? "circle-x" : "circle-check"}
          testID="undo-toast"
          title={TITLES[now().kind]}
          tone={now().kind === "refused" ? "danger" : undefined}
        >
          <View style={{ alignItems: "flex-start", flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1, gap: 4, minWidth: 0 }}>
              <Text>{now().done.words}</Text>
              <If when={now().why}>{(why) => <Text tone="danger">{why()}</Text>}</If>
            </View>
            <IconButton icon="x" label="Close" onPress={() => quiet(now().id)} />
          </View>
          <View
            style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "flex-end" }}
          >
            <If when={now().kind === "refused" ? undefined : now().done.went}>
              {(went) => (
                <Button
                  icon="arrow-right"
                  label={went().label}
                  onPress={() => navigate(went().to)}
                />
              )}
            </If>
            <If when={now().kind === "done" || now().kind === "redone"}>
              <Replay keys="u" label="Undo" onPress={() => void undo()} />
            </If>
            <If when={now().kind === "undone"}>
              <Replay keys="U" label="Redo" onPress={() => void redo()} />
            </If>
          </View>
        </Toast>
      )}
    </If>
  );
}

/** The question of an undo, or a redo, of an action committed since. */
/** The question asked last, kept as it closes, so its words leave whole. */
const last = lastAsked(asking);

/** The question's verb. */
const word = () => (last()?.redo === true ? "Redo" : "Undo");

export function UndoQuestion() {
  return (
    <Confirm
      icon="git-commit-horizontal"
      keep="Keep it"
      keys={word() === "Redo" ? "U" : "u"}
      label={`${word()} it`}
      onClose={() => asking()?.answer(false)}
      onConfirm={() => asking()?.answer(true)}
      open={asking() !== null}
      title={`${word()} a committed change?`}
      words={`${last()?.done.words ?? ""} It was committed since: ${word() === "Redo" ? "redoing" : "undoing"} it writes the reverse as a new change, which waits on the Git page, and the commit stays.`}
    />
  );
}
