// The routes of a line's address: the page the line was opened from, drawn once, whether or not
// the line's overlay is open over it, so opening and closing the overlay never draws the page
// again: its selection, its focus, and its scroll stay.
import { useEffectEvent, useLayoutEffect, useState } from "react";
import { useInbox, usePriority } from "../data.ts";
import { Home } from "../Home.tsx";
import { InboxPage } from "../InboxPage.tsx";
import { PrioritiesPage } from "../PrioritiesPage.tsx";
import { redirect, useRepoPath } from "../routes.tsx";
import { DetailHost, PRIORITY } from "./DetailOverlay.tsx";
import { draftFile } from "../draftFile.ts";
import { PriorityPane } from "./PriorityPane.tsx";

/**
 * A line opens its draft's page, never an overlay: the page takes the line's place in the history,
 * so Back goes to the list the line was opened from. `to` is the page, within the repository.
 */
function ToDraft({ to }: { to: string }) {
  const here = useRepoPath();
  useLayoutEffect(() => redirect(here(to)), [here, to]);
  return null;
}

/** A priority's overlay, once its line is read; a line with a draft opens the draft's page. */
function PriorityDetail({ entryKey, list }: { entryKey: string; list: string }) {
  const { found, priorities } = usePriority(entryKey);
  if (found?.entry.draft) {
    return <ToDraft to={`/edit/${found.entry.draft.path}`} />;
  }
  return (
    <DetailHost
      entryKey={entryKey}
      exists={priorities ? found !== undefined : undefined}
      gone="That line is gone."
      kind={PRIORITY}
      list={list}
    >
      <PriorityPane entryKey={entryKey} key={entryKey} />
    </DetailHost>
  );
}

/**
 * Home, or the priorities page, with the overlay of the line `entryKey` over it when there is one.
 * A line opened from home draws the overlay over home.
 */
export function PrioritiesRoute({ entryKey, isHome }: { entryKey?: string; isHome: boolean }) {
  return (
    <>
      {isHome ? <Home /> : <PrioritiesPage />}
      {entryKey !== undefined && (
        <PriorityDetail entryKey={entryKey} list={isHome ? "/" : "/priorities"} />
      )}
    </>
  );
}

/**
 * A note's address, once the inbox is read: a note with a draft opens the draft's page; any other
 * is selected in the inbox, `onSelect`, whose address it takes back. A note has no page of its own.
 */
function NoteAddress({ noteKey, onSelect }: { noteKey: string; onSelect: (key: string) => void }) {
  const inbox = useInbox();
  const here = useRepoPath();
  const note = inbox?.categories
    .flatMap((category) => category.notes)
    .find((one) => one.key === noteKey);
  const select = useEffectEvent(onSelect);
  const isRead = inbox !== undefined;
  useLayoutEffect(() => {
    if (!isRead) {
      return;
    }
    if (note?.draft !== undefined) {
      redirect(here(`/edit/${draftFile(note.draft)}`));
      return;
    }
    if (note) {
      select(note.key);
    }
    redirect(here("/inbox"));
  }, [here, isRead, note]);
  return null;
}

/** The inbox; a note's address selects the note in it (see `NoteAddress`). */
export function InboxRoute({ noteKey }: { noteKey?: string }) {
  const [select, setSelect] = useState<{ key: string }>();
  return (
    <>
      <InboxPage select={select} />
      {noteKey !== undefined && (
        <NoteAddress noteKey={noteKey} onSelect={(key) => setSelect({ key })} />
      )}
    </>
  );
}
