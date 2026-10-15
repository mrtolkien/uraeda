import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { VStack } from "@astryxdesign/core/VStack";
import { useState } from "react";
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

/** The line ＋ added, as the core wrote it: its key, and its text after its marker. */
export type Added = { key: string; text: string };

/**
 * The form: it reads the priorities when it opens, for the version it adds to. Its text is the
 * unsaved store's `quick-add`, kept as the overlay closes and restored as it opens again; Cancel
 * asks "Discard your changes?" first when it holds text.
 */
export function AddForm({
  onAdded,
  onCancel,
}: {
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

  const add = async () => {
    setMessage(undefined);
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
        {...(text.trim() ? { onSubmit: () => void add() } : {})}
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
      <HStack gap={2} justify="end">
        <Button label="Cancel" onClick={() => void cancel()} variant="secondary" />
        <Button clickAction={add} isDisabled={!text.trim()} label="Add" variant="primary" />
      </HStack>
    </VStack>
  );
}
