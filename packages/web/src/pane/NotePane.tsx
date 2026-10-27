import { AnnouncedBanner } from "../layout/AnnouncedBanner.tsx";
import { Divider } from "@astryxdesign/core/Divider";
import { useState } from "react";
import type { Inbox } from "uraeda-server/fate";
import { useInbox } from "../data.ts";
import { Marks } from "../InboxPage.tsx";
import { redirect, useRepoPath } from "../routes.tsx";
import { useLineSave } from "../useLineSave.ts";
import { categoryName, type Placed, type Renaming, useNoteActions } from "../useNoteActions.ts";
import { EntryPane, EntryText, Steps } from "./EntryPane.tsx";
import { CategoryMenu, Organize } from "./NoteParts.tsx";
import { NoteImages } from "./NoteImages.tsx";

/**
 * The note of a key, with its place; while its text is saved, and so its key changes, the note of
 * its id, only as long as that note holds the text saved: an id is a place, which another note
 * takes once this one goes.
 */
export function placed(
  inbox: Pick<Inbox, "categories">,
  key: string,
  renaming?: Renaming,
): Placed | undefined {
  const find = (match: (note: Placed["note"]) => boolean) => {
    for (const category of inbox.categories) {
      const index = category.notes.findIndex(match);
      if (index >= 0) {
        return { category: category.name, index, note: category.notes[index] };
      }
    }
    return undefined;
  };
  return (
    find((note) => note.key === key) ??
    (renaming ? find((note) => note.id === renaming.id && note.text === renaming.text) : undefined)
  );
}

/** A found note's pane: its text and children, its Category, Organize, Delete, its neighbours. */
function NoteBody({
  found,
  inbox,
  onRenaming,
}: {
  found: Placed;
  inbox: Pick<Inbox, "categories" | "hash" | "names">;
  onRenaming: (renaming: Renaming | undefined) => void;
}) {
  const here = useRepoPath();
  const { note } = found;
  const actions = useNoteActions(found, inbox.hash, onRenaming);
  const line = useLineSave({
    empty: "A note needs text.",
    field: `inbox#${note.key}`,
    onSave: actions.edit,
    stayOpen: false,
    value: note.text,
  });
  const notes = inbox.categories.find((c) => c.name === found.category)?.notes ?? [];
  return (
    <EntryPane
      isEditing={line.open}
      location={`Note, in ${categoryName(found.category)}`}
      onDelete={actions.remove}
      onEdit={line.openLine}
      steps={
        <Steps
          count={notes.length}
          index={found.index}
          // The overlay shows another note in its own history entry.
          onStep={(to) => redirect(here(`/inbox/${notes[to].key}`))}
        />
      }
      text={
        <EntryText
          label="Note"
          line={line}
          marks={<Marks note={note} />}
          nested={note.nestedSpans}
          spans={note.spans}
        />
      }
    >
      <NoteImages hash={inbox.hash} note={note} />
      <Divider />
      <CategoryMenu category={found.category} names={inbox.names} onPick={actions.toCategory} />
      <Organize actions={actions} draft={note.draft} />
      {actions.message && (
        <AnnouncedBanner collapsible={false} status="error" title={actions.message} />
      )}
    </EntryPane>
  );
}

/**
 * A note of `INBOX.md` in its overlay, by its key: read-only on arrival, Edit in its bar, its
 * children under it. A note that is not there draws nothing: the route says it is gone.
 */
export function NotePane({ noteKey }: { noteKey: string }) {
  const inbox = useInbox();
  // The note's id and new text while it is renamed: its key changes before its address does.
  const [renaming, setRenaming] = useState<Renaming>();
  const found = inbox ? placed(inbox, noteKey, renaming) : undefined;
  if (!inbox || !found) {
    return null;
  }
  return <NoteBody found={found} inbox={inbox} onRenaming={setRenaming} />;
}
