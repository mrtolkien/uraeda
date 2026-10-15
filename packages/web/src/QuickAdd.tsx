import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { Spinner } from "@astryxdesign/core/Spinner";
import { VStack } from "@astryxdesign/core/VStack";
import { Suspense, useState } from "react";
import { useFateClient } from "react-fate";
import { readPriorities, usePriorities } from "./data.ts";
import { refusal } from "./errors.ts";
import { DISCARD_CHANGES, useConfirm } from "./fields/Confirm.tsx";
import { RestoreNotice } from "./fields/RestoreNotice.tsx";
import { TextField } from "./fields/TextField.tsx";
import { useTextField } from "./fields/useTextField.ts";
import { Overlay } from "./layout/Overlay.tsx";
import { useUndoToast } from "./layout/useUndoToast.ts";
import { PrioritiesView } from "./views.ts";

/** Each section's title, in the order the page shows them: a map, which the lint does not sort. */
const TITLES = new Map([
  ["now", "Now"],
  ["next", "Next"],
  ["later", "Later"],
  ["blocked", "Blocked"],
]);

/** The line ＋ added, as the core wrote it: its key, and its text after its marker. */
type Added = { key: string; text: string };

/**
 * The form: it reads the priorities when it opens, for the version it adds to. Its text is the
 * unsaved store's `quick-add`, kept as the overlay closes and restored as it opens again; Cancel
 * asks "Discard your changes?" first when it holds text.
 */
function AddForm({
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

/**
 * ＋: jots a line down at the end of a section of `PRIORITIES.md`, Next by default, at once. A toast
 * says where it went, with Undo. Closing the overlay with Close, Back, or Escape keeps its text.
 */
export function QuickAdd() {
  const fate = useFateClient();
  const [open, setOpen] = useState(false);
  const toast = useUndoToast();

  const added = (section: string, line: Added | undefined) => {
    setOpen(false);
    toast(`Added to ${TITLES.get(section)}, not committed`, async () => {
      // Found again in the file as it is now, by its text: the line it added, wherever it is.
      const now = await readPriorities(fate);
      const same = now.sections.flatMap((s) => s.entries).filter((e) => e.text === line?.text);
      const entry = same.find((e) => e.key === line?.key) ?? (same.length === 1 ? same[0] : null);
      if (!line || !entry) {
        return `Could not undo: "${line?.text ?? ""}" is no longer in PRIORITIES.md.`;
      }
      const result = await fate.mutations.priorities.remove({
        input: { entry: entry.id, hash: now.hash },
        view: PrioritiesView,
      });
      return result.error ? refusal(result.error).message : undefined;
    });
  };

  return (
    <>
      <Button
        icon={<span aria-hidden="true">＋</span>}
        isIconOnly
        label="Add a priority"
        onClick={() => setOpen(true)}
        variant="ghost"
      />
      <Overlay isOpen={open} label="New priority" onClose={() => setOpen(false)}>
        <Suspense fallback={<Spinner label="Loading the priorities" />}>
          <AddForm onAdded={added} onCancel={() => setOpen(false)} />
        </Suspense>
      </Overlay>
    </>
  );
}
