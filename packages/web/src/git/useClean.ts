// Clean, as `ura clean` acts, from any page: a merged feature's worktree, its branch, and its line
// of the priorities removed, once the human confirmed it. The Git page's worktrees offer it, a
// merged feature's "Next" does, and so does `c` on its row of the priorities. It runs in the
// repository's write queue, named for the toast with the page it was asked from.
import { useCallback } from "react";
import { useFateClient } from "react-fate";
import { featureRequest } from "../data.ts";
import { guarded, refusal } from "../errors.ts";
import type { ConfirmOptions } from "../fields/Confirm.tsx";
import { useConfirm } from "../fields/Confirm.tsx";
import { GitPageView } from "./data.ts";

/** What Clean asks: `worktree` is the worktree's path, when the Git page knows it. */
export function cleanQuestion(name: string, worktree?: string): ConfirmOptions {
  return {
    body: worktree
      ? `Removes ${worktree}, deletes its branch, and removes ${name} from the priorities.`
      : `Removes its worktree and deletes its branch, if they are left, and removes ${name} from the priorities.`,
    cancel: "Keep",
    confirm: "Clean",
    destructive: true,
    title: `Clean ${name}?`,
  };
}

/** The merged feature to clean: its folder, its name, and the page the write is named with. */
export type CleanTarget = { folder: string; href: string; name: string };

/**
 * What cleans a merged feature once the human confirmed it: it resolves with `undefined` once it
 * landed, or when the human kept it, and with the refusal's message otherwise. The feature is read
 * again once it landed: what it left is gone.
 */
export function useClean() {
  const fate = useFateClient();
  const confirm = useConfirm();
  return useCallback(
    async ({ folder, href, name }: CleanTarget): Promise<string | undefined> => {
      if (!(await confirm(cleanQuestion(name)))) {
        return undefined;
      }
      const result = await guarded(() =>
        fate.mutations.git.clean({
          input: { folder, write: { href, label: `Cleaning ${name}` } },
          view: GitPageView,
        }),
      );
      if (result.error) {
        return refusal(result.error).message;
      }
      void fate.request(featureRequest(folder), { mode: "network-only" });
      return undefined;
    },
    [confirm, fate],
  );
}
