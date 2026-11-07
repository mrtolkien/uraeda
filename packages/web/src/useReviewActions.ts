import { startTransition, useOptimistic } from "react";
import { useFateClient } from "react-fate";
import type { CommentItem } from "uraeda-binding";
import { decisionOf, type Range } from "./commentRange.ts";
import type { useFile } from "./data.ts";
import { refusal } from "./errors.ts";
import { renumberUnsaved, unsavedKey } from "./fields/unsaved.ts";
import { useUndoToast } from "./layout/useUndoToast.ts";
import { placeOf, reviewEditKey } from "./reviewField.ts";
import { quoteOfRange } from "./reviewQuote.ts";
import { useRepositoryPath } from "./routes.tsx";
import type { useRefusals } from "./ReviewVerdict.tsx";
import type { useCommentDraft } from "./useCommentDraft.ts";
import { FileView } from "./views.ts";

type File = NonNullable<ReturnType<typeof useFile>>;
type Draft = ReturnType<typeof useCommentDraft>;
type Refusals = ReturnType<typeof useRefusals>;

/** A new comment being added: its text, and its lines, if on lines. */
export type Adding = { range?: Range; text: string };

/**
 * What a review sends: a comment on the selected lines or the whole file, an edit of one, its
 * removal, a general comment from the end's own field, and starting over; and, with `onAsk`, Ask the agent, which hands it the selected lines
 * quoted, as they read in the reviewed file, or a decision's parts, as they read in its own. A new
 * comment is `adding` from its "Add comment" until the review file holds it, its form hidden:
 * refused, the form shows again, with the error.
 */
export function useReviewActions(
  file: File,
  { close, draft, removed, selection }: Draft,
  { run }: Refusals,
  onAsk?: (quote: string) => void,
) {
  const fate = useFateClient();
  // Shown from "Add comment" until the comment is written, in a transition of its own.
  const [adding, setAdding] = useOptimistic<Adding | undefined>(undefined);
  const input = { file: file.name, folder: file.folder };
  const add = (text: string) => {
    const range = draft?.kind === "lines" ? selection : undefined;
    return new Promise<{ error?: unknown }>((resolve) =>
      startTransition(async () => {
        setAdding({ range, text });
        const extent = range
          ? { decision: range.decision, endLine: range.end, startLine: range.start }
          : {};
        resolve(
          await fate.mutations.review.comment({
            input: { ...input, text, ...extent },
            view: FileView,
          }),
        );
      }),
    );
  };
  const send = async (written: string) => {
    if (!draft) {
      return undefined;
    }
    const result =
      draft.kind === "edit"
        ? await fate.mutations.review.edit({
            input: { ...input, number: draft.number, text: written },
            view: FileView,
          })
        : await add(written);
    if (result.error) {
      return refusal(result.error).message;
    }
    close();
    return undefined;
  };
  const ask =
    onAsk &&
    ((range: Range) => onAsk(quoteOfRange(file, (file.committed ?? file.current).text, range)));
  const remove = useRemoveComment(file, removed, run);
  /** Adds a general comment, from the end's own field: the error to show, or nothing once written. */
  const general = async (text: string) => {
    const result = await fate.mutations.review.comment({
      input: { ...input, text },
      view: FileView,
    });
    return result.error ? refusal(result.error).message : undefined;
  };
  const startOver = async () => {
    await run(() => fate.mutations.review.startOver({ input, view: FileView }));
  };
  return { adding, ask, general, remove, send, startOver };
}

/**
 * Removes comment `number`: the edits kept for the comments after it follow their numbers. Once
 * written, a toast confirms it, whose Undo adds the comment again, with its text, on its lines,
 * last of the review (R3). A refused removal shows its error, and no toast.
 */
function useRemoveComment(file: File, removed: Draft["removed"], run: Refusals["run"]) {
  const fate = useFateClient();
  const repo = useRepositoryPath();
  const undoToast = useUndoToast();
  const input = { file: file.name, folder: file.folder };
  /** Adds a removed comment again: the error to show, or nothing once written. */
  const restore = async (comment: CommentItem) => {
    const extent = comment.general
      ? {}
      : {
          decision: decisionOf(comment),
          endLine: comment.endLine,
          startLine: comment.startLine,
        };
    const result = await fate.mutations.review.comment({
      input: { ...input, text: comment.text, ...extent },
      view: FileView,
    });
    return result.error ? refusal(result.error).message : undefined;
  };
  return async (number: number) => {
    const comments = file.review?.review?.comments ?? [];
    const comment = comments.find((each) => each.number === number);
    if (
      await run(() => fate.mutations.review.remove({ input: { ...input, number }, view: FileView }))
    ) {
      renumberUnsaved(
        (n) => unsavedKey(repo, reviewEditKey(file.path, n)),
        number,
        comments.length,
      );
      removed(number);
      if (comment) {
        undoToast(
          comment.general
            ? "Removed your general comment"
            : `Removed your comment on ${placeOf(comment)}`,
          () => restore(comment),
        );
      }
    }
  };
}
