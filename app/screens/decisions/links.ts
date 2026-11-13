// Where a link of a decision or of the constitution goes, inside the app: a decision links other
// decisions, the constitution, a feature's files, done records, and code. A web address is the
// document's own to open, in the system's browser.
import { navigate, redirect, route, type Route } from "../../store";
import type { SpanLink } from "../../store/protocol";

/** A feature's or a change's file: `specs/<folder>/<name>.md`, `specs/changes/<folder>/<name>.md`. */
const FEATURE_FILE = /^specs\/(?:changes\/)?(\d{4}-\d{2}-\d{2}-[^/]+)\/([^/]+\.md)$/;
const DECISION = /^specs\/decisions\/([^/]+)\.md$/;

/**
 * The page of a file of the repository, from its path from the top level. A decision linked from a
 * decision as a feature's branch has it, `folder`, opens as that branch has it, as its own links
 * mean. Every other file, a done record's or code, opens in the buffer's page (task 47).
 */
export function pageOfPath(path: string, folder?: string): Route {
  if (path === "specs/CONSTITUTION.md") {
    return { page: "constitution" };
  }
  const decision = DECISION.exec(path);
  if (decision) {
    const name = decision[1]!;
    return folder === undefined
      ? { name, page: "decision" }
      : { folder, name, page: "branch-decision" };
  }
  const file = FEATURE_FILE.exec(path);
  if (file) {
    return { folder: file[1]!, name: file[2]!, page: "file" };
  }
  return { page: "buffer", path };
}

/**
 * Follows a link of a document read in the decisions' panes: to its page, at its heading, or to a
 * heading of the page shown, which stays the same visit.
 */
export function follow(link: SpanLink, folder?: string) {
  const hash = link.anchor ?? undefined;
  if (link.path === null) {
    if (hash !== undefined || link.target.startsWith("#")) {
      redirect({ ...route(), hash: hash ?? link.target.slice(1) });
    }
    return;
  }
  navigate({ ...pageOfPath(link.path, folder), ...(hash === undefined ? {} : { hash }) });
}
