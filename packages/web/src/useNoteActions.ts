// What the promote picker does to a note: move it into the priorities, under one of their
// proposals, or into a proposal file, each written at once over the inbox as read, and recorded on
// the undo stack with the change it answered: its undo writes both files back, or neither.
import { useState } from "react";
import { useFateClient } from "react-fate";
import type { InboxNote } from "uraeda-binding";
import { readInbox, readPriorities, readPrioritiesHash, rereadChanges } from "./data.ts";
import { guarded, refusal } from "./errors.ts";
import { withFreshBase } from "./freshBase.ts";
import { rereadingFile } from "./inboxUndo.ts";
import { notesRemoved, proposalAdded } from "./optimisticLists.ts";
import { TITLES } from "./QuickAdd.tsx";
import { currentEntry, navigate, selectOnArrival, useRepoPath } from "./routes.tsx";
import { changeEntry } from "./undo/changeEntry.ts";
import {
  InboxChangeView,
  PrioritiesChangeView,
  ProposalFileChangeView,
} from "./undo/changeViews.ts";
import { showPageError } from "./undo/pageErrors.ts";
import { quoted } from "./undo/quoted.ts";
import { useUndo } from "./undo/useUndo.ts";

/** A note, and its place: its category, none for the notes before the first, and its index in it. */
export type Placed = { category?: string; index: number; note: InboxNote };

type Fate = ReturnType<typeof useFateClient>;

/**
 * The inbox as a move of `placed` leaves it: fate's optimistic result, from the inbox the browser
 * holds, if it holds it.
 */
async function shownGone(fate: Fate, placed: Placed) {
  const now = await readInbox(fate, "cache-first").catch(() => undefined);
  const shown = now
    ? notesRemoved(now.categories, (note) => note.id === placed.note.id)
    : undefined;
  return shown ? { optimistic: shown } : {};
}

/**
 * Records the move of `placed` that answered `change` on the undo stack, as `label`: its undo puts
 * the note back in the inbox, selected there. With `file`, the proposal file it wrote, its undo
 * and redo read that file again too, for its editor: the stack's replay reads only the lists.
 */
function useRecordMove(placed: Placed) {
  const fate = useFateClient();
  const record = useUndo();
  return (change: UndoChange | null | undefined, label: string, file?: string) => {
    if (change) {
      const place = { path: "/inbox", select: placed.note.key };
      const entry = changeEntry(fate, change, label, place, placed.note.text);
      record(file === undefined ? entry : rereadingFile(fate, entry, file));
    }
  };
}

/** The change a write answered, as `changeEntry` takes it. */
type UndoChange = Parameters<typeof changeEntry>[1];

/**
 * The priorities just after a note moved into them. The move is written by then: a read that fails
 * only loses the row to select, so it gives nothing rather than a rejection nothing would catch.
 */
async function movedInto(fate: Fate) {
  try {
    return await readPriorities(fate);
  } catch {
    return undefined;
  }
}

/**
 * A note's change, run as `useNoteActions` runs it: its refusal shown, a conflict read again. With
 * `isAway`, for a change that left the inbox before it answered, the refusal shows in the page.
 */
type Run = <R extends { error?: unknown }>(call: () => Promise<R>, isAway?: boolean) => Promise<R>;

/** A proposal a note goes under: its id as written now, `now-2`, its key, and its text. */
export type UnderLine = { id: string; key: string; text: string };

/**
 * The moves out of the inbox, into the priorities, under one of their proposals, or into an
 * existing proposal file, over the note's `input`, its id and the inbox's hash as read. The inbox
 * shows no priorities: their hash is read just before the move. Each, once written, goes where the
 * note went: the priorities with its row selected, or the proposal file's page. A note with a note
 * file takes it along: the core moves it to the proposals, and its Undo moves it back.
 */
