// The names the toast lists git writes by, as their buttons would say what they do: "Approving the
// spec of Performance pass".
import { useWorkspace } from "../data.ts";

/** The title of the feature or change in `folder`, as the sidebar's card shows it, or its folder. */
export function useFeatureTitle(folder: string): string {
  return useWorkspace()?.features.find((feature) => feature.folder === folder)?.title ?? folder;
}

/** A workflow file's kind as a write's name says it: `data-model` is "data model". */
export const kindName = (kind: string) => kind.replaceAll("-", " ");

/** What failed, by the word a git write of the Git page is named with, as "Pulling". */
const GIT_FAILED: Record<string, string> = {
  Aborting: "The abort failed.",
  Cleaning: "The clean failed.",
  Committing: "The commit failed.",
  Continuing: "The pull could not continue.",
  Discarding: "The discard failed.",
  Fetching: "The fetch failed.",
  Merging: "The merge failed.",
  Pulling: "The pull failed.",
  Pushing: "The push failed.",
  Removing: "The removal failed.",
  Resolving: "The conflict's side could not be taken.",
  Staging: "Staging failed.",
  Unstaging: "Unstaging failed.",
};

/**
 * The title of a refused write of the Git page, from its name: a hook's refusal of a commit says
 * the files stay staged; any other, what failed, git's message under it.
 */
export function gitRefusalTitle(write: { failure?: string | undefined; label: string }): string {
  if (write.failure === "hook") {
    return "The pre-commit hook refused the commit: the files stay staged.";
  }
  const verb = write.label.split(" ")[0] ?? "";
  return GIT_FAILED[verb] ?? `${write.label} failed.`;
}
