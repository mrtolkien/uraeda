// The Git page's keys, declared in the key registry, as lazygit's: `p` pull, `P` push, `f` fetch,
// `a` stage or unstage all, `c` commit what is staged, `M` merge into the branch, and on a row, `d`
// to discard its file or remove its worktree. The list's keys move over the tree, the history, and
// the worktrees, `j`/`k` and the arrows; Enter folds a folder or opens a file's or a commit's
// detail. Space is a row's box's own: it stages.
import type { GitWorktree } from "./data.ts";
import { useKeys } from "../keys/registry.tsx";
import { useListKeys } from "../lists/useListKeys.ts";
import type { Picked } from "./address.ts";
import type { GitCommitRow, GitGroup } from "./data.ts";
import type { TreeRow } from "./tree.ts";

/** A row the list's keys move over: a tree's, a commit's, or a worktree's with an action. */
export type ListRow =
  | { group: GitGroup; key: string; kind: "tree"; row: TreeRow }
  | { commit: GitCommitRow; key: string; kind: "commit" }
  | { key: string; kind: "worktree"; worktree: GitWorktree };

/** What a row opens in the detail: a file's diff, or a commit; none for a folder or a worktree. */
export function pickOf(row: ListRow | undefined): Picked | undefined {
  if (row?.kind === "commit") {
    return { commit: row.commit.id, kind: "commit" };
  }
  if (row?.kind === "tree" && !row.row.folder) {
    return row.group.folder === null
      ? { file: row.row.path, kind: "file" }
      : { file: row.row.path, folder: row.group.folder, kind: "file" };
  }
  return undefined;
}

/** What the page's keys do. */
export type GitActions = {
  commit: (group: GitGroup) => void;
  discard: (row: ListRow) => boolean;
  fetch: () => void;
  fold: (group: GitGroup, path: string) => void;
  /** Shows a row's detail beside the list as the selection moves to it, on wide screens. */
  follow: (picked: Picked) => void;
  merge: () => void;
  /** Opens a row's detail: its page on the phone. */
  open: (picked: Picked) => void;
  pull: () => void;
  push: () => void;
  stageAll: (group: GitGroup) => void;
};

/**
 * The page's keys over `rows`, `cursor` the selected row's key, `setCursor` what moves it. `main`
 * is the group `a` and `c` act on when the selection is in no group.
 */
export function useGitKeys({
  actions,
  cursor,
  main,
  rows,
  setCursor,
}: {
  actions: GitActions;
  cursor: string | undefined;
  main: GitGroup | undefined;
  rows: ReadonlyArray<ListRow>;
  setCursor: (key: string) => void;
}) {
  const selected = rows.findIndex((row) => row.key === cursor);
  const current = rows[selected];
  const group = current?.kind === "tree" ? current.group : main;
  const { ref } = useListKeys({
    escapeLabel: null,
    keys: rows.map((row) => row.key),
    onClose: () => false,
    onEdit: () => {
      if (current?.kind === "tree" && current.row.folder) {
        actions.fold(current.group, current.row.path);
        return true;
      }
      const picked = pickOf(current);
      if (picked) {
        actions.open(picked);
        return true;
      }
      // A worktree's row: Enter presses its button.
      return false;
    },
    onSelect: (index) => {
      const row = rows[index];
      if (row) {
        setCursor(row.key);
        const picked = pickOf(row);
        if (picked) {
          actions.follow(picked);
        }
      }
    },
    rowKeys: [{ keys: "d", label: "discard", run: (index) => actions.discard(rows[index]!) }],
    selected,
  });
  useKeys([
    { hint: "p", keys: "p", label: "pull", run: actions.pull },
    { hint: "P", keys: "P", label: "push", run: actions.push },
    { keys: "f", label: "fetch", run: actions.fetch },
    ...(group
      ? [
          { hint: "a", keys: "a", label: "stage all", run: () => actions.stageAll(group) },
          { hint: "c", keys: "c", label: "commit", run: () => actions.commit(group) },
        ]
      : []),
    { keys: "M", label: "merge", run: actions.merge },
  ]);
  return ref;
}
