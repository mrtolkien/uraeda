import { useState } from "react";
import { useFateClient } from "react-fate";
import type { SettledComment } from "uraeda-binding";
import type { useFile } from "./data.ts";
import { refusal } from "./errors.ts";
import {
  readUnsaved,
  renumberUnsaved,
  savedUnsaved,
  type Unsaved,
  unsavedKey,
} from "./fields/unsaved.ts";
import { useRepositoryPath } from "./routes.tsx";
import { FileView } from "./views.ts";

type File = NonNullable<ReturnType<typeof useFile>>;

/** The field keys of a round's settled comments: a new one on a subject, or comment `number`. */
export const newKey = (path: string, subject: string) => `${path}#settled:${subject}`;
export const editKey = (path: string, number: number) => `${path}#settled-edit:${number}`;

/**
 * Whether an edit kept for a comment's number is of that comment: one typed on another subject,
 * before a removal made elsewhere renumbered the comments, is not. Its text stays in the browser.
 */
export const editOf = (entry: Unsaved | undefined, comment: SettledComment) =>
  entry !== undefined && (entry.subject === undefined || entry.subject === comment.subject);

/**
 * The settled comments being written, by a form or by Submit: Submit waits for them before it
 * reads what is still unsaved, which a write in progress has not dropped yet.
 */
const writing = new Set<Promise<unknown>>();

/**
 * The writes of a round's settled comments: `add` and `edit` resolve with nothing once written,
 * their field's entry gone unless typed in since, after `onWritten`, or with the error to show; a
 * removal's error shows under its comment. An edit and a removal name the comment's subject,
 * refused when its number is now another's; a removal done, the edits kept for the comments after
 * it follow their new numbers, then `onRemoved`.
 */
export function useSettledWrites(
  file: File,
  onWritten: () => void,
  onRemoved: (number: number) => void = () => undefined,
) {
  const fate = useFateClient();
  const repo = useRepositoryPath();
  const [removal, setRemoval] = useState<{ message: string; number: number }>();
  /** Writes `text` from a field, `write` the mutation, known to Submit while it runs. */
  const written = (field: string, text: string, write: () => Promise<{ error?: unknown }>) => {
    const run = write().then((result) => {
      if (result.error) {
        return refusal(result.error).message;
      }
      savedUnsaved(unsavedKey(repo, field), text);
      onWritten();
      return undefined;
    });
    const done = () => writing.delete(run);
    writing.add(run);
    run.then(done, done);
    return run;
  };
  const add = (subject: string, text: string) =>
    written(newKey(file.path, subject), text, () =>
      fate.mutations.settled.comment({
        input: { folder: file.folder, subject, text },
        view: FileView,
      }),
    );
  /** Writes a comment's text over `previous`, its text as read, unless told otherwise. */
  const edit = (comment: SettledComment, text: string, previous = comment.text) =>
    written(editKey(file.path, comment.number), text, () =>
      fate.mutations.settled.edit({
        input: {
          folder: file.folder,
          number: comment.number,
          previous,
          subject: comment.subject,
          text,
        },
        view: FileView,
      }),
    );
  const remove = async (comment: SettledComment) => {
    setRemoval(undefined);
    const count = file.current.items.clarifications?.settledComments.length ?? 0;
    const result = await fate.mutations.settled.remove({
      input: {
        folder: file.folder,
        number: comment.number,
        previous: comment.text,
        subject: comment.subject,
      },
      view: FileView,
    });
    if (result.error) {
      setRemoval({ message: refusal(result.error).message, number: comment.number });
      return;
    }
    renumberUnsaved(
      (number) => unsavedKey(repo, editKey(file.path, number)),
      comment.number,
      count,
    );
    onRemoved(comment.number);
  };
  const removeError = (comment: SettledComment) =>
    removal?.number === comment.number ? removal.message : undefined;
  return { add, edit, remove, removeError };
}

/** What `useSettledWrites` returns. */
export type SettledWrites = ReturnType<typeof useSettledWrites>;

/**
 * Saves the settled comments typed and not saved, as Submit does before it submits, once the
 * writes in progress are done: each comment edited, then each new one, whose text the store keeps,
 * open or not, unless it is blank. An edit kept for a comment of another subject is not saved, and
 * an edit is written over the comment's text when it began, refused when it changed since. Text
 * typed while it is saved stays unsaved. Resolves with whether every one was written, stopping at
 * the first refused.
 */
export function useSaveSettled(file: File) {
  const repo = useRepositoryPath();
  const writes = useSettledWrites(file, () => undefined);
  /** The entry kept for a field, unless its text is blank. */
  const typed = (field: string) => {
    const entry = readUnsaved(unsavedKey(repo, field));
    return entry?.text.trim() ? entry : undefined;
  };
  return async () => {
    await Promise.allSettled(writing);
    const round = file.current.items.clarifications;
    const saves = [
      ...(round?.settledComments ?? []).map((comment) => {
        const kept = typed(editKey(file.path, comment.number));
        return {
          kept: editOf(kept, comment) ? kept : undefined,
          write: (text: string) => writes.edit(comment, text, kept?.base),
        };
      }),
      // A subject used twice is one field, for its first point.
      ...[...new Set((round?.settledPoints ?? []).map((point) => point.subject))].map(
        (subject) => ({
          kept: typed(newKey(file.path, subject)),
          write: (text: string) => writes.add(subject, text),
        }),
      ),
    ];
    for (const { kept, write } of saves) {
      if (kept && (await write(kept.text)) !== undefined) {
        return false;
      }
    }
    return true;
  };
}
