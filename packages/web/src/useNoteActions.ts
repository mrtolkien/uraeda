// What the promote picker does to a note: move it into the priorities, under one of their
// proposals, or into a proposal file, each written at once over the inbox as read, with a toast
// and Undo.
// Each Undo of a move is one call to the core, which changes both files or neither.
import { useState } from "react";
import { useFateClient } from "react-fate";
import type { InboxNote } from "uraeda-binding";
import { readInbox, readPriorities, readPrioritiesHash, rereadChanges } from "./data.ts";
import { guarded, refusal } from "./errors.ts";
import { withFreshBase } from "./freshBase.ts";
import { showPageError, useUndoToast } from "./layout/useUndoToast.ts";
import { notePutBack, notesRemoved, proposalAdded } from "./optimisticLists.ts";
import { TITLES } from "./QuickAdd.tsx";
import { currentEntry, navigate, selectOnArrival, useRepoPath } from "./routes.tsx";
import { InboxView, PrioritiesView, ProposalFileView } from "./views.ts";

/** A note, and its place: its category, none for the notes before the first, and its index in it. */
export type Placed = { category?: string; index: number; note: InboxNote };

type Fate = ReturnType<typeof useFateClient>;

/** A note's lines as written, and its place, which an Undo puts it back to. */
function at({ category, index, note }: Placed) {
  return { index, lines: note.lines, ...(category === undefined ? {} : { category }) };
}

/**
 * The inbox as a move of `placed` leaves it, `gone`, or as its Undo does, its note back: fate's
 * optimistic result, from the inbox the browser holds, if it holds it.
 */
async function shownAs(fate: Fate, placed: Placed, gone: boolean) {
  const now = await readInbox(fate, "cache-first").catch(() => undefined);
  const shown = now
    ? gone
      ? notesRemoved(now.categories, (note) => note.id === placed.note.id)
      : notePutBack(now, placed)
    : undefined;
  return shown ? { optimistic: shown } : {};
}

/** An Undo's write: its refusal, if any, once both files are read again for the commit tab. */
async function undone(fate: Fate, call: Promise<{ error?: unknown }>) {
  const result = await call;
  rereadChanges(fate);
  return result.error ? refusal(result.error).message : undefined;
}

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

/** A proposal's first words: a toast is no place for a whole line. */
function shortened(text: string) {
  return text.length > 40 ? `${text.slice(0, 39).trimEnd()}…` : text;
}

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
  const toast = useUndoToast();
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
              view: PrioritiesView,
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
    toast(`Moved to ${TITLES.get(section)}, not committed`, async () =>
      undone(
        fate,
        fate.mutations.inbox.undoToProposal({
          input: { ...at(placed), section, ...(proposalKey === undefined ? {} : { proposalKey }) },
          ...(await shownAs(fate, placed, false)),
          view: InboxView,
        }),
      ),
    );
    if (proposalKey !== undefined) {
      selectOnArrival(opened, proposalKey);
    }
  };

  const underProposal = async (line: UnderLine) => {
    const shown = await shownAs(fate, placed, true);
    const result = await run(() =>
      withFreshBase(
        (mode) => readPrioritiesHash(fate, mode),
        (prioritiesHash) =>
          fate.mutations.inbox.underProposal({
            input: { ...input, prioritiesHash, proposal: line.id },
            ...shown,
            view: InboxView,
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
    toast(`Moved under "${shortened(line.text)}", not committed`, async () =>
      undone(
        fate,
        fate.mutations.inbox.undoUnderProposal({
          input: { ...at(placed), proposalKey: line.key },
          ...(await shownAs(fate, placed, false)),
          view: InboxView,
        }),
      ),
    );
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
  const toast = useUndoToast();
  const here = useRepoPath();

  /**
   * Runs `call`, an add into the proposal file `file`, titled `title`, then shows its toast, whose
   * Undo takes the add back from the file at its path now, and opens the file.
   */
  const landIn = async (
    call: () => Promise<{ error?: unknown; result?: unknown }>,
    file: string,
    title: string,
  ) => {
    const result = await run(call);
    if (result.error) {
      return;
    }
    const path = (result.result as { path?: string } | undefined)?.path ?? file;
    toast(`Added to ${shortened(title)}, not committed`, async () =>
      undone(
        fate,
        fate.mutations.inbox.undoIntoProposal({
          input: { ...at(placed), file: path },
          ...(await shownAs(fate, placed, false)),
          view: InboxView,
        }),
      ),
    );
    left();
    navigate(here(`/edit/${path}`));
  };

  // A note goes into the file's What; a note with a note file, its text into the file's Notes,
  // under the note's title, and its note file leaves. The server sends the file as written, at its
  // path now: a single file becomes a folder for the note file's images.
  const intoProposal = (file: string, title: string) =>
    landIn(
      () =>
        fate.mutations.inbox.intoProposal({ input: { ...input, file }, view: ProposalFileView }),
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
              view: ProposalFileView,
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
