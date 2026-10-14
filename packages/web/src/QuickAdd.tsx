import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { Spinner } from "@astryxdesign/core/Spinner";
import { TextArea } from "@astryxdesign/core/TextArea";
import { VStack } from "@astryxdesign/core/VStack";
import { Suspense, useState } from "react";
import { useFateClient } from "react-fate";
import { readPriorities, usePriorities } from "./data.ts";
import { refusal } from "./errors.ts";
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

/** The form: it reads the priorities when it opens, for the version it adds to. */
function AddForm({ onAdded }: { onAdded: (section: string, added: Added | undefined) => void }) {
  const fate = useFateClient();
  const priorities = usePriorities();
  const [text, setText] = useState("");
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
    setText("");
    onAdded(section, added && { key: added.key, text: added.text });
  };

  return (
    <VStack gap={4}>
      <TextArea
        hasAutoFocus
        isLabelHidden
        label="Priority"
        onChange={(value: string) => setText(value)}
        rows={3}
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
      <HStack justify="end">
        <Button clickAction={add} isDisabled={!text.trim()} label="Add" variant="primary" />
      </HStack>
    </VStack>
  );
}

/**
 * ＋: jots a line down at the end of a section of `PRIORITIES.md`, Next by default, at once. A toast
 * says where it went, with Undo.
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
          <AddForm onAdded={added} />
        </Suspense>
      </Overlay>
    </>
  );
}
