// What a note's view does to its note: edit its text, move it to a category, into the priorities
// or a draft, or delete it, each written at once over the inbox as read, with a toast and Undo.
// Each Undo of a move is one call to the core, which changes both files or neither.
import { useState } from "react";
import { useFateClient } from "react-fate";
import type { InboxNote } from "uraeda-binding";
import { readInbox, readPriorities, readPrioritiesHash, rereadChanges } from "./data.ts";
import { refusal } from "./errors.ts";
import { useUndoToast } from "./layout/useUndoToast.ts";
import { TITLES } from "./QuickAdd.tsx";
import { currentEntry, localPath, navigate, redirect, useRepoPath } from "./routes.tsx";
import { DraftView, InboxView } from "./views.ts";

/** A note, and its place: its category, none for the notes before the first, and its index in it. */
export type Placed = { category?: string; index: number; note: InboxNote };

/** The note's id while its text is saved, and that text: see `NotePane`. */
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
 * The key of the line a move just wrote at the end of a section: the last of the note's text. An
 * Undo tells it by that key from a line of the same text the human writes later.
 */
async function movedKey(fate: Fate, section: string, text: string) {
  const now = await readPriorities(fate);
  const entries = now.sections.find((s) => s.section === section)?.entries ?? [];
  return entries.findLast((entry) => entry.text === text)?.key;
}

/** A note's change, run as `useNoteActions` runs it: its refusal shown, a conflict read again. */
type Run = <R extends { error?: unknown }>(call: () => Promise<R>) => Promise<R>;

/**
 * The moves out of the inbox, into the priorities, a new draft, or an existing draft, over the
 * note's `input`, its id and the inbox's hash as read. The view shows no priorities: their hash is
 * read just before the move. `left` follows a move that leaves the note's view; a new draft opens
 * in the editor instead.
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

  const toPriorities = async (section: string) => {
    const prioritiesHash = await readPrioritiesHash(fate);
    const result = await run(() =>
      fate.mutations.inbox.toPriorities({
        input: { ...input, prioritiesHash, section },
        view: InboxView,
      }),
    );
    if (result.error) {
      return;
    }
    left();
    const entryKey = await movedKey(fate, section, placed.note.text);
    toast(`Moved to ${TITLES.get(section)}, not committed`, () =>
      undone(
        fate,
        fate.mutations.inbox.undoToPriorities({
          input: { ...at(placed), section, ...(entryKey === undefined ? {} : { entryKey }) },
          view: InboxView,
        }),
      ),
    );
  };

  const toNewDraft = async (section: string) => {
    const prioritiesHash = await readPrioritiesHash(fate);
    const result = await run(() =>
      fate.mutations.inbox.toNewDraft({
        input: { ...input, prioritiesHash, section },
        view: DraftView,
      }),
    );
    const path = result.result?.path;
    if (!result.error && path !== undefined) {
      rereadChanges(fate);
      navigate(here(`/edit/${path}`));
    }
  };

  const toDraft = async (draft: string, title: string) => {
    const result = await run(() =>
      fate.mutations.inbox.toDraft({ input: { ...input, draft }, view: InboxView }),
    );
    if (!result.error) {
      toast(`Added to ${title}, not committed`, () =>
        undone(
          fate,
          fate.mutations.inbox.undoToDraft({ input: { ...at(placed), draft }, view: InboxView }),
        ),
      );
      left();
    }
  };

  return { toDraft, toNewDraft, toPriorities };
}

/**
 * Back to the inbox once the note left it, only while its view is still shown: Back, to the list
 * it was opened from, so the history holds the list once; otherwise the list in its place.
 */
function useLeave(key: string) {
  const fate = useFateClient();
  const here = useRepoPath();
  return () => {
    rereadChanges(fate);
    if (localPath(window.location.pathname) !== `/inbox/${key}`) {
      return;
    }
    if (currentEntry().from === "/inbox") {
      window.history.back();
    } else {
      redirect(here("/inbox"));
    }
  };
}

/**
 * The note's actions, over the inbox's hash as read. A refusal shows as `message`, or under the
 * field for an edit, and a conflict reads the inbox and the priorities again. A move out of the
 * inbox returns to it. `onRenaming` holds the note's id and new text while its text, and so its
 * key, changes.
 */
export function useNoteActions(
  placed: Placed,
  hash: string,
  onRenaming: (renaming: Renaming | undefined) => void,
) {
  const fate = useFateClient();
  const toast = useUndoToast();
  const here = useRepoPath();
  const [message, setMessage] = useState<string>();
  const { note } = placed;
  const input = { hash, note: note.id };
  const left = useLeave(note.key);

  /** Runs a change: its refusal shows, and a conflict reads both files again. */
  const run: Run = async (call) => {
    setMessage(undefined);
    const result = await call();
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
    if (key && key !== note.key) {
      redirect(here(`/inbox/${key}`));
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
