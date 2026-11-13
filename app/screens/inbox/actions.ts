// What the inbox does to a note: each write over the inbox as read, its refusal said where it was
// asked, and an undoable one kept on the app's undo stack (`app/screens/shell/undoStack.ts`), whose
// toast says what was done, where the note went, and Undo. An undoable action never asks first
// (the undo decision): Undo is the way back.
import { call, type Route } from "../../store";
import type { Inbox, UndoChange } from "../../store/protocol";
import { remember } from "../shell/undoStack";
import { quoted } from "./model";

/** Deletes a note, its sub-items, and its note file: undone by Undo, never asked first. */
export async function deleteNote(repo: string, inbox: Inbox, note: { id: string; text: string }) {
  const written = await call("inbox.remove", { hash: inbox.hash, note: note.id, repo });
  remember(written.change, `Deleted ${quoted(note.text)}.`, { repo, subject: note.text });
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
  remember(written.change, `Moved ${quoted(note.text)} to ${where}.`, {
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
  const went: { label: string; to: Route } = {
    label: "Open the priorities",
    to: { page: "priorities", repo },
  };
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
  const into = to.kind === "line" || to.kind === "file" ? "to" : "into";
  remember(change, `Moved ${quoted(note.text)} ${into} ${to.title}.`, {
    repo,
    subject: note.text,
    went,
  });
}
