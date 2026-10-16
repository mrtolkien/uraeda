import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { VStack } from "@astryxdesign/core/VStack";
import { type KeyboardEvent, useState } from "react";
import { useFateClient } from "react-fate";
import { usePriorities } from "./data.ts";
import { refusal } from "./errors.ts";
import { DISCARD_CHANGES, useConfirm } from "./fields/Confirm.tsx";
import { RestoreNotice } from "./fields/RestoreNotice.tsx";
import { TextField } from "./fields/TextField.tsx";
import { useTextField } from "./fields/useTextField.ts";
import { PrioritiesView } from "./views.ts";

/** Each section's title, in the order the page shows them: a map, which the lint does not sort. */
export const TITLES = new Map([
  ["now", "Now"],
  ["next", "Next"],
  ["later", "Later"],
  ["blocked", "Blocked"],
]);

/** What "Add and commit" says when the file had other changes: the line is added, not committed. */
export function notCommitted(section: string) {
  return `Added to ${TITLES.get(section)}. Not committed: PRIORITIES.md has other changes to commit or discard.`;
}

/** A one-line field's Enter, Shift+Enter aside: it calls `onEnter` instead of a new line. */
export function enterAdds(onEnter: () => void) {
  return (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      onEnter();
    }
  };
}

/**
 * A ＋ form's buttons: Cancel, Add, which adds the line uncommitted, and "Add and commit", the
 * primary one and Enter's, which commits that file alone.
 */
export function AddButtons({
  isReady,
  onAdd,
  onAddAndCommit,
  onCancel,
}: {
  isReady: boolean;
  onAdd: () => Promise<void>;
  /** Without it, Add alone, the primary button, as before Q8. */
  onAddAndCommit?: () => Promise<void>;
  onCancel: () => void;
}) {
  const committing = onAddAndCommit !== undefined;
  return (
    <HStack gap={2} justify="end" wrap="wrap">
      <Button label="Cancel" onClick={onCancel} variant={committing ? "ghost" : "secondary"} />
      <Button
        clickAction={onAdd}
        isDisabled={!isReady}
        label="Add"
        variant={committing ? "secondary" : "primary"}
      />
      {committing && (
        <Button
          clickAction={onAddAndCommit}
          isDisabled={!isReady}
          label="Add and commit"
          variant="primary"
        />
      )}
    </HStack>
  );
}

/** The line ＋ added, as the core wrote it: its key, and its text after its marker. */
export type Added = { key: string; text: string };

/**
 * The form: it reads the priorities when it opens, for the version it adds to. Its text is the
 * unsaved store's `quick-add`, kept as the overlay closes and restored as it opens again; Cancel
 * asks "Discard your changes?" first when it holds text.
 */
export function AddForm({
  canCommit = false,
  notice: shown,
  onAdded,
  onCancel,
}: {
  /** "Add and commit" beside Add, the default on Enter (Q8 of the redesign of the priorities). */
  canCommit?: boolean;
  /** What "Add and commit" said last, from the start: the stories' not-committed state. */
  notice?: string;
  onAdded: (section: string, added: Added | undefined) => void;
  onCancel: () => void;
}) {
  const fate = useFateClient();
  const confirm = useConfirm();
  const priorities = usePriorities();
  const field = useTextField("quick-add", "");
  const text = field.text;
  const [section, setSection] = useState("next");
  const [message, setMessage] = useState<string>();
  const [notice, setNotice] = useState(shown);

  const add = async (commit = false) => {
    setMessage(undefined);
    setNotice(undefined);
    const result = await fate.mutations.priorities.add({
      input: { hash: priorities?.hash ?? "", section, text },
      view: PrioritiesView,
    });
    if (result.error) {
      setMessage(refusal(result.error).message);
      return;
    }
    // The line just added ends its section.
    const added = result.result?.sections.find((s) => s.section === section)?.entries.at(-1);
    // Forgotten once added, unless more was typed meanwhile.
    if (field.unsavedNow()?.text === text) {
      field.discard();
    }
    if (commit) {
      // TEMPORARY: the core cannot commit PRIORITIES.md alone yet (Q1): the form stays open,
      // saying the line is added and not committed, as when the file has other changes.
      setNotice(notCommitted(section));
      return;
    }
    onAdded(section, added && { key: added.key, text: added.text });
  };

  const cancel = async () => {
    if (field.dirty && !(await confirm(DISCARD_CHANGES))) {
      return;
    }
    field.discard();
    onCancel();
  };

  return (
    <VStack gap={4}>
      {field.restored && (
        // Its saved text is always empty: it never changes since.
        <RestoreNotice changed="" onDiscard={field.discard} restored={field.restored} />
      )}
      <TextField
        hasAutoFocus
        isLabelHidden
        kind="line"
        label="Priority"
        onChange={field.change}
        {...(canCommit
          ? // A line: Enter adds and commits, Ctrl+Enter or Cmd+Enter as well.
            { onKeyDown: enterAdds(() => text.trim() && void add(true)) }
          : text.trim()
            ? { onSubmit: () => void add() }
            : {})}
        value={text}
      />
      <SegmentedControl
        label="Section"
        onChange={(value: string) => setSection(value)}
        value={section}
      >
        {[...TITLES].map(([id, title]) => (
          <SegmentedControlItem key={id} label={title} value={id} />
        ))}
      </SegmentedControl>
      {message && <Banner status="error" title={message} />}
      {notice && <Banner status="warning" title={notice} />}
      <AddButtons
        isReady={text.trim() !== ""}
        onAdd={() => add()}
        {...(canCommit ? { onAddAndCommit: () => add(true) } : {})}
        onCancel={() => void cancel()}
      />
    </VStack>
  );
}
