import { type MouseEvent, type ReactNode, useSyncExternalStore } from "react";

/** The UI's pages, from the location's path. */
export type Route =
  | { page: "home" }
  | { page: "feature"; folder: string }
  | { page: "file"; folder: string; name: string }
  | { page: "priorities" }
  | { page: "edit"; path: string }
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
  if (parts[0] === "priorities" && parts.length === 1) {
    return { page: "priorities" };
  }
  if (parts[0] === "edit" && parts.length > 1) {
    return { page: "edit", path: parts.slice(1).join("/") };
  }
  return { page: "missing", path: pathname };
}

export function navigate(path: string) {
  window.history.pushState(null, "", path);
  window.scrollTo?.(0, 0);
  window.dispatchEvent(new Event(CHANGE));
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

export function useRoute(): Route {
  return parseRoute(usePathname());
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
