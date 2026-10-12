import {
  type ComponentProps,
  type MouseEvent,
  type ReactNode,
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
  if (parts[0] === "f" && parts.length === 3) {
    return { page: "file", folder: parts[1], name: parts[2] };
  }
  if (parts[0] === "f" && parts.length === 4 && parts[2] === "mockups") {
    return { page: "mockup", folder: parts[1], name: parts[3] };
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
 * What a history entry holds: its own id, the page's scroll position once left, the path of the
 * page it was opened from and that page's scroll position then, and an open overlay's label (see
 * `layout/Overlay.tsx`).
 */
export type Entry = {
  id?: string;
  scroll?: number;
  from?: string;
  opener?: number;
  overlay?: string;
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

/** Saves the page's scroll position in the current history entry. */
function saveScroll() {
  window.history.replaceState({ ...entry(), scroll: window.scrollY }, "");
}

/** Opens a page of the UI: the position on the current one is saved first, for Back. */
export function navigate(path: string, state?: { from?: string }) {
  const opener = window.scrollY;
  saveScroll();
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

/**
 * The route to draw: it follows the location a step behind, so a page that loads keeps the one
 * before it on screen until it is drawn, instead of "Loading…".
 */
export function useRoute(): { route: Route; pathname: string } {
  const pathname = useDeferredValue(usePathname());
  return { route: parseRoute(pathname), pathname };
}

/** A link inside the UI: it navigates without reloading the page. */
export function Link({
  to,
  className,
  children,
}: {
  to: string;
  className?: string;
  children: ReactNode;
}) {
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) {
      return;
    }
    event.preventDefault();
    navigate(to);
  };
  return (
    <a href={to} className={className} onClick={onClick}>
      {children}
    </a>
  );
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
        // The page a link was followed from, which a task view shows beside it on wide screens.
        navigate(href, { from: window.location.pathname });
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
