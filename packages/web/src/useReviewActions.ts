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

/**
 * What a review sends: a comment on the selected lines or the whole file, an edit of one, its
 * removal, and starting over; and Ask the agent, which opens the feature's session with the
 * selected lines quoted, as they read in the file.
 */
export function useReviewActions(
  file: File,
  { close, draft, selection }: Draft,
  { run }: Refusals,
) {
  const fate = useFateClient();
  const input = { file: file.name, folder: file.folder };
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
        : await fate.mutations.review.comment({
            input: {
              ...input,
              text: written,
              ...(draft.kind === "lines" && selection
                ? { endLine: selection.end, startLine: selection.start }
                : {}),
            },
            view: FileView,
          });
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
  return { ask, remove, send, startOver };
}
