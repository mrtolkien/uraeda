// What a note's view does to its note: edit its text, move it to a category, into the priorities
// or a draft, or delete it, each written at once over the inbox as read, with a toast and Undo.
import { useState } from "react";
import { useFateClient } from "react-fate";
import type { InboxNote } from "uraeda-binding";
import {
  readDraftText,
  readInbox,
  readPriorities,
  readPrioritiesHash,
  rereadChanges,
} from "./data.ts";
import { refusal } from "./errors.ts";
import { useUndoToast } from "./layout/useUndoToast.ts";
import { TITLES } from "./QuickAdd.tsx";
import { navigate, redirect, useRepoPath } from "./routes.tsx";
import { DraftView, InboxView, PrioritiesView } from "./views.ts";

/** A note, and its place: its category, none for the notes before the first, and its index in it. */
export type Placed = { category?: string; index: number; note: InboxNote };

type Fate = ReturnType<typeof useFateClient>;

/** A category's name as the page shows it. */
export function categoryName(category: string | undefined) {
  return category ?? "No category";
}

/** A note's lines, as one text: what tells two notes apart. */
const linesOf = (note: InboxNote) => note.lines.join("\n");

/**
 * Writes a note's lines back at its place, over the inbox as it is now: the Undo of a change that
 * took it out of the inbox. Resolves with the refusal, if any.
 */
async function putBack(fate: Fate, { category, index, note }: Placed) {
  const now = await readInbox(fate);
  const result = await fate.mutations.inbox.insert({
    input: {
      hash: now.hash,
      index,
      lines: note.lines,
      ...(category === undefined ? {} : { category }),
    },
    view: InboxView,
  });
  return result.error ? refusal(result.error).message : undefined;
}

/**
 * The Undo of a move to another category: the note, found by its lines, its key first, goes back
 * to its place, or the Undo is refused once the note changed or left the inbox.
 */
async function moveBack(fate: Fate, placed: Placed) {
  const { note } = placed;
  const now = await readInbox(fate);
  const same = now.categories
    .flatMap((c) => c.notes)
    .filter((one) => linesOf(one) === linesOf(note));
  const found = same.find((one) => one.key === note.key) ?? (same.length === 1 ? same[0] : null);
  if (!found) {
    return `Could not undo: "${note.text}" is no longer in INBOX.md.`;
  }
  const removed = await fate.mutations.inbox.remove({
    input: { hash: now.hash, note: found.id },
    view: InboxView,
  });
  return removed.error ? refusal(removed.error).message : putBack(fate, placed);
}

/**
 * The Undo of a move into a priorities section: the note goes back to its place, then the line
 * the move added, the section's last of the same text, leaves the section, whose file the first
 * write left as it was. Refused, with nothing
 * written, once that line is gone.
 */
async function takeBackFromPriorities(fate: Fate, placed: Placed, section: string) {
  const now = await readPriorities(fate);
  const entries = now.sections.find((s) => s.section === section)?.entries ?? [];
  const entry = entries.findLast((e) => e.text === placed.note.text);
  if (!entry) {
    return `Could not undo: "${placed.note.text}" is no longer in PRIORITIES.md.`;
  }
  const failed = await putBack(fate, placed);
  if (failed) {
    return failed;
  }
  const removed = await fate.mutations.priorities.remove({
    input: { entry: entry.id, hash: now.hash },
    view: PrioritiesView,
  });
  rereadChanges(fate);
  return removed.error ? refusal(removed.error).message : undefined;
}

/**
 * The Undo of an add to a draft: the draft's text before the move is written back, over its text
 * just after it, so an edit made since refuses it; then the note goes back to its place.
 */
async function takeBackFromDraft(
  fate: Fate,
  placed: Placed,
  draft: { after: string; before: string; path: string },
) {
  const restored = await fate.mutations.text.save({
    input: { hash: draft.after, path: draft.path, text: draft.before },
    view: DraftView,
  });
  if (restored.error) {
    return refusal(restored.error).message;
  }
  const failed = await putBack(fate, placed);
  rereadChanges(fate);
  return failed;
}

/** A note's change, run as `useNoteActions` runs it: its refusal shown, a conflict read again. */
type Run = <R extends { error?: unknown }>(call: () => Promise<R>) => Promise<R>;

/**
 * The moves out of the inbox, into the priorities, a new draft, or an existing draft, over the
 * note's `input`, its id and the inbox's hash as read. `left` follows a move that leaves the note's
 * view; a new draft opens in the editor instead.
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
    if (!result.error) {
      toast(`Moved to ${TITLES.get(section)}, not committed`, () =>
        takeBackFromPriorities(fate, placed, section),
      );
      left();
    }
  };

  const toNewDraft = async (section: string) => {
    const prioritiesHash = await readPrioritiesHash(fate);
    const result = await run(() =>
      fate.mutations.inbox.toNewDraft({
        input: { ...input, prioritiesHash, section },
        view: DraftView,
      }),
    );
    const path = (result as { result?: { path?: unknown } }).result?.path;
    if (!result.error && typeof path === "string") {
      rereadChanges(fate);
      navigate(here(`/edit/${path}`));
    }
  };

  const toDraft = async (path: string, title: string) => {
    const before = await readDraftText(fate, path);
    const result = await run(() =>
      fate.mutations.inbox.toDraft({ input: { ...input, draft: path }, view: InboxView }),
    );
    if (!result.error) {
      const after = (await readDraftText(fate, path)).hash;
      toast(`Added to ${title}, not committed`, () =>
        takeBackFromDraft(fate, placed, { after, before: before.text, path }),
      );
      left();
    }
  };

  return { toDraft, toNewDraft, toPriorities };
}

/**
 * The note's actions, over the inbox's hash as read. A refusal shows as `message`, and a conflict
 * reads the inbox and the priorities again. A move out of the inbox returns to it. `onRenaming`
 * holds the note's id while its text, and so its key, changes.
 */
export function useNoteActions(
  placed: Placed,
  hash: string,
  onRenaming: (id: string | undefined) => void,
) {
  const fate = useFateClient();
  const toast = useUndoToast();
  const here = useRepoPath();
  const [message, setMessage] = useState<string>();
  const { note } = placed;
  const input = { hash, note: note.id };

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

  /** Once the note left the inbox, the inbox shows, and the commit bar counts the other file. */
  const left = () => {
    rereadChanges(fate);
    redirect(here("/inbox"));
  };

  const edit = async (text: string) => {
    onRenaming(note.id);
    const result = await fate.mutations.inbox.edit({ input: { ...input, text }, view: InboxView });
    if (result.error) {
      onRenaming(undefined);
      return refusal(result.error).message;
    }
    const key = result.result?.categories
      .flatMap((c) => c.notes)
      .find((one) => one.id === note.id)?.key;
    if (key && key !== note.key) {
      redirect(here(`/inbox/${key}`));
    }
    return undefined;
  };

  const toCategory = async (category: string | undefined) => {
    const result = await run(() =>
      fate.mutations.inbox.category({
        input: { ...input, ...(category === undefined ? {} : { category }) },
        view: InboxView,
      }),
    );
    if (!result.error) {
      toast(`Moved to ${categoryName(category)}, not committed`, () => moveBack(fate, placed));
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
