import { createContext, useContext, useDeferredValue, useSyncExternalStore } from "react";
import { CHANGE, currentEntry, navigate } from "./routeHistory.ts";
import { localPath, parseLocation, repoPath, type Route } from "./routeTable.ts";

export {
  branchDecisionPath,
  localPath,
  type NewKind,
  parseLocation,
  parseRoute,
  repoPath,
  type Route,
  sessionIdPath,
} from "./routeTable.ts";

export {
  currentEntry,
  navigate,
  redirect,
  setLeaveGuard,
  updateEntry,
  useRestorePaneScroll,
  useRestoreScroll,
} from "./routeHistory.ts";

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
