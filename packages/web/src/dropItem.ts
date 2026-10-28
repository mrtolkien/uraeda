// Dropping a change or a feature, shared by the session's "…" and the feature's page: the question
// it asks first, the write, and the lines that say what stayed. Each page decides what the result
// does to itself.
import { useFateClient } from "react-fate";
import { refusal } from "./errors.ts";
import { useConfirm } from "./fields/Confirm.tsx";
import type { MoveNote } from "./offers.ts";
import { DroppedView } from "./views.ts";
import { runWrite } from "./writes/store.ts";

/** The change or the feature a session belongs to, as its page reads it. */
export type SessionItem = {
  branch: string | null;
  folder: string;
  kind: "change" | "feature";
  slug: string;
};

/** What a drop asks first: what goes, and what stays, with the command that deletes the branch. */
export function dropQuestion({ kind, slug }: SessionItem, branch: string) {
  return {
    body: `Its entry leaves Now, its worktree is removed, and its sessions are archived. Its branch stays, so nothing is lost: git branch -D ${branch} deletes it.`,
    cancel: `Keep the ${kind}`,
    confirm: `Drop the ${kind}`,
    destructive: true,
    title: `Drop the ${kind} ${slug}?`,
  };
}

/**
 * Why a drop's priorities stay uncommitted: they held the human's own edits, a hook refused the
 * commit, or Now did not list the item, so nothing was removed.
 */
export const UNCOMMITTED =
  "The priorities were not committed: if Now listed it, its proposal’s removal waits in specs/PRIORITIES.md.";

/**
 * How a drop ended: the human kept the item, the server refused it, or it happened, with the lines
 * that say what stayed.
 */
export type Dropped =
  | { kind: "cancelled" }
  | { kind: "refused"; message: string }
  | { committed: boolean; kind: "dropped"; notes: Array<MoveNote> };

/**
 * Drops the item once confirmed: its entry leaves **Now**, its worktree is removed unless it holds
 * uncommitted changes, and its sessions are archived. The notes say what stayed, with the branch
 * the server kept, and when the priorities were left uncommitted.
 */
export function useDropItem(): (item: SessionItem) => Promise<Dropped> {
  const fate = useFateClient();
  const confirm = useConfirm();
  return async (item) => {
    const branch = item.branch ?? (item.kind === "change" ? `change/${item.folder}` : item.folder);
    if (!(await confirm(dropQuestion(item, branch)))) {
      return { kind: "cancelled" };
    }
    const result = await runWrite({ folder: item.folder, label: "Dropping…" }, () =>
      fate.mutations.feature.drop({ input: { folder: item.folder }, view: DroppedView }),
    );
    if (result.error) {
      return { kind: "refused", message: refusal(result.error).message };
    }
    const dropped = result.result as
      | { branch?: string; committed?: boolean; worktreeLeft?: string | null }
      | undefined;
    return {
      committed: dropped?.committed !== false,
      kind: "dropped",
      notes: [
        {
          status: "info",
          title: `Dropped the ${item.kind} ${item.slug}: its branch ${dropped?.branch ?? branch} stays.`,
        },
        ...(dropped?.worktreeLeft
          ? [{ status: "warning" as const, title: dropped.worktreeLeft }]
          : []),
        ...(dropped?.committed === false
          ? [{ status: "warning" as const, title: UNCOMMITTED }]
          : []),
      ],
    };
  };
}
