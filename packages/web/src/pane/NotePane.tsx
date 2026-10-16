import { Banner } from "@astryxdesign/core/Banner";
import { Divider } from "@astryxdesign/core/Divider";
import { Link } from "@astryxdesign/core/Link";
import { useState } from "react";
import type { Inbox } from "uraeda-server/fate";
import type { Span } from "uraeda-binding";
import { useInbox } from "../data.ts";
import { Marks } from "../InboxPage.tsx";
import { navigate, useRepoPath } from "../routes.tsx";
import { useLineSave } from "../useLineSave.ts";
import { categoryName, type Placed, type Renaming, useNoteActions } from "../useNoteActions.ts";
import { EntryPane, EntryText, Steps } from "./EntryPane.tsx";
import { CategoryMenu, draftFile, Organize } from "./NoteParts.tsx";

/** The note of a key, with its category and its place in it. */
function placed(inbox: Pick<Inbox, "categories">, key: string): Placed | undefined {
  for (const category of inbox.categories) {
    const index = category.notes.findIndex((note) => note.key === key);
    if (index >= 0) {
      return { category: category.name, index, note: category.notes[index] };
    }
  }
  return undefined;
}

/** A found note's pane: its text and children, its Category, Organize, Delete, its neighbours. */
function NoteBody({
  found,
  inbox,
  nested,
  onClose,
}: {
  found: Placed;
  inbox: Pick<Inbox, "categories" | "hash" | "names">;
  nested: ReadonlyArray<ReadonlyArray<Span>>;
  onClose?: () => void;
}) {
  const here = useRepoPath();
  const [, setRenaming] = useState<Renaming>();
  const { note } = found;
  const actions = useNoteActions(found, inbox.hash, setRenaming);
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
      line={line}
      location={`Note, in ${categoryName(found.category)}`}
      onClose={onClose}
      onDelete={actions.remove}
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
          nested={nested}
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
 * A note of `INBOX.md` in the pane, by its key: read-only on arrival, Edit in its bar. TEMPORARY:
 * `nested`, its children, are given: the core does not read a note's children yet (Q1, Q9).
 */
export function NotePane({
  nested = [],
  noteKey,
  onClose,
}: {
  nested?: ReadonlyArray<ReadonlyArray<Span>>;
  noteKey: string;
  onClose?: () => void;
}) {
  const inbox = useInbox();
  const here = useRepoPath();
  if (!inbox) {
    return null;
  }
  const found = placed(inbox, noteKey);
  if (!found) {
    return (
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
    );
  }
  return <NoteBody found={found} inbox={inbox} nested={nested} onClose={onClose} />;
}
