// The Wiki's server part: the record `pages`, the Markdown files of the repository's folder its
// `folder` setting names, `docs` by default; the record `count`, how many there are, which the
// rail shows after the place's title; and the action `read`, a page's text. Both records are sent
// again when a commit lands on the repository, and when the settings change, as the extension then
// loads again.
import type { ServerApi } from "uraeda/server";
import { exists, join, list, readText, relative } from "uraeda:fs";

/** A page: its path in the folder, and its title. */
export type WikiPage = { path: string; title: string };

/** The record `pages`: the folder it read, whether it is there, and its pages by path. */
export type Wiki = { folder: string; isMissing: boolean; pages: Array<WikiPage> };

/** The most pages the record holds: a larger folder is cut, so the page stays quick. */
const MOST_PAGES = 200;

/** The most characters of a page `read` gives: a longer one is cut, with a note saying so. */
const MOST_CHARACTERS = 256 * 1024;

/** The page's title: its first `# ` heading, else its path without `.md`. */
function titleOf(path: string, text: string): string {
  return /^#\s+(.+)$/m.exec(text)?.[1].trim() ?? path.replace(/\.md$/, "");
}

/** The Markdown files under `folder`, by their path in it, in order. */
function markdownFiles(folder: string, under = folder): Array<string> {
  return list(under)
    .flatMap((entry) => {
      const path = join(under, entry.name);
      if (entry.kind === "folder") return markdownFiles(folder, path);
      return entry.kind === "file" && entry.name.endsWith(".md") ? [relative(folder, path)] : [];
    })
    .sort();
}

export default function activate(api: ServerApi) {
  /** The wiki's folder in `repository`, refused when the setting leads out of it. */
  const folderOf = (repository: string) => {
    const root = api.repositories().find((one) => one.name === repository)?.path;
    if (root === undefined) throw new Error(`no repository named ${repository}`);
    const named = String(api.settings(repository).folder);
    const folder = join(root, named);
    if (relative(root, folder).startsWith("..")) {
      throw new Error(`the folder ${named} is outside the repository`);
    }
    return { folder, named };
  };

  const readWiki = (repository: string): Wiki => {
    const { folder, named } = folderOf(repository);
    if (!exists(folder)) return { folder: named, isMissing: true, pages: [] };
    const pages = markdownFiles(folder)
      .slice(0, MOST_PAGES)
      .map((path) => ({ path, title: titleOf(path, readText(join(folder, path))) }));
    return { folder: named, isMissing: false, pages };
  };

  const pages = api.record("pages", readWiki);
  const count = api.record("count", (repository) => readWiki(repository).pages.length);

  api.action("read", (input: { path: string }, repository) => {
    const { folder } = folderOf(repository);
    const path = join(folder, input.path);
    if (relative(folder, path).startsWith("..")) throw new Error("that page is outside the wiki");
    if (!exists(path)) throw new Error(`${input.path} is gone: it was moved or removed`);
    const text = readText(path);
    return text.length <= MOST_CHARACTERS
      ? text
      : `${text.slice(0, MOST_CHARACTERS)}\n\nThis page is cut here: open its file for the rest.`;
  });

  api.on("commit-landed", (event) => {
    pages.changed(event.repository);
    count.changed(event.repository);
  });
}