function useMovesOut(
  placed: Placed,
  input: { hash: string; note: string },
  run: Run,
  left: () => void,
) {
  const fate = useFateClient();
  const recordMove = useRecordMove(placed);
  const here = useRepoPath();

  // The priorities open at once, the note ending its section there as the core writes it, from the
  // priorities the browser holds, and its row is selected once the move answers with them. The
  // inbox follows by its live update.
  const toProposal = async (section: string) => {
    const now = await readPriorities(fate, "cache-first").catch(() => undefined);
    const moved = run(
      () =>
        withFreshBase(
          (mode) => readPrioritiesHash(fate, mode),
          (prioritiesHash) =>
            fate.mutations.inbox.toProposal({
              input: { ...input, prioritiesHash, section },
              ...(now
                ? { optimistic: proposalAdded(now.sections, section, placed.note.text) }
                : {}),
              view: PrioritiesChangeView,
            }),
        ),
      true,
    );
    navigate(here("/priorities"));
    const opened = currentEntry().id;
    const result = await moved;
    if (result.error) {
      return;
    }
    left();
    const proposalKey = result.result?.sections
      .find((s) => s.section === section)
      ?.proposals.at(-1)?.key;
    recordMove(result.result?.change, `Moved to ${TITLES.get(section)}`);
    if (proposalKey !== undefined) {
      selectOnArrival(opened, proposalKey);
    }
  };

  const underProposal = async (line: UnderLine) => {
    const shown = await shownGone(fate, placed);
    const result = await run(() =>
      withFreshBase(
        (mode) => readPrioritiesHash(fate, mode),
        (prioritiesHash) =>
          fate.mutations.inbox.underProposal({
            input: { ...input, prioritiesHash, proposal: line.id },
            ...shown,
            view: InboxChangeView,
          }),
      ),
    );
    if (result.error) {
      return;
    }
    left();
    // The note is the proposal's last own item now: its row, by its key.
    const now = await movedInto(fate);
    const children =
      now?.sections.flatMap((s) => s.proposals).find((proposal) => proposal.key === line.key)
        ?.children ?? [];
    const moved = children.findLast((child) => child.depth === 1)?.key;
    recordMove(result.result?.change, `Moved under ${quoted(line.text)}`);
    navigate(here("/priorities"), { select: moved ?? line.key });
  };

  return { toProposal, underProposal, ...useAddsIn(placed, input, run, left) };
}

/**
 * The adds of a note into a proposal's file, as `useMovesOut` runs its moves: an existing proposal
 * file, or the file a proposal without one gets for a note with a note file. Each, once written,
 * opens the file.
 */
function useAddsIn(
  placed: Placed,
  input: { hash: string; note: string },
  run: Run,
  left: () => void,
) {
  const fate = useFateClient();
  const recordMove = useRecordMove(placed);
  const here = useRepoPath();

  /**
   * Runs `call`, an add into the proposal file `file`, titled `title`, then records it on the undo
   * stack, whose undo takes the add back, and opens the file.
   */
  const landIn = async (
    call: () => Promise<{
      error?: unknown;
      result?: { change?: UndoChange | null; path?: string } | null;
    }>,
    file: string,
    title: string,
  ) => {
    const result = await run(call);
    if (result.error) {
      return;
    }
    const path = result.result?.path ?? file;
    recordMove(result.result?.change, `Added to ${quoted(title)}`, path);
    left();
    navigate(here(`/edit/${path}`));
  };

  // A note goes into the file's What; a note with a note file, its text into the file's Notes,
  // under the note's title, and its note file leaves. The server sends the file as written, at its
  // path now: a single file becomes a folder for the note file's images.
  const intoProposal = (file: string, title: string) =>
    landIn(
      () =>
        fate.mutations.inbox.intoProposal({
          input: { ...input, file },
          view: ProposalFileChangeView,
        }),
      file,
      title,
    );

  // A note with a note file into a proposal without a file: the proposal gets its file first, which
  // the server sends as written. Its Undo deletes that file and unlinks the line again.
  const intoProposalLine = (line: UnderLine) =>
    landIn(
      () =>
        withFreshBase(
          (mode) => readPrioritiesHash(fate, mode),
          (prioritiesHash) =>
            fate.mutations.inbox.intoProposalLine({
              input: { ...input, prioritiesHash, proposal: line.id },
              view: ProposalFileChangeView,
            }),
        ),
      "",
      line.text,
    );

  return { intoProposal, intoProposalLine };
}

/** Reads both files again once the note left the inbox, for the commit tab. */
function useLeave() {
  const fate = useFateClient();
  return () => rereadChanges(fate);
}

/**
 * The note's moves out of the inbox, over the inbox's hash as read. A refusal shows as `message`,
 * and a conflict reads the inbox and the priorities again.
 */
export function useNoteActions(placed: Placed, hash: string) {
  const fate = useFateClient();
  const [message, setMessage] = useState<string>();
  const input = { hash, note: placed.note.id };
  const left = useLeave();

  /** Runs a change: its refusal shows, and a conflict reads both files again. */
  const run: Run = async (call, isAway = false) => {
    setMessage(undefined);
    // A read before the write, or the request itself, that fails shows as a refusal: the actions
    // run unawaited, from a key or a picker, where nothing would catch a rejection.
    const result = await guarded(call);
    if (result.error) {
      const failed = refusal(result.error);
      if (isAway) {
        showPageError(failed.message);
      } else {
        setMessage(failed.message);
      }
      if (failed.kind === "conflict") {
        rereadChanges(fate);
      }
    }
    return result;
  };

  return { message, ...useMovesOut(placed, input, run, left) };
}
