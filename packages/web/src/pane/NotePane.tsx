import { Banner } from "@astryxdesign/core/Banner";
import { Divider } from "@astryxdesign/core/Divider";
import { Link } from "@astryxdesign/core/Link";
import { useState } from "react";
import type { Inbox } from "uraeda-server/fate";
import { useInbox } from "../data.ts";
import { Marks } from "../InboxPage.tsx";
import { Page } from "../layout/Page.tsx";
import { navigate, useRepoPath, useRestoreScroll } from "../routes.tsx";
import { useLineSave } from "../useLineSave.ts";
import { categoryName, type Placed, type Renaming, useNoteActions } from "../useNoteActions.ts";
import { EntryPane, EntryText, Steps } from "./EntryPane.tsx";
import { CategoryMenu, draftFile, Organize } from "./NoteParts.tsx";

/**
 * The note of a key, with its place; while its text is saved, and so its key changes, the note of
 * its id, only as long as that note holds the text saved: an id is a place, which another note
 * takes once this one goes.
 */
function placed(
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
  onClose,
  onRenaming,
}: {
  found: Placed;
  inbox: Pick<Inbox, "categories" | "hash" | "names">;
  onClose?: () => void;
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
      draftHref={note.draft === undefined ? undefined : here(`/edit/${draftFile(note.draft)}`)}
      isEditing={line.open}
      location={`Note, in ${categoryName(found.category)}`}
      onClose={onClose}
      onDelete={actions.remove}
      onEdit={line.openLine}
      steps={
        <Steps
          count={notes.length}
          index={found.index}
          onStep={(to) => navigate(here(`/inbox/${notes[to].key}`))}
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
      <Divider />
      <CategoryMenu category={found.category} names={inbox.names} onPick={actions.toCategory} />
      <Organize actions={actions} draft={note.draft} />
      {actions.message && <Banner collapsible={false} status="error" title={actions.message} />}
    </EntryPane>
  );
}

/**
 * A note of `INBOX.md` in the pane, by its key: read-only on arrival, Edit in its bar, its children
 * under it. On narrow screens, the page itself.
 */
export function NotePane({ noteKey, onClose }: { noteKey: string; onClose?: () => void }) {
  const inbox = useInbox();
  const here = useRepoPath();
  // The note's id and new text while it is renamed: its key changes before its address does.
  const [renaming, setRenaming] = useState<Renaming>();
  // Its data is read before it draws: the position comes back at once.
  useRestoreScroll(true);
  if (!inbox) {
    return null;
  }
  const found = placed(inbox, noteKey, renaming);
  if (!found) {
    return (
      <Page>
        <Banner
          collapsible={false}
          description={
            <Link hasUnderline href={here("/inbox")}>
              Open the inbox
            </Link>
          }
          status="error"
          title="This note is no longer in INBOX.md."
        />
      </Page>
    );
  }
  return <NoteBody found={found} inbox={inbox} onClose={onClose} onRenaming={setRenaming} />;
}
