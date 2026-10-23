import { createContext, useContext, useDeferredValue, useSyncExternalStore } from "react";
import { MAIN_CHECKOUT } from "./data.ts";
import { CHANGE, currentEntry, navigate } from "./routeHistory.ts";

export {
  currentEntry,
  navigate,
  redirect,
  setLeaveGuard,
  updateEntry,
  useRestorePaneScroll,
  useRestoreScroll,
} from "./routeHistory.ts";

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
  | { page: "edit"; path: string }
  | { folder: string; name: string; page: "mockup" }
  | { folder: string; page: "session" }
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

/** The repository of the page tree, set by `App`. */
export const RepositoryContext = createContext<string | null>(null);

/** The repository of the page drawn: its pages build every path with it. */
export function useRepository(): string {
  const repo = useContext(RepositoryContext);
  if (repo === null) {
    throw new Error("A repository's page is drawn outside its repository");
  }
  return repo;
}

/** The folder of the page tree's repository, set by `App`: what keeps its unsaved text apart. */
export const RepositoryPathContext = createContext<string | null>(null);

/** The folder of the repository of the page drawn. */
export function useRepositoryPath(): string {
  const path = useContext(RepositoryPathContext);
  if (path === null) {
    throw new Error("A repository's page is drawn outside its repository");
  }
  return path;
}

/** Builds the paths of the current repository's pages and files, from their path within it. */
export function useRepoPath(): (path: string) => string {
  const repo = useRepository();
  return (path) => repoPath(repo, path);
}

/**
 * Opens a page of the repository the location is in, from its path within it: for a call made
 * outside a component, after the human acted on the page.
 */
export function navigateHere(path: string, state?: { from?: string }) {
  const { repo } = parseLocation(window.location.pathname);
  navigate(repo === null ? path : repoPath(repo, path), state);
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

/** Calls `onChange` each time the location changes, by Back or by the UI; returns the unsubscribe. */
export function subscribeLocation(onChange: () => void) {
  window.addEventListener("popstate", onChange);
  window.addEventListener(CHANGE, onChange);
  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener(CHANGE, onChange);
  };
}

export function usePathname(): string {
  return useSyncExternalStore(subscribeLocation, () => window.location.pathname);
}

/** The location's path within its repository: what a page compares its links' paths with. */
export function useLocalPath(): string {
  return localPath(usePathname());
}

/** The location's hash, `#…`, or "": a page scrolls to the block it names. */
export function useHash(): string {
  return useSyncExternalStore(subscribeLocation, () => window.location.hash);
}

/**
 * The current history entry's id: a new visit of the page's own address, through a link, changes it
 * though the location does not.
 */
export function useEntryId(): string | undefined {
  return useSyncExternalStore(subscribeLocation, () => currentEntry().id);
}

/** The location's query, `?…`, or "": a page reads its options from it, like the session's message. */
export function useSearch(): string {
  return useSyncExternalStore(subscribeLocation, () => window.location.search);
}

/**
 * The route to draw: it follows the location a step behind, so a page that loads keeps the one
 * before it on screen until it is drawn, instead of "Loading…".
 */
export function useRoute(): { pathname: string; repo: string | null; route: Route } {
  const pathname = useDeferredValue(usePathname());
  const search = useDeferredValue(useSearch());
  return { ...parseLocation(pathname, search), pathname };
}
