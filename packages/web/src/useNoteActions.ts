// What a note's view does to its note: edit its text, move it to a category, into the priorities
// or a proposal file, or delete it, each written at once over the inbox as read, with a toast and
// Undo.
// Each Undo of a move is one call to the core, which changes both files or neither.
import { useState } from "react";
import { useFateClient } from "react-fate";
import type { InboxNote } from "uraeda-binding";
import { readInbox, readPriorities, readPrioritiesHash, rereadChanges } from "./data.ts";
import { guarded, refusal } from "./errors.ts";
import { useUndoToast } from "./layout/useUndoToast.ts";
import { TITLES } from "./QuickAdd.tsx";
import type { ActionOptions } from "./pane/useProposalActions.ts";
import { navigate, redirect, useRepoPath } from "./routes.tsx";
import { InboxView, ProposalFileView } from "./views.ts";

/** A note, and its place: its category, none for the notes before the first, and its index in it. */
export type Placed = { category?: string; index: number; note: InboxNote };

/** The note's id while its text is saved, and that text. */
export type Renaming = { id: string; text: string };

type Fate = ReturnType<typeof useFateClient>;

/** A category's name as the page shows it. */
export function categoryName(category: string | undefined) {
  return category ?? "No category";
}

/** A note's lines as written, and its place, which an Undo puts it back to. */
function at({ category, index, note }: Placed) {
  return { index, lines: note.lines, ...(category === undefined ? {} : { category }) };
}

/** An Undo's write: its refusal, if any, once both files are read again for the commit bar. */
async function undone(fate: Fate, call: Promise<{ error?: unknown }>) {
  const result = await call;
  rereadChanges(fate);
  return result.error ? refusal(result.error).message : undefined;
}

/** The Undo of a Delete: the note's lines go back to its place, over the inbox as it is now. */
async function putBack(fate: Fate, placed: Placed) {
  const now = await readInbox(fate);
  return undone(
    fate,
    fate.mutations.inbox.insert({ input: { hash: now.hash, ...at(placed) }, view: InboxView }),
  );
}

/**
 * The key of the proposal a move just wrote at the end of a section: the last of the note's text.
 * An Undo tells it by that key from a proposal of the same text the human writes later.
 */
