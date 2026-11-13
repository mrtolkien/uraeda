// The Changes pane's tree: the conflicts first, then each checkout's changed files under its folders,
// each checkout a node of its own, as one tree with one cursor. A row's id says what it is:
// `g:<group>` a checkout, `d:<group>:<path>` a folder, `f:<group>:<path>` a file, `c:<path>` a
// conflict. A file's icon is its staging, which a press on it toggles.
import type { GitConflict, GitFile, GitGroup, GitPage } from "../../store/protocol";
import type { IconName } from "../../ui/controls";
import type { TreeNode } from "../../ui/lists";
import { tokens } from "../../ui/tokens";

/** What a row of the tree is, read from its id. */
export type RowOf =
  | { kind: "group"; group: string }
  | { kind: "folder"; group: string; path: string }
  | { kind: "file"; group: string; path: string }
  | { kind: "conflicts" }
  | { kind: "conflict"; path: string };

export const CONFLICTS = "g:!conflicts";

export function rowOf(id: string): RowOf {
  if (id === CONFLICTS) return { kind: "conflicts" };
  const [kind, rest = ""] = [id.slice(0, 1), id.slice(2)];
  if (kind === "c") return { kind: "conflict", path: rest };
  if (kind === "g") return { group: rest, kind: "group" };
  const cut = rest.indexOf(":");
  const [group, path] = [rest.slice(0, cut), rest.slice(cut + 1)];
  return kind === "d" ? { group, kind: "folder", path } : { group, kind: "file", path };
}

/** A group's folder as the writes name it, from its id: `.` is the main checkout's. */
export const folderOf = (group: string): string | null => (group === "." ? null : group);

/** The icon and hue of a file's staging, and the words of a press on it. */
function staging(file: GitFile): { hue: string; icon: IconName; mark: string } {
  if (file.staged === "yes") {
    return { hue: tokens.role.added, icon: "check", mark: `Unstage ${file.path}` };
  }
  if (file.staged === "partly") {
    return { hue: tokens.role.changed, icon: "minus", mark: `Stage the rest of ${file.path}` };
  }
  return { hue: tokens.role.inkFaint, icon: "square", mark: `Stage ${file.path}` };
}

/** What a file's change is, in a few signs: "new · +12", "+3 −1", "deleted". */
function factsOf(file: GitFile): string {
  const counts =
    file.added === null || file.removed === null
      ? "binary"
      : [file.added > 0 ? `+${file.added}` : "", file.removed > 0 ? `−${file.removed}` : ""]
          .filter((part) => part !== "")
          .join(" ");
  if (file.state === "modified") return counts;
  return counts === "" ? file.state : `${file.state} · ${counts}`;
}

type Folder = { files: Array<GitFile>; folders: Map<string, Folder> };

/** The nodes of a group's files, under their folders, folders first, each sorted by name. */
function nodesOf(group: string, folder: Folder, prefix: string): Array<TreeNode> {
  const folders = [...folder.folders.entries()]
    .toSorted(([a], [b]) => a.localeCompare(b))
    .map(([name, inner]): TreeNode => {
      const path = `${prefix}${name}`;
      return {
        children: nodesOf(group, inner, `${path}/`),
        id: `d:${group}:${path}`,
        label: name,
      };
    });
  const files = folder.files.map((file): TreeNode => {
    const shown = staging(file);
    return {
      hue: shown.hue,
      icon: shown.icon,
      id: `f:${group}:${file.path}`,
      label: file.path.slice(prefix.length),
      markLabel: shown.mark,
      meta: factsOf(file),
    };
  });
  return [...folders, ...files];
}

/** A group's files as a tree of folders. */
function groupTree(group: GitGroup): Array<TreeNode> {
  const root: Folder = { files: [], folders: new Map() };
  for (const file of group.files) {
    const parts = file.path.split("/");
    let at = root;
    for (const part of parts.slice(0, -1)) {
      let next = at.folders.get(part);
      if (next === undefined) {
        next = { files: [], folders: new Map() };
        at.folders.set(part, next);
      }
      at = next;
    }
    at.files.push(file);
  }
  return nodesOf(group.id, root, "");
}

/** A conflict's words: how its sides differ, and whether it waits to continue. */
function conflictFacts(conflict: GitConflict): string {
  if (conflict.isResolved) return "resolved";
  return `${conflict.kind.replace("-", " ")}${conflict.isBinary ? " · binary" : ""}`;
}

/** The page's whole tree: its conflicts, then each group with changes, the main checkout first. */
export function treeOf(page: GitPage): Array<TreeNode> {
  const conflicts: Array<TreeNode> =
    page.conflicts.length === 0
      ? []
      : [
          {
            children: page.conflicts.map((conflict) => ({
              hue: conflict.isResolved ? tokens.role.added : tokens.role.removed,
              icon: conflict.isResolved ? "check" : "triangle-alert",
              id: `c:${conflict.path}`,
              label: conflict.path,
              meta: conflictFacts(conflict),
            })),
            hue: tokens.role.removed,
            icon: "triangle-alert",
            id: CONFLICTS,
            label: "Conflicts",
            meta: `${page.conflicts.filter((one) => !one.isResolved).length} left`,
          },
        ];
  const groups = page.groups
    .filter((group) => group.folder === null || group.files.length > 0)
    .map((group): TreeNode => ({
      children: groupTree(group),
      hue: group.folder === null ? tokens.role.ink : tokens.role.context,
      icon: group.folder === null ? "git-branch" : "folder-git-2",
      id: `g:${group.id}`,
      label: group.folder === null ? group.name : `${group.name} · worktree`,
      meta: stagedWords(group),
    }));
  return [...conflicts, ...groups];
}

/** "1 of 2 staged", "2 changed", or "clean". */
export function stagedWords(group: GitGroup): string {
  const staged = group.files.filter((file) => file.staged !== "no").length;
  if (group.files.length === 0) return "clean";
  return staged === 0
    ? `${group.files.length} changed`
    : `${staged} of ${group.files.length} staged`;
}
