// What a field's save did, beside its Save button: "Unsaved changes" while the text differs from
// the saved one, "Saving…", "Saved" once nothing differs, or "Not saved", kept until the next
// save, whose why the field shows under itself (`TextField`'s `refusal`), where the hand was. It
// always takes the room of its longest words, so the first letter typed moves nothing.
import { type Accessor, signal, View } from "nsh";
import { Icon, Text } from "../controls";
import type { UnsavedText } from "./unsaved";

/** Where a save is. */
export type SaveState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved" }
  | { kind: "refused"; why: string };

/** A field's saves, one after the other: `send` throws when the server refuses, its message the why. */
export type Saving = {
  /** Saves the field's text as it is now: says whether it was saved. */
  save: () => Promise<boolean>;
  state: Accessor<SaveState>;
  /** Why the last save was refused, for the field's `refusal`: `null` once one passes. */
  refusal: Accessor<string | null>;
};

/**
 * The saves of one field, through `send`, which resolves once the server kept the text: the
 * field's own `save`, with the state `SaveStatus` shows. What is typed while one goes stays
 * unsaved, over the text saved.
 */
export function saving(
  field: Pick<UnsavedText, "save">,
  send: (text: string) => Promise<void>,
): Saving {
  const state = signal<SaveState>({ kind: "idle" });
  return {
    refusal: () => {
      const now = state();
      return now.kind === "refused" ? now.why : null;
    },
    async save() {
      state.set({ kind: "saving" });
      const done = await field.save(send);
      state.set(done.ok ? { kind: "saved" } : { kind: "refused", why: done.why ?? "" });
      return done.ok;
    },
    state,
  };
}

/** The words of a state, and their tone. */
function shown(dirty: boolean, state: SaveState) {
  if (state.kind === "saving") {
    return { icon: null, tone: "quiet", words: "Saving…" } as const;
  }
  if (state.kind === "refused") {
    return { icon: "circle-alert", tone: "danger", words: "Not saved" } as const;
  }
  if (dirty) {
    return { icon: null, tone: "quiet", words: "Unsaved changes" } as const;
  }
  return state.kind === "saved"
    ? ({ icon: "circle-check", tone: "done", words: "Saved" } as const)
    : null;
}

export function SaveStatus(props: { dirty: boolean; state: SaveState; testID?: string }) {
  return (
    <View
      style={{ alignItems: "center", flexDirection: "row", gap: 4, minWidth: 128 }}
      testID={props.testID}
    >
      <If when={shown(props.dirty, props.state)}>
        {(now) => (
          <>
            <If when={now().icon}>{(name) => <Icon name={name()} />}</If>
            <Text size="under" tone={now().tone}>
              {now().words}
            </Text>
          </>
        )}
      </If>
    </View>
  );
}
