// The names the toast lists git writes by, as their buttons would say what they do: "Approving the
// spec of Performance pass".
import { useWorkspace } from "../data.ts";

/** The title of the feature or change in `folder`, as the sidebar's card shows it, or its folder. */
export function useFeatureTitle(folder: string): string {
  return useWorkspace()?.features.find((feature) => feature.folder === folder)?.title ?? folder;
}

/** A workflow file's kind as a write's name says it: `data-model` is "data model". */
export const kindName = (kind: string) => kind.replaceAll("-", " ");
