// One-time links: the host's browser signs in by opening one, as the server starts. The browser is
// given a page in the data folder that leads to the link, never the link itself: a command line,
// like the launcher's, is readable by every user of the machine.
import { chmodSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { hash, randomToken } from "./tokens.ts";

/** How long a one-time link may be used after it is made. */
const LINK_MS = 5 * 60 * 1000;

/** The token of a one-time link's path, `/session/<token>?to=<to>`. */
const LINK_PATH = /^\/session\/([\w-]+)\?/;

/**
 * The folder of the pages of the server on `port`'s links: `sign-in-links/<port>/` in the data
 * folder, the owner's alone.
 */
export const linkPages = (dataDir: string, port: number) =>
  join(dataDir, "sign-in-links", String(port));

/** The page of the link whose token is `token`, named by its hash. */
const pagePath = (folder: string, token: string) => join(folder, `${hash(token)}.html`);

/** `text` safe in an HTML attribute. */
const attribute = (text: string) =>
  text.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");

/**
 * The address a browser opens for `path` on the server at `origin`: for a one-time link, the
 * `file://` address of a page in `folder` that leads to it, written mode 0600 in a 0700 folder,
 * with a link to click when the browser does not follow it; for another path, the path itself.
 */
export function browserAddress(folder: string, origin: string, path: string): string {
  const token = LINK_PATH.exec(path)?.[1];
  if (token === undefined) {
    return `${origin}${path}`;
  }
  const link = attribute(`${origin}${path}`);
  const page = pagePath(folder, token);
  mkdirSync(folder, { mode: 0o700, recursive: true });
  for (const made of [join(folder, ".."), folder]) {
    chmodSync(made, 0o700);
  }
  rmSync(page, { force: true });
  writeFileSync(
    page,
    `<!doctype html>\n<meta charset="utf-8">\n<meta http-equiv="refresh" content="0;url=${link}">\n` +
      `<title>Uraeda</title>\n<p><a href="${link}">Open Uraeda</a></p>\n`,
    { flag: "wx", mode: 0o600 },
  );
  return pathToFileURL(page).href;
}

/**
 * The one-time links made and not used yet, in memory only: a link is a 32-byte token and the path
 * it leads to, used once, within 5 minutes. With `pages`, the folder of their pages, a link's page
 * is removed once it is used or expires, and every page as the server stops.
 */
export class OneTimeLinks {
  private readonly links = new Map<string, { expires: number; to: string }>();
  private readonly now: () => number;
  private readonly pages: string | undefined;

  constructor(now: () => number = Date.now, pages?: string) {
    this.now = now;
    this.pages = pages;
  }

  /** A new link to `to`, its path on the server: `/session/<token>?to=<to>`. */
  make(to: string): string {
    this.sweep();
    const token = randomToken(32);
    this.links.set(token, { expires: this.now() + LINK_MS, to });
    return `/session/${token}?to=${encodeURIComponent(to).replaceAll("%2F", "/")}`;
  }

  /** The path a link leads to, the first time it is used within 5 minutes; undefined after. */
  use(token: string): string | undefined {
    const link = this.links.get(token);
    if (link !== undefined) {
      this.#end(token);
    }
    return link !== undefined && link.expires >= this.now() ? link.to : undefined;
  }

  /** Ends the links past their 5 minutes. */
  sweep(): void {
    const now = this.now();
    for (const [token, link] of this.links) {
      if (link.expires < now) {
        this.#end(token);
      }
    }
  }

  /** Ends every link, as the server stops. */
  close(): void {
    for (const token of this.links.keys()) {
      this.#end(token);
    }
  }

  #end(token: string) {
    this.links.delete(token);
    if (this.pages !== undefined) {
      rmSync(pagePath(this.pages, token), { force: true });
    }
  }
}