async function movedKey(fate: Fate, section: string, text: string) {
  const now = await movedInto(fate);
  const proposals = now?.sections.find((s) => s.section === section)?.proposals ?? [];
  return proposals.findLast((proposal) => proposal.text === text)?.key;
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

/** A note's change, run as `useNoteActions` runs it: its refusal shown, a conflict read again. */
type Run = <R extends { error?: unknown }>(call: () => Promise<R>) => Promise<R>;

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

  const toProposal = async (section: string) => {
    const result = await run(async () =>
      fate.mutations.inbox.toProposal({
        input: { ...input, prioritiesHash: await readPrioritiesHash(fate), section },
        view: InboxView,
      }),
    );
    if (result.error) {
      return;
    }
    left();
    const proposalKey = await movedKey(fate, section, placed.note.text);
    toast(`Moved to ${TITLES.get(section)}, not committed`, () =>
      undone(
        fate,
        fate.mutations.inbox.undoToProposal({
          input: { ...at(placed), section, ...(proposalKey === undefined ? {} : { proposalKey }) },
          view: InboxView,
        }),
      ),
    );
    navigate(here("/priorities"), proposalKey === undefined ? {} : { select: proposalKey });
  };

  const underProposal = async (line: UnderLine) => {
    const result = await run(async () =>
      fate.mutations.inbox.underProposal({
        input: { ...input, prioritiesHash: await readPrioritiesHash(fate), proposal: line.id },
        view: InboxView,
      }),
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
    // The proposal's first words: a toast is no place for a whole line.
    const name = line.text.length > 40 ? `${line.text.slice(0, 39).trimEnd()}…` : line.text;
    toast(`Moved under "${name}", not committed`, () =>
      undone(
        fate,
        fate.mutations.inbox.undoUnderProposal({
          input: { ...at(placed), proposalKey: line.key },
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
    toast(`Added to ${title}, not committed`, () =>
      undone(
        fate,
        fate.mutations.inbox.undoIntoProposal({
          input: { ...at(placed), file: path },
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
      async () =>
        fate.mutations.inbox.intoProposalLine({
          input: { ...input, prioritiesHash: await readPrioritiesHash(fate), proposal: line.id },
          view: ProposalFileView,
        }),
      "",
      line.text,
    );

  return { intoProposal, intoProposalLine };
}

/** Reads both files again once the note left the inbox, for the commit bar. */
function useLeave() {
  const fate = useFateClient();
  return () => rereadChanges(fate);
}

/**
 * The note's actions, over the inbox's hash as read. A refusal shows as `message`, or under the
 * field for an edit, and a conflict reads the inbox and the priorities again. A move out of the
 * inbox returns to it. `onRenaming` holds the note's id and new text while its text, and so its
 * key, changes. An edit that changes the note's key follows it to its new address, unless
 * `redirects` is `false`, as for an editor in a card of a list, which leaves the page as it is.
 * `onRenamed` gets the note's new key once an edit is saved.
 */
export function useNoteActions(
  placed: Placed,
  hash: string,
  onRenaming: (renaming: Renaming | undefined) => void,
  { onRenamed, redirects = true }: ActionOptions = {},
) {
  const fate = useFateClient();
  const toast = useUndoToast();
  const here = useRepoPath();
  const [message, setMessage] = useState<string>();
  const { note } = placed;
  const input = { hash, note: note.id };
  const left = useLeave();

  /** Runs a change: its refusal shows, and a conflict reads both files again. */
  const run: Run = async (call) => {
    setMessage(undefined);
    // A read before the write, or the request itself, that fails shows as a refusal: the actions
    // run unawaited, from a key or a picker, where nothing would catch a rejection.
    const result = await guarded(call);
    if (result.error) {
      const failed = refusal(result.error);
      setMessage(failed.message);
      if (failed.kind === "conflict") {
        rereadChanges(fate);
      }
    }
    return result;
  };

  const edit = async (text: string) => {
    onRenaming({ id: note.id, text });
    const result = await fate.mutations.inbox.edit({ input: { ...input, text }, view: InboxView });
    if (result.error) {
      onRenaming(undefined);
      const failed = refusal(result.error);
      if (failed.kind === "conflict") {
        rereadChanges(fate);
      }
      return failed.message;
    }
    const key = result.result?.categories
      .flatMap((c) => c.notes)
      .find((one) => one.id === note.id)?.key;
    if (key !== undefined) {
      onRenamed?.(key);
      if (redirects && key !== note.key) {
        redirect(here(`/inbox/${key}`));
      }
    }
    onRenaming(undefined);
    return undefined;
  };

  /**
   * Keeps the view on its note once a move put it at the end of a category, `notes`: its key may
   * have changed, as keys of the same text are numbered in file order. Back to the list without it.
   */
  const follow = (notes: ReadonlyArray<InboxNote> | undefined) => {
    const same = (one: InboxNote) =>
      one.lines.length === note.lines.length && one.lines.every((l, i) => l === note.lines[i]);
    const moved = notes?.findLast(same);
    if (!moved) {
      left();
    } else if (moved.key !== note.key) {
      redirect(here(`/inbox/${moved.key}`));
    }
  };

  const toCategory = async (category: string | undefined) => {
    const result = await run(() =>
      fate.mutations.inbox.category({
        input: { ...input, ...(category === undefined ? {} : { category }) },
        view: InboxView,
      }),
    );
    if (!result.error) {
      follow(result.result?.categories.find((c) => c.name === category)?.notes);
      toast(`Moved to ${categoryName(category)}, not committed`, () =>
        undone(fate, fate.mutations.inbox.undoCategory({ input: at(placed), view: InboxView })),
      );
    }
  };

  const remove = async () => {
    const result = await run(() => fate.mutations.inbox.remove({ input, view: InboxView }));
    if (!result.error) {
      toast("Deleted, not committed", () => putBack(fate, placed));
      left();
    }
  };

  return { edit, message, remove, toCategory, ...useMovesOut(placed, input, run, left) };
}
