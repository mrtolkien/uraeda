// The Git page's changes tree, from the core's flat list of changed files: folders before files, a
// chain of folders holding one folder each as one row, a folder's box and counts from its files',
// and a folded folder's rows left out.
import { expect, test } from "vite-plus/test";
import { buildTree, type FileChange } from "../git/tree.ts";

/** A changed file, modified, with its counts and its box. */
const file = (path: string, staged = "no", added = 1, removed = 0): FileChange => ({
  added,
  path,
  removed,
  staged,
  state: "modified",
});

/** A box as the row draws it: ticked, empty, or mixed. */
const BOXES = { false: "[ ]", indeterminate: "[-]", true: "[x]" } as const;

/** Each row, one line: its depth, its name, a folder's `/` and `-` when folded, its box, its counts. */
const drawn = (files: ReadonlyArray<FileChange>, folded: ReadonlyArray<string> = []) =>
  buildTree(files, new Set(folded)).map(
    (row) =>
      `${"  ".repeat(row.depth)}${row.name}${row.folder ? (row.isOpen ? "/" : "/-") : ""} ` +
      `${BOXES[String(row.staged) as keyof typeof BOXES]} +${row.added} -${row.removed}`,
  );

test.each([
  [
    "a chain of folders holding one folder each reads as one row",
    [file("crates/core/src/b.rs"), file("crates/core/src/a.rs", "no", 2, 1)],
    [],
    ["crates/core/src/ [ ] +3 -1", "  a.rs [ ] +2 -1", "  b.rs [ ] +1 -0"],
  ],
  [
    "a chain stops at a folder that holds a file, and folders come before files",
    [file("README.md"), file("crates/a.rs"), file("crates/core/src/b.rs")],
    [],
    [
      "crates/ [ ] +2 -0",
      "  core/src/ [ ] +1 -0",
      "    b.rs [ ] +1 -0",
      "  a.rs [ ] +1 -0",
      "README.md [ ] +1 -0",
    ],
  ],
  [
    "a folder with staged and unstaged files has a mixed box",
    [file("web/a.ts", "yes"), file("web/b.ts", "no")],
    [],
    ["web/ [-] +2 -0", "  a.ts [x] +1 -0", "  b.ts [ ] +1 -0"],
  ],
  [
    "a folder whose files are all partly staged has a mixed box",
    [file("web/a.ts", "partly"), file("web/b.ts", "partly")],
    [],
    ["web/ [-] +2 -0", "  a.ts [-] +1 -0", "  b.ts [-] +1 -0"],
  ],
  [
    "a folder whose files are all staged is ticked",
    [file("web/a.ts", "yes"), file("web/b.ts", "yes")],
    [],
    ["web/ [x] +2 -0", "  a.ts [x] +1 -0", "  b.ts [x] +1 -0"],
  ],
  [
    "a collapsed chain folds by its whole path, its rows left out",
    [file("crates/core/src/a.rs"), file("docs/x.md")],
    ["crates/core/src"],
    ["crates/core/src/- [ ] +1 -0", "docs/ [ ] +1 -0", "  x.md [ ] +1 -0"],
  ],
  [
    "a fold of a folder inside a chain's path folds nothing",
    [file("crates/core/src/a.rs")],
    ["crates/core"],
    ["crates/core/src/ [ ] +1 -0", "  a.rs [ ] +1 -0"],
  ],
  [
    "a binary file counts nothing in its folder",
    [{ ...file("img/a.png"), added: null, removed: null }, file("img/b.svg", "no", 4, 2)],
    [],
    ["img/ [ ] +4 -2", "  a.png [ ] +0 -0", "  b.svg [ ] +4 -2"],
  ],
])("%s", (_, files, folded, rows) => {
  expect(drawn(files, folded)).toEqual(rows);
});

test("a folder's press stages every file under it, at any depth, sorted", () => {
  const [folder] = buildTree([file("a/z.ts"), file("a/b/c.ts"), file("a/b/d.ts")], new Set());

  expect(folder?.paths).toEqual(["a/b/c.ts", "a/b/d.ts", "a/z.ts"]);
});
