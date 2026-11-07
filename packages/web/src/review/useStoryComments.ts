import { useFateClient } from "react-fate";
import type { useFile } from "../data.ts";
import { refusal } from "../errors.ts";
import type { StoryComments } from "../stories.tsx";
import { ReviewChangeView, useRecordComment } from "../useReviewActions.ts";

type File = NonNullable<ReturnType<typeof useFile>>;

/**
 * The review's comments on its embedded stories: on the embed's lines, as a mockup's comment is on
 * the line that links it, their unsaved text kept under the file's path. Each lands on the tab's
 * undo stack, as the review page's own comments do.
 */
export function useStoryComments(file: File): StoryComments {
  const fate = useFateClient();
  const recordComment = useRecordComment(file);
  return {
    path: file.path,
    save: async (_story, text, block) => {
      const lines = block ? { endLine: block.endLine, startLine: block.startLine } : {};
      const result = await fate.mutations.review.comment({
        input: { file: file.name, folder: file.folder, text, ...lines },
        view: ReviewChangeView,
      });
      recordComment(result, text);
      return result.error ? refusal(result.error).message : undefined;
    },
  };
}
