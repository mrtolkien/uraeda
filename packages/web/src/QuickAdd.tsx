import { BottomSheet } from "@astryxdesign/core/BottomSheet";
import { Button } from "@astryxdesign/core/Button";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { TextArea } from "@astryxdesign/core/TextArea";
import { Suspense, useState } from "react";
import { useFateClient } from "react-fate";
import { usePriorities } from "./data.ts";
import { refusal } from "./errors.ts";
import { PrioritiesView } from "./views.ts";

const TITLES: Record<string, string> = {
  now: "Now",
  next: "Next",
  later: "Later",
  blocked: "Blocked",
};

/** The sheet's form: it reads the priorities when it opens, for the version it adds to. */
function AddForm({ onAdded }: { onAdded: (section: string) => void }) {
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
    setText("");
    onAdded(section);
  };

  return (
    <div>
      <h2 className="title-l">New priority</h2>
      <TextArea
        label="Priority"
        isLabelHidden
        value={text}
        hasAutoFocus
        rows={3}
        onChange={(value: string) => setText(value)}
      />
      <div style={{ marginTop: 12 }}>
        <SegmentedControl
          label="Section"
          value={section}
          onChange={(value: string) => setSection(value)}
        >
          {Object.entries(TITLES).map(([id, title]) => (
            <SegmentedControlItem key={id} value={id} label={title} />
          ))}
        </SegmentedControl>
      </div>
      <div className="actions">
        <Button variant="primary" label="Add" isDisabled={!text.trim()} clickAction={add} />
      </div>
      {message && <p className="not-saved">{message}</p>}
    </div>
  );
}

/** ＋: jots a line down at the end of a section of `PRIORITIES.md`, Next by default, at once. */
export function QuickAdd() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string>();

  return (
    <>
      <Button
        variant="ghost"
        label="Add a priority"
        isIconOnly
        icon={<span aria-hidden="true">＋</span>}
        onClick={() => {
          setMessage(undefined);
          setOpen(true);
        }}
      />
      {message && (
        <span role="status" className="small saved" style={{ marginLeft: 8 }}>
          {message}
        </span>
      )}
      <BottomSheet label="New priority" isOpen={open} onOpenChange={setOpen}>
        {open && (
          <Suspense fallback={<p className="muted">Loading…</p>}>
            <AddForm
              onAdded={(section) => {
                setOpen(false);
                setMessage(`Added to ${TITLES[section]}, not committed`);
              }}
            />
          </Suspense>
        )}
      </BottomSheet>
    </>
  );
}
