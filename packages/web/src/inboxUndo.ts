// The inbox's entries on the undo stack: what each of its writes is called, and where it happened,
// from the inbox as the write found it, made into an entry from the change the write answered. A
// row's moves, an indent, a drag, or a move to a category, are moves of the list "inbox", which a
// run of them joins into one step.
import type { useFateClient } from "react-fate";
import type { ChangeView } from "uraeda-binding";
import { rereadProposalFile } from "./attach/useEditorImages.ts";
import type { Inbox } from "./inboxPanes.ts";
import { plain } from "./Spans.tsx";
import { changeEntry, joinChanges } from "./undo/changeEntry.ts";
import { quoted } from "./undo/quoted.ts";
import type { UndoEntry } from "./undo/stack.ts";

type Fate = ReturnType<typeof useFateClient>;

/**
 * What a write of the inbox records: its label, the name its refusal gives, the row to select
 * where it happened, and whether it is a move, which joins a run of moves and shows no toast.
 */
export type InboxWrite = { label: string; move?: boolean; select?: string; subject: string };

export { quoted } from "./undo/quoted.ts";

/** What a move of the row `row` records: "Moved “Idea two”", the row selected where it was. */
export function movedWrite(row: { key: string; text: string }): InboxWrite {
  return { label: `Moved ${quoted(row.text)}`, move: true, select: row.key, subject: row.text };
}

/** The note `id` of `now`, or with `at` its nested row at `at`: its key and its text, plain. */
export function rowOfNote(now: Pick<Inbox, "categories">, id: string, at?: number) {
  const note = now.categories.flatMap((category) => category.notes).find((one) => one.id === id);
  const row = at === undefined ? note : note?.children[at];
  return row && { key: row.key, text: plain(row.spans) };
}

/**
 * What an outline edit `kind` of the note `id`, or of its nested row `at`, records, from the inbox
 * `now` it is written over: an add, an edit, or a delete, named by its text; an indent, an outdent,
 * or a move up or down, a move.
 */
export function outlineWrite(
  now: Pick<Inbox, "categories">,
  id: string,
  at: number | undefined,
  kind: string,
  text: string | undefined,
): InboxWrite | undefined {
  const row = rowOfNote(now, id, at);
  if (kind.startsWith("insert-") || kind === "append-child") {
    return text === undefined ? undefined : { label: `Added ${quoted(text)}`, subject: text };
  }
  if (!row) {
    return undefined;
  }
  if (kind === "edit") {
    const edited = text ?? row.text;
    return { label: `Edited ${quoted(edited)}`, select: row.key, subject: edited };
  }
  if (kind === "remove") {
    return { label: `Deleted ${quoted(row.text)}`, select: row.key, subject: row.text };
  }
  return movedWrite(row);
}

/** Each move's entry's change and write, which a run's join takes. */
const moves = new WeakMap<UndoEntry, { change: ChangeView; write: InboxWrite }>();

/**
 * The entry of a write of the inbox of the repository `repo` that answered `change`, at `/inbox`. A
 * move joins the run of moves of the inbox on top: the run is named and placed as its first move,
 * its change from before the first to after the last.
 */
export function inboxEntry(
  fate: Fate,
  change: ChangeView,
  write: InboxWrite,
  repo: string,
): UndoEntry {
  const place = {
    path: "/inbox",
    repo,
    ...(write.select === undefined ? {} : { select: write.select }),
  };
  const entry = changeEntry(fate, change, write.label, place, write.subject);
  if (!write.move) {
    return entry;
  }
  const moved: UndoEntry = {
    ...entry,
    move: {
      join: (earlier) => {
        const first = moves.get(earlier);
        return first
          ? inboxEntry(fate, joinChanges(first.change, change), first.write, repo)
          : moved;
      },
      list: "inbox",
    },
  };
  moves.set(moved, { change, write });
  return moved;
}

/**
 * `entry`, whose undo and redo also read the note file `file` again, for an editor open on it: the
 * stack's replay reads only the lists.
 */
export function rereadingFile(fate: Fate, entry: UndoEntry, file: string): UndoEntry {
  const reread = (replay: () => Promise<string | undefined>) => async () => {
    const refused = await replay();
    await rereadProposalFile(fate, file);
    return refused;
  };
  return { ...entry, redo: reread(entry.redo), undo: reread(entry.undo) };
}
