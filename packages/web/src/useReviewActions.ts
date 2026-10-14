import { startTransition, useOptimistic } from "react";
import { useFateClient } from "react-fate";
import type { useFile } from "./data.ts";
import { refusal } from "./errors.ts";
import type { useRefusals } from "./ReviewVerdict.tsx";
import { askAbout, quoted } from "./sessions.ts";
import type { Range, useCommentDraft } from "./useCommentDraft.ts";
import { FileView } from "./views.ts";

type File = NonNullable<ReturnType<typeof useFile>>;
type Draft = ReturnType<typeof useCommentDraft>;
type Refusals = ReturnType<typeof useRefusals>;

/** A new comment being added: its text, and its lines, if on lines. */
export type Adding = { range?: Range; text: string };

/**
 * What a review sends: a comment on the selected lines or the whole file, an edit of one, its
 * removal, and starting over; and Ask the agent, which opens the feature's session with the
 * selected lines quoted, as they read in the file. A new comment is `adding` from its "Add
 * comment" until the review file holds it, its form hidden: refused, the form shows again, with
 * the error.
 */
export function useReviewActions(
  file: File,
  { close, draft, selection }: Draft,
  { run }: Refusals,
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
        const extent = range ? { endLine: range.end, startLine: range.start } : {};
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
  const ask = (range: Range) => {
    const version = file.committed ?? file.current;
    const lines = version.text.split("\n").slice(range.start - 1, range.end);
    const where =
      range.start === range.end ? `line ${range.start}` : `lines ${range.start}–${range.end}`;
    askAbout(file.folder, quoted(`About ${file.path}, ${where}:`, lines));
  };
  const remove = (number: number) =>
    void run(() => fate.mutations.review.remove({ input: { ...input, number }, view: FileView }));
  const startOver = async () => {
    await run(() => fate.mutations.review.startOver({ input, view: FileView }));
  };
  return { adding, ask, remove, send, startOver };
}
