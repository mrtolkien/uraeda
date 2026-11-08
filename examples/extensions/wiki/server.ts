// The Wiki's server part: the record `pages`, the Markdown files of the repository's folder its
// `folder` setting names, `docs` by default, read again when a commit lands on the repository.
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import type { ServerApi } from "uraeda/server";

/** A page: its path in the folder, its title, and its Markdown. */
export type WikiPage = { path: string; text: string; title: string };

/** The record `pages`: the folder it read, whether it is there, and its pages by path. */
export type Wiki = { folder: string; isMissing: boolean; pages: Array<WikiPage> };

/** The most pages the record holds: a larger folder is cut, so the page stays quick. */
const MOST_PAGES = 200;

/** The page's title: its first `# ` heading, else its path without `.md`. */
function titleOf(path: string, text: string): string {
  return /^#\s+(.+)$/m.exec(text)?.[1].trim() ?? path.replace(/\.md$/, "");
}

/** The Markdown files under `folder`, by their path in it, `/` between its parts, in order. */
function markdownFiles(folder: string): Array<string> {
  return readdirSync(folder, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => relative(folder, join(entry.parentPath, entry.name)).split(sep).join("/"))
    .sort()
    .slice(0, MOST_PAGES);
}

/** Reads the wiki of `root`, the repository's main checkout, from its folder `folder`. */
function readWiki(root: string, folder: string): Wiki {
  const path = resolve(root, folder);
  if (path !== root && !path.startsWith(root + sep)) {
    throw new Error(`the folder ${folder} is outside the repository`);
  }
  let files: Array<string>;
  try {
    files = markdownFiles(path);
  } catch {
    return { folder, isMissing: true, pages: [] };
  }
  const pages = files.map((file) => {
    const text = readFileSync(join(path, file), "utf8");
    return { path: file, text, title: titleOf(file, text) };
  });
  return { folder, isMissing: false, pages };
}

export default function activate(api: ServerApi) {
  const pages = api.record("pages", (repository): Wiki => {
    const root = api.repositories().find((one) => one.name === repository)?.path;
    if (root === undefined) {
      throw new Error(`no repository named ${repository}`);
    }
    return readWiki(root, String(api.settings(repository).folder));
  });
  api.on("commit-landed", (event) => pages.changed(event.repository));
}
