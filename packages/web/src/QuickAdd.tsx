import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { Spinner } from "@astryxdesign/core/Spinner";
import { TextArea } from "@astryxdesign/core/TextArea";
import { VStack } from "@astryxdesign/core/VStack";
import { Suspense, useState } from "react";
import { useFateClient } from "react-fate";
import { readPrioritiesHash, usePriorities } from "./data.ts";
import { refusal } from "./errors.ts";
import { Overlay } from "./layout/Overlay.tsx";
import { useUndoToast } from "./layout/useUndoToast.ts";
import { PrioritiesView } from "./views.ts";

const TITLES: Record<string, string> = {
  now: "Now",
  next: "Next",
  later: "Later",
  blocked: "Blocked",
};

/** The form: it reads the priorities when it opens, for the version it adds to. */
function AddForm({ onAdded }: { onAdded: (section: string, entry: string | undefined) => void }) {
  const fate = useFateClient();
  const priorities = usePriorities();
  const [text, setText] = useState("");
  const [section, setSection] = useState("next");
  const [message, setMessage] = useState<string>();

  const add = async () => {
    setMessage(undefined);
    const result = await fate.mutations.priorities.add({
      input: { section, text, hash: priorities?.hash ?? "" },
      view: PrioritiesView,
    });
    if (result.error) {
      setMessage(refusal(result.error).message);
      return;
    }
    // The line just added ends its section.
    const added = result.result?.sections.find((s) => s.section === section)?.entries.at(-1);
    setText("");
    onAdded(section, added?.id);
  };

  return (
    <VStack gap={4}>
      <TextArea
        label="Priority"
        isLabelHidden
        value={text}
        hasAutoFocus
        rows={3}
        onChange={(value: string) => setText(value)}
      />
      <SegmentedControl
        label="Section"
        value={section}
        onChange={(value: string) => setSection(value)}
      >
        {Object.entries(TITLES).map(([id, title]) => (
          <SegmentedControlItem key={id} value={id} label={title} />
        ))}
      </SegmentedControl>
      {message && <Banner status="error" title={message} />}
      <HStack justify="end">
        <Button variant="primary" label="Add" isDisabled={!text.trim()} clickAction={add} />
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

  const added = (section: string, entry: string | undefined) => {
    setOpen(false);
    toast(`Added to ${TITLES[section]}, not committed`, async () => {
      if (!entry) {
        return "The line was not found.";
      }
      // Removed by its place, over the file as it is now: an edit since is removed with it.
      const hash = await readPrioritiesHash(fate);
      const result = await fate.mutations.priorities.remove({
        input: { entry, hash },
        view: PrioritiesView,
      });
      return result.error ? refusal(result.error).message : undefined;
    });
  };

  return (
    <>
      <Button
        variant="ghost"
        label="Add a priority"
        isIconOnly
        icon={<span aria-hidden="true">＋</span>}
        onClick={() => setOpen(true)}
      />
      <Overlay label="New priority" isOpen={open} onClose={() => setOpen(false)}>
        <Suspense fallback={<Spinner label="Loading the priorities" />}>
          <AddForm onAdded={added} />
        </Suspense>
      </Overlay>
    </>
  );
}
