import { useFateClient } from "react-fate";
import type { useFile } from "../data.ts";
import { refusal } from "../errors.ts";
import type { StoryComments } from "../stories.tsx";
import { FileView } from "../views.ts";

type File = NonNullable<ReturnType<typeof useFile>>;

/**
 * The review's comments on its embedded stories: on the embed's lines, as a mockup's comment is on
 * the line that links it, their unsaved text kept under the file's path.
 */
export function useStoryComments(file: File): StoryComments {
  const fate = useFateClient();
  return {
    path: file.path,
    save: async (_story, text, block) => {
      const lines = block ? { endLine: block.endLine, startLine: block.startLine } : {};
      const result = await fate.mutations.review.comment({
        input: { file: file.name, folder: file.folder, text, ...lines },
        view: FileView,
      });
      return result.error ? refusal(result.error).message : undefined;
    },
  };
}
