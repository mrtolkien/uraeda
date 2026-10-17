import { useLayoutEffect, useState } from "react";
import type { CommentItem } from "uraeda-binding";
import type { useFile } from "../data.ts";
import { unsavedKey } from "../fields/unsaved.ts";
import { reanchor, restoredComment, reviewKey, writeStale } from "../reviewField.ts";
import type { useRefusals } from "../ReviewVerdict.tsx";
import { useRepositoryPath } from "../routes.tsx";
import { useCommentDraft } from "../useCommentDraft.ts";
import { withoutCommentRefusal } from "../useReviewImages.ts";

type File = NonNullable<ReturnType<typeof useFile>>;

/**
 * The comment being written, as `useCommentDraft` gives it: its lines kept with its unsaved text as
 * they change, the comment whose text the store kept opened again as the page is drawn, written
 * again as a general comment when its lines are of a commit no longer reviewed, and the verdict's
 * refusal for it gone once it closes.
 */
export function useReviewDraft(
  file: File,
  comments: ReadonlyArray<CommentItem>,
  wide: boolean,
  { setMessage }: ReturnType<typeof useRefusals>,
) {
  const repo = useRepositoryPath();
  const tree = (file.committed ?? file.current).document;
  const commit = file.tip ?? "";
  const [restored] = useState(() => restoredComment(repo, file.path, commit, comments, tree));
  useLayoutEffect(() => {
    if (restored?.stale) {
      writeStale(restored.stale);
    }
  }, [restored]);
  const key = unsavedKey(repo, reviewKey(file.path));
  const typed = useCommentDraft(
    wide,
    (range) => reanchor(key, range && { ...range, commit }),
    restored,
  );
  return {
    ...typed,
    close: () => {
      setMessage(withoutCommentRefusal);
      typed.close();
    },
  };
}
