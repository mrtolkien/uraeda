import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { afterEach, expect, test } from "vite-plus/test";
import { temporaryFolder } from "uraeda-binding/test-utils";
import { homePath, suggest, typedFolder } from "../folders.ts";

/** A temporary home folder holding `paths`: those ending with `/` are folders, others files. */
function tree(paths: Record<string, string>) {
  const home = temporaryFolder("uraeda-home");
  for (const [path, text] of Object.entries(paths)) {
    if (path.endsWith("/")) {
      mkdirSync(join(home, path), { recursive: true });
    } else {
      mkdirSync(dirname(join(home, path)), { recursive: true });
      writeFileSync(join(home, path), text);
    }
  }
  return home;
}

/** Folders made unreadable by a test, readable again after it, so they can be deleted. */
const locked: Array<string> = [];
afterEach(() => {
  for (const folder of locked.splice(0)) {
    chmodSync(folder, 0o755);
  }
});

/** US2.1 */
test("suggestions list matching folders, git ones marked, hidden ones left out", async () => {
  const home = tree({
    "dev/todo-app/.git/": "",
    "dev/tools/": "",
    "dev/.cache/": "",
    "dev/todo.txt": "x",
    "dev/other/": "",
  });

  expect(await suggest("~/dev/to", home)).toEqual([
    { path: "~/dev/todo-app/", git: true },
    { path: "~/dev/tools/", git: false },
  ]);
});

test("matching ignores case, and an absolute path keeps its form", async () => {
  const home = tree({ "dev/Todo-App/": "", "dev/tools/": "" });

  expect(await suggest(`${home}/dev/TO`, home)).toEqual([
    { path: `${home}/dev/Todo-App/`, git: false },
    { path: `${home}/dev/tools/`, git: false },
  ]);
});

test("a dot shows hidden folders", async () => {
  const home = tree({ "dev/.cache/": "", "dev/.config/": "", "dev/cache/": "" });

  expect(await suggest("~/dev/.ca", home)).toEqual([{ path: "~/dev/.cache/", git: false }]);
});

test("a git file, as in a worktree, marks the folder git", async () => {
  const home = tree({ "dev/feature/.git": "gitdir: /elsewhere\n" });

  expect(await suggest("~/dev/", home)).toEqual([{ path: "~/dev/feature/", git: true }]);
});

test("at most 20, sorted by name", async () => {
  const folders = Object.fromEntries(
    Array.from({ length: 25 }, (_, n) => [`dev/a${String(24 - n).padStart(2, "0")}/`, ""]),
  );
  const home = tree(folders);

  const paths = (await suggest("~/dev/a", home)).map((row) => row.path);

  expect(paths).toEqual(
    Array.from({ length: 20 }, (_, n) => `~/dev/a${String(n).padStart(2, "0")}/`),
  );
});

test("a relative path gets no suggestions", async () => {
  const home = tree({ "dev/todo-app/": "" });

  expect(await suggest("dev/to", home)).toEqual([]);
});

test("a folder that does not exist gets no suggestions", async () => {
  const home = tree({});

  expect(await suggest("~/nope/to", home)).toEqual([]);
});

test.skipIf(process.getuid?.() === 0)("an unreadable folder gets no suggestions", async () => {
  const home = tree({ "dev/todo-app/": "" });
  chmodSync(join(home, "dev"), 0o000);
  locked.push(join(home, "dev"));

  expect(await suggest("~/dev/to", home)).toEqual([]);
});

test.each([
  ["~", "/home/me"],
  ["~/", "/home/me"],
  ["~/dev/todo-app/", "/home/me/dev/todo-app"],
  ["/home/me/dev/tools", "/home/me/dev/tools"],
  ["/", "/"],
])("typedFolder reads %s as %s", (text, folder) => {
  expect(typedFolder(text, "/home/me")).toBe(folder);
});

test.each(["dev/todo-app", "", "./dev", "~other/dev"])("typedFolder refuses %j", (text) => {
  expect(() => typedFolder(text, "/home/me")).toThrow(
    "Type an absolute path, starting with / or ~.",
  );
});

test.each([
  ["/home/me/dev/uraeda", "~/dev/uraeda"],
  ["/home/me", "~"],
  ["/home/meadow/x", "/home/meadow/x"],
  ["/srv/repo", "/srv/repo"],
])("homePath writes %s as %s", (path, written) => {
  expect(homePath(path, "/home/me")).toBe(written);
});
