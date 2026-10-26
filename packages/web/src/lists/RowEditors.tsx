// A card's text edited in place, from the `i` key: the field the task view's Edit opens, in the
// card's own place. It saves through what the view saves with (`usePriorityActions`'s `rename`,
// `useNoteActions`' `edit`), keeps its unsaved text under the view's own key, so either restores the
// other's, and tells the list once it closed, saved or not.
import { useEffect } from "react";
import type { InboxNote } from "uraeda-binding";
import { LineField } from "../EditableLine.tsx";
import { type Found, usePriorityActions } from "../pane/usePriorityActions.ts";
import { plain } from "../Spans.tsx";
import { type Placed, useNoteActions } from "../useNoteActions.ts";
import { useLineSave } from "../useLineSave.ts";

/** An editor in a card leaves the page as it is: the task view's own editor follows the new key. */
const NO_REDIRECT = { redirects: false };

/** The line's field, open, and `onDone` once it closed. */
function RowEditor({
  empty,
  field,
  label,
  onDone,
  onSave,
  value,
}: {
  empty?: string;
  field: string;
  label: string;
  onDone: () => void;
  onSave: (text: string) => Promise<string | undefined>;
  value: string;
}) {
  const line = useLineSave({ empty, field, onSave, startOpen: true, stayOpen: false, value });
  useEffect(() => {
    if (!line.open) {
      onDone();
    }
  }, [line.open, onDone]);
  return line.open ? <LineField label={label} line={line} /> : null;
}

/** A priority's line, edited in place: `found` is its line and place, over the priorities of `hash`. */
export function PriorityEditor({
  found,
  hash,
  onDone,
}: {
  found: Found;
  hash: string;
  onDone: () => void;
}) {
  const actions = usePriorityActions(found, hash, () => undefined, NO_REDIRECT);
  const { entry } = found;
  return (
    <RowEditor
      field={`priorities#${entry.key}`}
      label={`Edit ${plain(entry.spans)}`}
      onDone={onDone}
      onSave={actions.rename}
      value={entry.text}
    />
  );
}

/** A note, edited in place: `placed` is its note and place, over the inbox of `hash`. */
export function NoteEditor({
  hash,
  onDone,
  placed,
}: {
  hash: string;
  onDone: () => void;
  placed: Placed & { note: InboxNote };
}) {
  const actions = useNoteActions(placed, hash, () => undefined, NO_REDIRECT);
  const { note } = placed;
  return (
    <RowEditor
      empty="A note needs text."
      field={`inbox#${note.key}`}
      label={`Edit ${plain(note.spans)}`}
      onDone={onDone}
      onSave={actions.edit}
      value={note.text}
    />
  );
}
