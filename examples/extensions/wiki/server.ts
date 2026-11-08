// The Wiki's server part: the record `pages`, the Markdown files of the repository's folder its
// `folder` setting names, `docs` by default, read again when a commit lands on the repository.
// Read without blocking the server, each page cut at `MOST_BYTES`.
import { Buffer } from "node:buffer";
import { open, readdir } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";
import type { ServerApi } from "uraeda/server";

/** A page: its path in the folder, its title, and its Markdown. */
export type WikiPage = { path: string; text: string; title: string };

/** The record `pages`: the folder it read, whether it is there, and its pages by path. */
export type Wiki = { folder: string; isMissing: boolean; pages: Array<WikiPage> };

/** The most pages the record holds: a larger folder is cut, so the page stays quick. */
const MOST_PAGES = 200;

/** The most bytes read of a page: a longer one is cut, with a note saying so. */
const MOST_BYTES = 256 * 1024;

/** The page's title: its first `# ` heading, else its path without `.md`. */
function titleOf(path: string, text: string): string {
  return /^#\s+(.+)$/m.exec(text)?.[1].trim() ?? path.replace(/\.md$/, "");
}

/** The Markdown files under `folder`, by their path in it, `/` between its parts, in order. */
async function markdownFiles(folder: string): Promise<Array<string>> {
  return (await readdir(folder, { recursive: true, withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => relative(folder, join(entry.parentPath, entry.name)).split(sep).join("/"))
    .sort()
    .slice(0, MOST_PAGES);
}

/** The page at `path`, its first `MOST_BYTES` bytes, and a note when it is longer. */
async function readPage(path: string): Promise<string> {
  const file = await open(path);
  try {
    const buffer = Buffer.alloc(MOST_BYTES + 1);
    const { bytesRead } = await file.read(buffer, 0, buffer.length, 0);
    if (bytesRead <= MOST_BYTES) {
      return buffer.toString("utf8", 0, bytesRead);
    }
    // A character cut in two at the end shows as one replacement mark.
    const text = buffer.toString("utf8", 0, MOST_BYTES);
    return `${text}\n\n*This page is cut at ${MOST_BYTES / 1024} KB: open its file for the rest.*\n`;
  } finally {
    await file.close();
  }
}

/** Reads the wiki of `root`, the repository's main checkout, from its folder `folder`. */
async function readWiki(root: string, folder: string): Promise<Wiki> {
  const path = resolve(root, folder);
  if (path !== root && !path.startsWith(root + sep)) {
    throw new Error(`the folder ${folder} is outside the repository`);
  }
  let files: Array<string>;
  try {
    files = await markdownFiles(path);
  } catch {
    return { folder, isMissing: true, pages: [] };
  }
  const pages = await Promise.all(
    files.map(async (file) => {
      const text = await readPage(join(path, file));
      return { path: file, text, title: titleOf(file, text) };
    }),
  );
  return { folder, isMissing: false, pages };
}

export default function activate(api: ServerApi) {
  const pages = api.record("pages", (repository): Promise<Wiki> => {
    const root = api.repositories().find((one) => one.name === repository)?.path;
    if (root === undefined) {
      throw new Error(`no repository named ${repository}`);
    }
    return readWiki(root, String(api.settings(repository).folder));
  });
  api.on("commit-landed", (event) => pages.changed(event.repository));
}
