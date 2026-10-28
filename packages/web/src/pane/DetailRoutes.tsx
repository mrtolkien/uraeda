// The routes of a proposal's or a note's address: the page it was opened from, drawn once, whether
// or not its overlay is open over it, so opening and closing the overlay never draws the page
// again: its selection, its focus, and its scroll stay.
import { useEffectEvent, useLayoutEffect, useState } from "react";
import { useInbox, useProposal } from "../data.ts";
import { Home } from "../Home.tsx";
import { InboxPage } from "../InboxPage.tsx";
import { PrioritiesPage } from "../PrioritiesPage.tsx";
import { redirect, useRepoPath } from "../routes.tsx";
import { DetailHost, PROPOSAL } from "./DetailOverlay.tsx";
import { ProposalPane } from "./ProposalPane.tsx";

/**
 * A proposal or a note with a file opens the file's page, never an overlay: the page takes its
 * place in the history, so Back goes to the list it was opened from. `to` is the page, within the
 * repository.
 */
function ToFile({ to }: { to: string }) {
  const here = useRepoPath();
  useLayoutEffect(() => redirect(here(to)), [here, to]);
  return null;
}

/** A proposal's overlay, once it is read; a proposal with a file opens the file's page. */
function ProposalDetail({ list, proposalKey }: { list: string; proposalKey: string }) {
  const { found, priorities } = useProposal(proposalKey);
  if (found?.proposal.file) {
    return <ToFile to={`/edit/${found.proposal.file.path}`} />;
  }
  return (
    <DetailHost
      exists={priorities ? found !== undefined : undefined}
      gone="That proposal is gone."
      kind={PROPOSAL}
      list={list}
      proposalKey={proposalKey}
    >
      <ProposalPane key={proposalKey} proposalKey={proposalKey} />
    </DetailHost>
  );
}

/**
 * Home, or the priorities page, with the overlay of the proposal `proposalKey` over it when there
 * is one. A proposal opened from home draws the overlay over home.
 */
export function PrioritiesRoute({
  isHome,
  proposalKey,
}: {
  isHome: boolean;
  proposalKey?: string;
}) {
  return (
    <>
      {isHome ? <Home /> : <PrioritiesPage />}
      {proposalKey !== undefined && (
        <ProposalDetail list={isHome ? "/" : "/priorities"} proposalKey={proposalKey} />
      )}
    </>
  );
}

/**
 * A note's address, once the inbox is read: a note with a note file opens the file's page; any
 * other is selected in the inbox, `onSelect`, whose address it takes back. A note has no page of
 * its own.
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
    if (note?.file !== undefined) {
      redirect(here(`/edit/${note.file}`));
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
