import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { VStack } from "@astryxdesign/core/VStack";
import { type KeyboardEvent, type ReactNode, useEffect, useRef, useState } from "react";
import { useFateClient } from "react-fate";
import { usePriorities } from "./data.ts";
import { refusal } from "./errors.ts";
import { DISCARD_CHANGES, useConfirm } from "./fields/Confirm.tsx";
import { showPageError } from "./layout/useUndoToast.ts";
import { RestoreNotice } from "./fields/RestoreNotice.tsx";
import { TextField } from "./fields/TextField.tsx";
import { useTextField } from "./fields/useTextField.ts";
import { PrioritiesAddedView } from "./views.ts";

/**
 * The sections a line goes to, with their titles, in the order the page shows them: a map, which
 * the lint does not sort. Blocked is retired, so it is no target.
 */
export const TITLES = new Map([
  ["now", "Now"],
  ["next", "Next"],
  ["later", "Later"],
]);

/** A section's title to display, a Blocked an existing file still has included. */
export function titleOf(section: string) {
  return section === "blocked" ? "Blocked" : (TITLES.get(section) ?? section);
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
 * A ＋ form's buttons: `start` first in the row, like the inbox's "Attach an image", Cancel when
 * the form has one, then Add, the primary one and Enter's, which adds the line uncommitted, for the
 * commit page's Commit.
 */
export function AddButtons({
  addLabel = "Add",
  isReady,
  onAdd,
  onCancel,
  start,
}: {
  /** Add's label, like "Add as a file". */
  addLabel?: string;
  isReady: boolean;
  onAdd: () => Promise<void>;
  /** Without it, no Cancel: the overlay's Close cancels. */
  onCancel?: () => void;
  start?: ReactNode;
}) {
  return (
    <HStack gap={2} justify="end" wrap="wrap">
      {start}
      {onCancel && <Button label="Cancel" onClick={onCancel} variant="secondary" />}
      <Button clickAction={onAdd} isDisabled={!isReady} label={addLabel} variant="primary" />
    </HStack>
  );
}

/** The line ＋ added, as the core wrote it: its key, its text after its marker, and its lines. */
export type Added = {
  key: string;
  lines: ReadonlyArray<string>;
  text: string;
};

/** The sections a line goes to, one picked. */
function SectionPicker({
  onChange,
  section,
}: {
  onChange: (section: string) => void;
  section: string;
}) {
  return (
    <SegmentedControl label="Section" onChange={onChange} value={section}>
      {[...TITLES].map(([id, title]) => (
        <SegmentedControlItem key={id} label={title} value={id} />
      ))}
    </SegmentedControl>
  );
}

/**
 * The form: it reads the priorities when it opens, for the version it adds to. Its text is the
 * unsaved store's `quick-add`, kept as the overlay closes and restored as it opens again; Cancel
 * asks "Discard your changes?" first when it holds text.
 */
export function AddForm({
  onAdded,
  onCancel,
  section: start = "next",
}: {
  onAdded: (section: string, added: Added | undefined) => void;
  onCancel: () => void;
  /** The section the form opens on, Next by default. */
  section?: string;
}) {
  const fate = useFateClient();
  const confirm = useConfirm();
  const priorities = usePriorities();
  const field = useTextField("quick-add", "");
  const text = field.text;
  const [section, setSection] = useState(start);
  // The field takes the focus once the dialog has settled: the dialog's own focus goes to its first
  // control as it opens, which an autofocus alone sometimes loses to, as a key that opened it.
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const timer = setTimeout(() => box.current?.querySelector("textarea")?.focus(), 120);
    return () => clearTimeout(timer);
  }, []);

  // Adds the line, uncommitted, and closes the form at once, `onCancel`'s close: the line shows
  // once written, with its toast. A refusal shows in the page, and the form, opened again, has the
  // text back: it is forgotten only once added.
  const add = async () => {
    onCancel();
    const result = await fate.mutations.proposals.add({
      input: { hash: priorities?.hash ?? "", section, text },
      view: PrioritiesAddedView,
    });
    if (result.error) {
      showPageError(refusal(result.error).message);
      return;
    }
    const answer = result.result;
    // The proposal just added ends its section.
    const added = answer?.sections.find((s) => s.section === section)?.proposals.at(-1);
    // Forgotten once added, unless more was typed meanwhile.
    if (field.unsavedNow()?.text === text) {
      field.discard();
    }
    onAdded(section, added && { key: added.key, lines: added.lines, text: added.text });
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
      <div ref={box}>
        <TextField
          hasAutoFocus
          isLabelHidden
          kind="line"
          label="Proposal"
          onChange={field.change}
          // A proposal is a line: Enter adds it, and closes the form.
          onKeyDown={enterAdds(() => text.trim() && void add())}
          value={text}
        />
      </div>
      <SectionPicker onChange={setSection} section={section} />
      <AddButtons isReady={text.trim() !== ""} onAdd={add} onCancel={() => void cancel()} />
    </VStack>
  );
}
