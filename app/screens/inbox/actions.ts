// What the inbox does to a note: each write over the inbox as read, its refusal said where it was
// asked, and an undoable one kept as the inbox's last action, which its banner offers to undo. An
// undoable action never asks first (the undo decision): Undo is the way back.
//
// TASK 50: the app's undo stack replaces `lastDone`: the inbox then records each change there,
// and its banner and `u` go to the shell's.
import { signal } from "nsh";
import { call, type Route } from "../../store";
import type { Inbox, UndoChange } from "../../store/protocol";
import { quoted } from "./model";

/** An action the inbox's banner says, with its undo, and where its note went. */
export type Done = {
  change: UndoChange;
  /** What happened, in words: "Deleted “…”." */
  label: string;
  repo: string;
  /** The note's text, which an undo names. */
  subject: string;
  /** Where the note went, when it left the inbox: the way to it. */
  went?: { label: string; to: Route };
};

/** The inbox's last undoable action, until another, or its undo. */
export const lastDone = signal<Done | null>(null);

/** Why an undo did not run, under its banner. */
export const undoRefusal = signal<string | null>(null);

/** Keeps an action's change as the last action, when it made one. */
export function remember(done: Omit<Done, "change"> & { change: UndoChange | null | undefined }) {
  if (done.change == null) return;
  lastDone.set({ ...done, change: done.change });
  undoRefusal.set(null);
}

/** Undoes the last action: its banner goes, or says why it could not. */
export async function undoLast() {
  const done = lastDone();
  if (done === null) return;
  try {
    await call("undo.apply", {
      change: done.change,
      direction: "undo",
      repo: done.repo,
      subject: done.subject,
    });
    lastDone.set(null);
    undoRefusal.set(null);
  } catch (error) {
    undoRefusal.set((error as Error).message);
  }
}

/** Deletes a note, its sub-items, and its note file: undone by Undo, never asked first. */
export async function deleteNote(repo: string, inbox: Inbox, note: { id: string; text: string }) {
  const written = await call("inbox.remove", { hash: inbox.hash, note: note.id, repo });
  remember({
    change: written.change,
    label: `Deleted ${quoted(note.text)}.`,
    repo,
    subject: note.text,
  });
}

/** Moves a note to the end of a category, `null` for the notes without one. */
export async function moveNote(
  repo: string,
  inbox: Inbox,
  note: { id: string; text: string },
  category: string | null,
) {
  const written = await call("inbox.category", {
    category,
    hash: inbox.hash,
    note: note.id,
    repo,
  });
  const where = category ?? "No category";
  remember({
    change: written.change,
    label: `Moved ${quoted(note.text)} to ${where}.`,
    repo,
    subject: note.text,
  });
}

/** Where a note goes up to, out of the inbox: a picker's row. */
export type Promotion =
  | { kind: "line" | "file"; section: string; title: string }
  | { kind: "under"; proposal: string; title: string }
  | { kind: "into"; file: string; title: string };

/** Moves a note out of the inbox, into the priorities or a proposal file. */
export async function promote(
  repo: string,
  inbox: Inbox,
  note: { id: string; text: string },
  to: Promotion,
  /** The priorities' hash as the picker read them. */
  prioritiesHash: string,
) {
  const base = { hash: inbox.hash, note: note.id, repo };
  const went: Done["went"] = { label: "Open the priorities", to: { page: "priorities", repo } };
  let change: UndoChange | null;
  switch (to.kind) {
    case "line":
      ({ change } = await call("inbox.toProposal", {
        ...base,
        prioritiesHash,
        section: to.section,
      }));
      break;
    case "file":
      ({ change } = await call("inbox.toProposalFile", {
        ...base,
        prioritiesHash,
        section: to.section,
      }));
      break;
    case "under":
      ({ change } = await call("inbox.underProposal", {
        ...base,
        prioritiesHash,
        proposal: to.proposal,
      }));
      break;
    case "into": {
      const written = await call("inbox.intoProposal", { ...base, file: to.file });
      change = written.change;
      went.label = "Open the proposal file";
      went.to = { page: "edit", path: written.path, repo };
      break;
    }
  }
  remember({
    change,
    label: `Moved ${quoted(note.text)} ${to.kind === "line" || to.kind === "file" ? "to" : "into"} ${to.title}.`,
    repo,
    subject: note.text,
    went,
  });
}
