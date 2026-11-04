// The writes of a stopped pull or merge: a conflicted file's whole side, Continue, and Abort, which
// always asks first (SC-003), saying the resolved files go back once one was. Each is a write of the
// sync's place, its refusal under the page's title, as Pull's (ruling R22).
import { useEffect } from "react";
import { useFateClient } from "react-fate";
import { useConfirm } from "../fields/Confirm.tsx";
import { type GitPageData, GitPageView } from "./data.ts";
import type { GitWrites } from "./useGitWrites.ts";

/** A conflicted file of the page. */
export type GitConflict = GitPageData["conflicts"][number];

/** What a conflict's whole side writes: git's stage 2 or 3, or the file deleted. */
export type Resolution = "delete" | "ours" | "theirs";

/** A stopped operation, as the page reads it. */
export type Stopped = NonNullable<GitPageData["stopped"]>;

/**
 * The files whose side was taken on this page, by their path, while the operation is stopped: they
 * leave the conflicts once staged, and Abort puts them back too.
 */
const taken = new Set<string>();

/** The operation's name in the questions and the banner: a stash's stop is its pull's. */
export const operationOf = (stopped: Stopped) => (stopped.kind === "merge" ? "merge" : "pull");

/** The page's writes of a stopped operation. */
export function useConflictWrites(
  page: Pick<GitPageData, "branch" | "conflicts" | "stopped">,
  writes: GitWrites,
) {
  const git = useFateClient().mutations.git;
  const confirm = useConfirm();
  const view = GitPageView;
  const stopped = page.stopped;
  // Once nothing is stopped, the sides taken are history.
  useEffect(() => {
    if (!stopped) {
      taken.clear();
    }
  }, [stopped]);
  const hasResolved =
    page.conflicts.some((conflict) => conflict.isResolved) ||
    [...taken].some((path) => !page.conflicts.some((conflict) => conflict.path === path));

  /** Takes a conflicted file's whole side, or deletes it: the file leaves the conflicts. */
  const resolve = (path: string, resolution: Resolution, label: string) =>
    writes
      .run("sync", `${label}: ${path}`, (write) =>
        git.resolve({ input: { path, resolution, write }, view }),
      )
      .then((landed) => {
        if (landed) {
          taken.add(path);
        }
        return landed;
      });

  const proceed = () =>
    writes.run("sync", "Continuing", (write) => git.continue({ input: { write }, view }));

  /** Aborts once confirmed; a stash's stop has no abort. */
  const abort = async () => {
    if (!stopped || stopped.kind === "stash") {
      return false;
    }
    const what = operationOf(stopped);
    const asked = await confirm({
      body: hasResolved
        ? "The resolved files go back as they were."
        : `${page.branch ?? "The branch"} goes back as it was before the ${what}.`,
      cancel: "Keep",
      confirm: "Abort",
      destructive: true,
      title: `Abort the ${what}?`,
    });
    if (!asked) {
      return false;
    }
    const landed = await writes.run("sync", "Aborting", (write) =>
      git.abort({ input: { write }, view }),
    );
    if (landed) {
      taken.clear();
    }
    return landed;
  };

  return { abort, proceed, resolve };
}

export type ConflictWrites = ReturnType<typeof useConflictWrites>;
