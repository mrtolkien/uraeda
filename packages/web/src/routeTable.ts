// The UI's route table: the pages a location names, and the paths the pages build. Its own module,
// imported by the routes' hooks and by the route history, so neither imports the other's table.
import { MAIN_CHECKOUT } from "./data.ts";

/** The UI's pages, from the location's path. */
export type Route =
  | { page: "home" }
  | { folder: string; page: "feature" }
  | { folder: string; name: string; page: "file" }
  | { page: "priorities" }
  | { key: string; page: "task" }
  | { page: "inbox" }
  | { key: string; page: "note" }
  | { page: "triage" }
  | { page: "decisions" }
  | { page: "decisions-check" }
  | { name: string; page: "decision" }
  | { folder: string; name: string; page: "branch-decision" }
  | { page: "principle"; slug: string }
  | { page: "commit" }
  | { page: "edit"; path: string }
  | { folder: string; name: string; page: "mockup" }
  | { folder: string; page: "session" }
  // Kept for the story page, or a redirect Home when it has no story (R6).
  // Kept: it draws a story page, or redirects Home when it names no story (R6).
  | { folder: string; page: "storybook" }
  | { folder: string; id: string; page: "run" }
  | { id: string; page: "session-id" }
  | { page: "sessions" }
  | { kind: NewKind; page: "new" }
  | { page: "moved"; path: string }
  | { page: "first-run" }
  | { category?: string; page: "settings" }
  | { page: "missing"; path: string };

/** What the New page starts: a session, a change, or a feature. */
export type NewKind = "change" | "feature" | "session";

/** A repository's prefix, `/r/<name>`, and the page's path after it. */
const PREFIX = /^\/r\/([^/]+)(\/.*)?$/;

/**
 * The repository a location names, and its page: a page path without `/r/<name>`, like links from
 * before repositories had names, parses with `repo: null`.
 */
export function parseLocation(
  pathname: string,
  search = "",
): { repo: string | null; route: Route } {
  const prefixed = PREFIX.exec(pathname);
  if (!prefixed) {
    return { repo: null, route: parseRoute(pathname, search) };
  }
  return { repo: decodeURIComponent(prefixed[1]), route: parseRoute(prefixed[2] ?? "/", search) };
}

/** A location's path within its repository: `/r/uraeda/priorities` is `/priorities`. */
export function localPath(pathname: string): string {
  const prefixed = PREFIX.exec(pathname);
  return prefixed ? (prefixed[2] ?? "/") : pathname;
}

/** A page or a file of a repository, from its path within it: every link the pages build. */
export function repoPath(repo: string, path: string): string {
  return `/r/${encodeURIComponent(repo)}${path}`;
}

/** A page's path within its repository, as `parseRoute` reads it, with its query, `?…`. */
export function parseRoute(pathname: string, search = ""): Route {
  const parts = pathname.split("/").filter(Boolean).map(decodeURIComponent);
  if (parts.length === 0) {
    return { page: "home" };
  }
  if (parts[0] === "f" && parts.length === 2) {
    return { folder: parts[1], page: "feature" };
  }
  if (parts[0] === "f" && parts.length === 3 && parts[2] === "session") {
    return { folder: parts[1], page: "session" };
  }
  if (parts[0] === "f" && parts.length === 3 && parts[2] === "storybook") {
    return { folder: parts[1], page: "storybook" };
  }
  if (parts[0] === "f" && parts.length === 3) {
    return { folder: parts[1], name: parts[2], page: "file" };
  }
  if (parts[0] === "f" && parts.length === 4 && parts[2] === "mockups") {
    return { folder: parts[1], name: parts[3], page: "mockup" };
  }
  if (parts[0] === "f" && parts.length === 4 && parts[2] === "decisions") {
    return { folder: parts[1], name: parts[3], page: "branch-decision" };
  }
  if (parts[0] === "f" && parts.length === 4 && parts[2] === "runs") {
    return { folder: parts[1], id: parts[3], page: "run" };
  }
  if (parts[0] === "commit" && parts.length === 1) {
    return { page: "commit" };
  }
  if (parts[0] === "sessions" && parts.length === 1) {
    return { page: "sessions" };
  }
  if (parts[0] === "sessions" && parts.length === 2) {
    return { id: parts[1], page: "session-id" };
  }
  if (parts[0] === "new" && parts.length === 1) {
    return { kind: newKind(search), page: "new" };
  }
  // The addresses from before sessions, kept so links in old transcripts still open.
  if (parts[0] === "chats" && parts.length === 2) {
    return { page: "moved", path: parts[1] === "new" ? "/new" : sessionIdPath(parts[1]) };
  }
  if (parts[0] === "changes" && parts.length === 2 && parts[1] === "new") {
    return { page: "moved", path: "/new?kind=change" };
  }
  if (parts[0] === "storybook" && parts.length === 1) {
    return { folder: MAIN_CHECKOUT, page: "storybook" };
  }
  if (parts[0] === "priorities" && parts.length === 1) {
    return { page: "priorities" };
  }
  if (parts[0] === "priorities" && parts.length === 2) {
    return { key: parts[1], page: "task" };
  }
  if (parts[0] === "inbox" && parts.length === 1) {
    return { page: "inbox" };
  }
  if (parts[0] === "inbox" && parts.length === 2) {
    return parts[1] === "triage" ? { page: "triage" } : { key: parts[1], page: "note" };
  }
  if (parts[0] === "settings" && parts.length <= 2) {
    return parts[1] === undefined ? { page: "settings" } : { category: parts[1], page: "settings" };
  }
  if (parts[0] === "decisions" && parts.length <= 3) {
    return decisionsRoute(parts, pathname);
  }
  if (parts[0] === "edit" && parts.length > 1) {
    return { page: "edit", path: parts.slice(1).join("/") };
  }
  return { page: "missing", path: pathname };
}

/** A session's page, by its id. */
export function sessionIdPath(id: string): string {
  return `/sessions/${encodeURIComponent(id)}`;
}

/** The New page's kind, from its query: Session when it names none, or one it does not know. */
function newKind(search: string): NewKind {
  const kind = new URLSearchParams(search).get("kind");
  return kind === "change" || kind === "feature" ? kind : "session";
}

/** The page of decision `name` as the branch of the feature in `folder` has it, with its change. */
export function branchDecisionPath(folder: string, name: string): string {
  return `/f/${encodeURIComponent(folder)}/decisions/${encodeURIComponent(name)}`;
}

/** `/decisions`, `/decisions/check`, `/decisions/<name>`, or `/decisions/constitution/<slug>`. */
function decisionsRoute(parts: Array<string>, pathname: string): Route {
  if (parts.length === 1) {
    return { page: "decisions" };
  }
  if (parts.length === 2 && parts[1] === "check") {
    return { page: "decisions-check" };
  }
  if (parts.length === 2) {
    return { name: parts[1], page: "decision" };
  }
  return parts[1] === "constitution"
    ? { page: "principle", slug: parts[2] }
    : { page: "missing", path: pathname };
}
