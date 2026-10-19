import {
  createContext,
  type RefObject,
  useContext,
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
} from "react";
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
  | { page: "edit"; path: string }
  | { folder: string; name: string; page: "mockup" }
  | { folder: string; page: "session" }
  | { folder: string; page: "storybook" }
  | { folder: string; id: string; page: "run" }
  | { id: string; page: "chat" }
  | { page: "new-chat" }
  | { page: "new-change" }
  | { page: "first-run" }
  | { category?: string; page: "settings" }
  | { page: "missing"; path: string };

const CHANGE = "uraeda:navigate";

/** A repository's prefix, `/r/<name>`, and the page's path after it. */
const PREFIX = /^\/r\/([^/]+)(\/.*)?$/;

/**
 * The repository a location names, and its page: a page path without `/r/<name>`, like links from
 * before repositories had names, parses with `repo: null`.
 */
export function parseLocation(pathname: string): { repo: string | null; route: Route } {
  const prefixed = PREFIX.exec(pathname);
  if (!prefixed) {
    return { repo: null, route: parseRoute(pathname) };
  }
  return { repo: decodeURIComponent(prefixed[1]), route: parseRoute(prefixed[2] ?? "/") };
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

/** A page's path within its repository, as `parseRoute` reads it. */
export function parseRoute(pathname: string): Route {
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
  if (parts[0] === "chats" && parts.length === 2) {
    return parts[1] === "new" ? { page: "new-chat" } : { id: parts[1], page: "chat" };
  }
  if (parts[0] === "changes" && parts.length === 2 && parts[1] === "new") {
    return { page: "new-change" };
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

/**
 * What a history entry holds: its own id, the page's scroll position once left, the detail pane's
 * scroll position on wide screens (see `layout/Panes.tsx`), the path of the page it was opened
 * from and that page's scroll position then, an open overlay's label (see `layout/Overlay.tsx`),
 * the groups of tool calls opened in a session's transcript, by their turn and first call, and
 * whether the phone's progress line of a session is open (see `ProgressLine.tsx`).
 */
type Entry = {
  /** A chat its first message just created, on the page it left: its first turn is news. */
  created?: boolean;
  from?: string;
  id?: string;
  open?: Array<string>;
  opener?: number;
  overlay?: string;
  pane?: number;
  progress?: boolean;
  scroll?: number;
};

/** The current history entry's state. */
export function currentEntry(): Entry {
  return (window.history.state as Entry | null) ?? {};
}
const entry = currentEntry;

let ids = 0;
function newId() {
  ids += 1;
  return `${Date.now().toString(36)}-${ids}`;
}

// The pages restore their own position once drawn: the browser's would come before their data.
if ("scrollRestoration" in window.history) {
  window.history.scrollRestoration = "manual";
}
// The entry the UI opened on gets an id, kept across a reload.
if (!entry().id) {
  window.history.replaceState({ ...entry(), id: newId() }, "");
}

/**
 * What asks before the page is left while it holds unsaved text, set by `fields/LeaveGuard.tsx`:
 * `undefined` when leaving loses nothing, else the question, resolving with whether to leave.
 */
type LeaveGuard = () => Promise<boolean> | undefined;
let guard: LeaveGuard | undefined;

/** Sets what `navigate` and the links ask before leaving the page; `redirect` never asks. */
export function setLeaveGuard(next: LeaveGuard | undefined) {
  guard = next;
}

/** Merges values into the current history entry's state. */
export function updateEntry(values: Entry) {
  window.history.replaceState({ ...entry(), ...values }, "");
}

/** Saves the page's scroll position in the current history entry. */
function saveScroll() {
  window.history.replaceState({ ...entry(), scroll: window.scrollY }, "");
}

/** What saves a position of the page other than the window's, like the detail pane's. */
const savers = new Set<() => void>();

/**
 * The entry `navigate` last left, until the next page draws: its page, scrolled to the top for the
 * next one, is still shown, and takes its position back if Back returns to it (see
 * `useRestoreScroll`).
 */
let left: string | undefined;

/**
 * Whether `path` shows another priority or note beside the same list as now: the list stays, and
 * the text left unsaved in the pane comes back, with its notice, as that item opens again.
 */
function besideSameList(path: string) {
  const from = parseLocation(window.location.pathname).route.page;
  const to = parseLocation(new URL(path, window.location.href).pathname).route.page;
  return (from === "task" || from === "note") && to === from;
}

/**
 * Opens a page of the UI: the positions on the current one are saved first, for Back. A page that
 * holds unsaved text asks first, and stays if the human does, unless only its pane shows another
 * item of its list.
 */
export function navigate(path: string, state?: { created?: boolean; from?: string }) {
  const asking = besideSameList(path) ? undefined : guard?.();
  if (asking) {
    void asking.then((leave) => {
      if (leave) {
        openPage(path, state);
      }
    });
    return;
  }
  openPage(path, state);
}

function openPage(path: string, state?: { created?: boolean; from?: string }) {
  const opener = window.scrollY;
  saveScroll();
  left = entry().id;
  for (const save of savers) {
    save();
  }
  window.history.pushState({ ...state, id: newId(), opener }, "", path);
  window.scrollTo?.(0, 0);
  window.dispatchEvent(new Event(CHANGE));
}

/**
 * Shows another page in place of the current one, in the same history entry, like a task view
 * whose line was renamed: Back does not return to the address that no longer exists.
 */
export function redirect(path: string) {
  window.history.replaceState(entry(), "", path);
  window.dispatchEvent(new Event(CHANGE));
}

/**
 * Restores the scroll position saved in the page's history entry once `ready`, when its content is
 * drawn, and keeps it saved: on `pagehide`, and at most every 500 ms while scrolling. Back to it
 * before the next page draws, while it is still shown, takes its position back too.
 */
export function useRestoreScroll(ready: boolean) {
  // The entry this page was opened on: an old page still shown while the next one loads must not
  // write its position into the next one's entry.
  const id = useRef(entry().id);
  const restored = useRef(false);

  useLayoutEffect(() => {
    if (!ready || restored.current) {
      return;
    }
    restored.current = true;
    // The next page is drawn: the one left is gone.
    left = undefined;
    const { scroll } = entry();
    if (entry().id === id.current && typeof scroll === "number") {
      window.scrollTo(0, scroll);
    }
  }, [ready]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const save = () => {
      timer = undefined;
      if (restored.current && entry().id === id.current) {
        saveScroll();
      }
    };
    const onScroll = () => {
      timer ??= setTimeout(save, 500);
    };
    // Back to this page's entry while it is still shown: `navigate` scrolled it to the top, and
    // the page is not drawn again, as its address did not change in between for React.
    const onPop = () => {
      const { id: current, scroll } = entry();
      if (restored.current && current === id.current && left === current) {
        left = undefined;
        if (typeof scroll === "number") {
          window.scrollTo(0, scroll);
        }
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pagehide", save);
    window.addEventListener("popstate", onPop);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pagehide", save);
      window.removeEventListener("popstate", onPop);
    };
  }, []);
}

/**
 * Restores the scroll position of an element that scrolls on its own, like the detail pane beside a
 * list, saved in the page's history entry, once `enabled`; and keeps it saved, as the window's is:
 * when a page of the UI opens, on `pagehide`, and at most every 500 ms while scrolling.
 */
export function useRestorePaneScroll(ref: RefObject<HTMLElement | null>, enabled: boolean) {
  // The entry this pane was drawn on, as `useRestoreScroll` keeps it.
  const id = useRef(entry().id);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!enabled || !element) {
      return;
    }
    const { pane } = entry();
    if (entry().id === id.current && typeof pane === "number") {
      element.scrollTop = pane;
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const save = () => {
      clearTimeout(timer);
      timer = undefined;
      if (entry().id === id.current) {
        updateEntry({ pane: element.scrollTop });
      }
    };
    const onScroll = () => {
      timer ??= setTimeout(save, 500);
    };
    element.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pagehide", save);
    savers.add(save);
    return () => {
      clearTimeout(timer);
      savers.delete(save);
      element.removeEventListener("scroll", onScroll);
      window.removeEventListener("pagehide", save);
    };
  }, [ref, enabled]);
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
  return useSyncExternalStore(subscribeLocation, () => entry().id);
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
  return { ...parseLocation(pathname), pathname };
}
