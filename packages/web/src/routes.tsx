import {
  type ComponentProps,
  createContext,
  type MouseEvent,
  type RefObject,
  useContext,
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
} from "react";

/** The UI's pages, from the location's path. */
export type Route =
  | { page: "home" }
  | { page: "feature"; folder: string }
  | { page: "file"; folder: string; name: string }
  | { page: "priorities" }
  | { page: "task"; key: string }
  | { page: "edit"; path: string }
  | { page: "mockup"; folder: string; name: string }
  | { page: "session"; folder: string }
  | { page: "run"; folder: string; id: string }
  | { page: "chat"; id: string }
  | { page: "new-chat" }
  | { page: "first-run" }
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
    return { page: "feature", folder: parts[1] };
  }
  if (parts[0] === "f" && parts.length === 3 && parts[2] === "session") {
    return { page: "session", folder: parts[1] };
  }
  if (parts[0] === "f" && parts.length === 3) {
    return { page: "file", folder: parts[1], name: parts[2] };
  }
  if (parts[0] === "f" && parts.length === 4 && parts[2] === "mockups") {
    return { page: "mockup", folder: parts[1], name: parts[3] };
  }
  if (parts[0] === "f" && parts.length === 4 && parts[2] === "runs") {
    return { page: "run", folder: parts[1], id: parts[3] };
  }
  if (parts[0] === "chats" && parts.length === 2) {
    return parts[1] === "new" ? { page: "new-chat" } : { page: "chat", id: parts[1] };
  }
  if (parts[0] === "priorities" && parts.length === 1) {
    return { page: "priorities" };
  }
  if (parts[0] === "priorities" && parts.length === 2) {
    return { page: "task", key: parts[1] };
  }
  if (parts[0] === "edit" && parts.length > 1) {
    return { page: "edit", path: parts.slice(1).join("/") };
  }
  return { page: "missing", path: pathname };
}

/**
 * What a history entry holds: its own id, the page's scroll position once left, the detail pane's
 * scroll position on wide screens (see `layout/Panes.tsx`), the path of the page it was opened
 * from and that page's scroll position then, an open overlay's label (see `layout/Overlay.tsx`),
 * and the groups of tool calls opened in a session's transcript, by their turn and first call.
 */
type Entry = {
  id?: string;
  scroll?: number;
  pane?: number;
  from?: string;
  opener?: number;
  overlay?: string;
  open?: Array<string>;
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

/** Opens a page of the UI: the positions on the current one are saved first, for Back. */
export function navigate(path: string, state?: { from?: string }) {
  const opener = window.scrollY;
  saveScroll();
  left = entry().id;
  for (const save of savers) {
    save();
  }
  window.history.pushState({ ...state, opener, id: newId() }, "", path);
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

function subscribe(onChange: () => void) {
  window.addEventListener("popstate", onChange);
  window.addEventListener(CHANGE, onChange);
  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener(CHANGE, onChange);
  };
}

export function usePathname(): string {
  return useSyncExternalStore(subscribe, () => window.location.pathname);
}

/** The location's path within its repository: what a page compares its links' paths with. */
export function useLocalPath(): string {
  return localPath(usePathname());
}

/** The location's query, `?…`, or "": a page reads its options from it, like the session's message. */
export function useSearch(): string {
  return useSyncExternalStore(subscribe, () => window.location.search);
}

/**
 * The route to draw: it follows the location a step behind, so a page that loads keeps the one
 * before it on screen until it is drawn, instead of "Loading…".
 */
export function useRoute(): { repo: string | null; route: Route; pathname: string } {
  const pathname = useDeferredValue(usePathname());
  return { ...parseLocation(pathname), pathname };
}

/** Whether a link opens a page of the UI: a path of this origin, in this tab. */
function inApp(href: string | undefined, target: string | undefined): href is string {
  return (
    !!href &&
    href.startsWith("/") &&
    !href.startsWith("//") &&
    !/^\/(r\/[^/]+\/)?(raw|mockups)\//.test(href) &&
    (!target || target === "_self")
  );
}

/**
 * The anchor Astryx components draw for a link, given to them all by `LinkProvider` in `App`: a page
 * of the UI opens through `navigate`, without reloading; any other link, like a file in a new tab
 * or an anchor in the page, is left to the browser.
 */
export function RouterAnchor({
  href,
  to: _to,
  onClick,
  ...props
}: {
  href?: string;
  to?: string;
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
} & Omit<ComponentProps<"a">, "href" | "onClick">) {
  return (
    <a
      {...props}
      href={href}
      onClick={(event) => {
        onClick?.(event);
        if (
          event.defaultPrevented ||
          !inApp(href, props.target) ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.button !== 0
        ) {
          return;
        }
        event.preventDefault();
        // The page a link was followed from, within its repository, which a task view shows beside
        // it on wide screens. A task view's link is followed from the list beside it, which it
        // carries on.
        const here = window.location.pathname;
        navigate(href, {
          from: parseLocation(here).route.page === "task" ? currentEntry().from : localPath(here),
        });
      }}
    />
  );
}

/** The page of a file of the repository `repo`, from its path from the top level. */
export function pathLink(path: string, repo: string): { href: string; inApp: boolean } {
  const [, hash = ""] = path.split("#");
  const file = path.split("#")[0];
  const at = (local: string) => repoPath(repo, local);
  // A feature's folder is in `specs/`, a bug's in `specs/bugs/`: both open at `/f/<folder>`.
  const feature = /^specs\/(?:bugs\/)?(\d{4}-\d{2}-\d{2}-[^/]+)\/([^/]+\.md)$/.exec(file);
  if (feature) {
    return { href: at(`/f/${feature[1]}/${feature[2]}${hash ? `#${hash}` : ""}`), inApp: true };
  }
  if (/^specs\/(drafts|backlog)\/.+\.md$/.test(file)) {
    return { href: at(`/edit/${file}`), inApp: true };
  }
  if (file.endsWith(".html")) {
    return { href: at(`/mockups/${file}`), inApp: false };
  }
  return { href: at(`/raw/${file}`), inApp: false };
}
