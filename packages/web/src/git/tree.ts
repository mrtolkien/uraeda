// The changes' tree, built from the core's flat list of a checkout's changed files: presentation
// only, as lazygit draws it. Folders come before files, a chain of folders holding one folder each
// reads as one row, `crates/core/src`, and a folder's counts and box sum up its files. Folding is
// the page's: a folded folder's rows are left out.

/** A changed file, as the page's view lists it. */
export type FileChange = {
  added?: number | null | undefined;
  path: string;
  removed?: number | null | undefined;
  /** `no`, `yes`, or `partly`. */
  staged: string;
  /** `modified`, `new`, or `deleted`. */
  state: string;
};

/** A row of the tree: a folder or a file, at its depth. */
export type TreeRow = {
  added: number;
  depth: number;
  /** A file's change, none for a folder. */
  file?: FileChange;
  folder: boolean;
  /** Whether a folder is unfolded; a file's is always true. */
  isOpen: boolean;
  /** The words the row shows: a file's name, or a folder's chain of names. */
  name: string;
  /** From the checkout's top level: a folder's without a trailing `/`. */
  path: string;
  /** The files a press on it stages or unstages: a file's own, or every file under a folder. */
  paths: ReadonlyArray<string>;
  removed: number;
  staged: boolean | "indeterminate";
};

/** A folder while the tree is built: its folders and its files by name. */
type Folder = { files: Map<string, FileChange>; folders: Map<string, Folder> };

const emptyFolder = (): Folder => ({ files: new Map(), folders: new Map() });

/** The folders of `files`, each file under its parent. */
function foldersOf(files: ReadonlyArray<FileChange>): Folder {
  const root = emptyFolder();
  for (const file of files) {
    const names = file.path.split("/");
    let folder = root;
    for (const name of names.slice(0, -1)) {
      let next = folder.folders.get(name);
      if (next === undefined) {
        next = emptyFolder();
        folder.folders.set(name, next);
      }
      folder = next;
    }
    folder.files.set(names.at(-1) ?? file.path, file);
  }
  return root;
}

/** A file's box: ticked, empty, or mixed when only some of its lines are staged. */
const stagedOf = (file: FileChange): boolean | "indeterminate" =>
  file.staged === "yes" ? true : file.staged === "no" ? false : "indeterminate";

/** Every file under `folder`, in no order. */
function filesUnder(folder: Folder): Array<FileChange> {
  return [...folder.files.values(), ...[...folder.folders.values()].flatMap(filesUnder)];
}

/** A folder's box from its files': ticked when all are, empty when none are, else mixed. */
function folderStaged(files: ReadonlyArray<FileChange>): boolean | "indeterminate" {
  const boxes = files.map(stagedOf);
  if (boxes.every((box) => box === true)) {
    return true;
  }
  return boxes.every((box) => box === false) ? false : "indeterminate";
}

const byName = <T>(entries: Iterable<[string, T]>) =>
  [...entries].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

/** The rows of `folder`'s content at `depth`, its path `base`, skipping what `folded` folds. */
function rowsOf(
  folder: Folder,
  base: string,
  depth: number,
  folded: ReadonlySet<string>,
): Array<TreeRow> {
  const rows: Array<TreeRow> = [];
  for (const [first, child] of byName(folder.folders)) {
    // A chain of folders holding one folder each, and no file, reads as one row.
    let name = first;
    let inner = child;
    while (inner.files.size === 0 && inner.folders.size === 1) {
      const [[next, only]] = [...inner.folders];
      name = `${name}/${next}`;
      inner = only;
    }
    const path = base === "" ? name : `${base}/${name}`;
    const files = filesUnder(inner);
    const isOpen = !folded.has(path);
    rows.push({
      added: files.reduce((sum, file) => sum + (file.added ?? 0), 0),
      depth,
      folder: true,
      isOpen,
      name,
      path,
      paths: files.map((file) => file.path).sort(),
      removed: files.reduce((sum, file) => sum + (file.removed ?? 0), 0),
      staged: folderStaged(files),
    });
    if (isOpen) {
      rows.push(...rowsOf(inner, path, depth + 1, folded));
    }
  }
  for (const [name, file] of byName(folder.files)) {
    rows.push({
      added: file.added ?? 0,
      depth,
      file,
      folder: false,
      isOpen: true,
      name,
      path: file.path,
      paths: [file.path],
      removed: file.removed ?? 0,
      staged: stagedOf(file),
    });
  }
  return rows;
}

/**
 * The rows of `files`' tree, top to bottom: each folder before its files, its rows under it unless
 * `folded` holds its path.
 */
export function buildTree(
  files: ReadonlyArray<FileChange>,
  folded: ReadonlySet<string>,
): ReadonlyArray<TreeRow> {
  return rowsOf(foldersOf(files), "", 0, folded);
}
