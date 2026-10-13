import {
  type ComponentProps,
  type MouseEvent,
  type RefObject,
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
  | { page: "missing"; path: string };

const CHANGE = "uraeda:navigate";

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
export type Entry = {
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

/** Opens a page of the UI: the positions on the current one are saved first, for Back. */
export function navigate(path: string, state?: { from?: string }) {
  const opener = window.scrollY;
  saveScroll();
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
 * drawn, and keeps it saved: on `pagehide`, and at most every 500 ms while scrolling.
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
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pagehide", save);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pagehide", save);
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

/** The location's query, `?…`, or "": a page reads its options from it, like the session's message. */
export function useSearch(): string {
  return useSyncExternalStore(subscribe, () => window.location.search);
}

/**
 * The route to draw: it follows the location a step behind, so a page that loads keeps the one
 * before it on screen until it is drawn, instead of "Loading…".
 */
export function useRoute(): { route: Route; pathname: string } {
  const pathname = useDeferredValue(usePathname());
  return { route: parseRoute(pathname), pathname };
}

/** Whether a link opens a page of the UI: a path of this origin, in this tab. */
function inApp(href: string | undefined, target: string | undefined): href is string {
  return (
    !!href &&
    href.startsWith("/") &&
    !href.startsWith("//") &&
    !/^\/(raw|mockups)\//.test(href) &&
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
        // The page a link was followed from, which a task view shows beside it on wide screens. A
        // task view's link is followed from the list beside it, which it carries on.
        const here = window.location.pathname;
        navigate(href, { from: parseRoute(here).page === "task" ? currentEntry().from : here });
      }}
    />
  );
}

/** The page of a file of the repository, from its path from the top level. */
export function pathLink(path: string): { href: string; inApp: boolean } {
  const [, hash = ""] = path.split("#");
  const file = path.split("#")[0];
  // A feature's folder is in `specs/`, a bug's in `specs/bugs/`: both open at `/f/<folder>`.
  const feature = /^specs\/(?:bugs\/)?(\d{4}-\d{2}-\d{2}-[^/]+)\/([^/]+\.md)$/.exec(file);
  if (feature) {
    return { href: `/f/${feature[1]}/${feature[2]}${hash ? `#${hash}` : ""}`, inApp: true };
  }
  if (/^specs\/(drafts|backlog)\/.+\.md$/.test(file)) {
    return { href: `/edit/${file}`, inApp: true };
  }
  if (file.endsWith(".html")) {
    return { href: `/mockups/${file}`, inApp: false };
  }
  return { href: `/raw/${file}`, inApp: false };
}
