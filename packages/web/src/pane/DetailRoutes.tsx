// The routes of a line's address: the page the line was opened from, drawn once, whether or not
// the line's overlay is open over it, so opening and closing the overlay never draws the page
// again: its selection, its focus, and its scroll stay.
import { useInbox, usePriority } from "../data.ts";
import { Home } from "../Home.tsx";
import { InboxPage } from "../InboxPage.tsx";
import { PrioritiesPage } from "../PrioritiesPage.tsx";
import { DetailHost, NOTE, PRIORITY } from "./DetailOverlay.tsx";
import { NotePane, placed } from "./NotePane.tsx";
import { PriorityPane } from "./PriorityPane.tsx";

/** A priority's overlay, once its line is read. */
function PriorityDetail({ entryKey, list }: { entryKey: string; list: string }) {
  const { found, priorities } = usePriority(entryKey);
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

/** A note's overlay, once its note is read. */
function NoteDetail({ noteKey }: { noteKey: string }) {
  const inbox = useInbox();
  return (
    <DetailHost
      entryKey={noteKey}
      exists={inbox ? placed(inbox, noteKey) !== undefined : undefined}
      gone="That line is gone."
      kind={NOTE}
      list="/inbox"
    >
      <NotePane key={noteKey} noteKey={noteKey} />
    </DetailHost>
  );
}

/** The inbox, with the overlay of the note `noteKey` over it when there is one. */
export function InboxRoute({ noteKey }: { noteKey?: string }) {
  return (
    <>
      <InboxPage />
      {noteKey !== undefined && <NoteDetail noteKey={noteKey} />}
    </>
  );
}
