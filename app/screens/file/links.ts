// Where a link of a workflow file goes, inside the app: a heading of the page, in place; another
// file of the feature, at its heading; a decision as the feature's branch has it; a mockup; and
// any other file, code included, in the buffer's page. A web address is the document's own to
// open, in the system's browser.
import { navigate, type Route } from "../../store";
import type { Document, SpanLink } from "../../store/protocol";
import { pageOfPath } from "../decisions/links";
import { jumpTo } from "./place";
import type { FileArgs } from "./read";

/** A prototype of a feature's folder: `specs/<folder>/mockups/<name>`. */
const MOCKUP = /^specs\/(?:changes\/)?(\d{4}-\d{2}-\d{2}-[^/]+)\/mockups\/([^/]+)$/;

/** The heading of `tree` with this anchor. */
export const headingAt = (tree: Document, anchor: string) =>
  tree.blocks.find((block) => block.kind === "heading" && block.anchor === anchor);

/** The page of a path of the repository, read from a file of the feature in `folder`. */
function pageOf(path: string, folder: string): Route {
  const mockup = MOCKUP.exec(path);
  if (mockup) return { folder: mockup[1]!, name: mockup[2]!, page: "mockup" };
  return pageOfPath(path, folder);
}

/** Follows a link of the file `args`, at `path`, whose shown tree is `tree`. */
export function follow(link: SpanLink, args: FileArgs, path: string, tree: Document) {
  const anchor = link.anchor ?? (link.target.startsWith("#") ? link.target.slice(1) : undefined);
  if (link.path === null || link.path === path) {
    const heading = anchor === undefined ? undefined : headingAt(tree, anchor);
    if (heading !== undefined) jumpTo(args, heading.id);
    return;
  }
  // TASK 49: a story link opens its story live, in the previews' panes; until then its file.
  const target = link.story?.path ?? link.path;
  navigate({ ...pageOf(target, args.folder), ...(anchor === undefined ? {} : { hash: anchor }) });
}
