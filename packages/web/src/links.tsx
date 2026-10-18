// The links of the UI's pages: the anchor every Astryx link draws, and the page of a repository's
// file.
import type { ComponentProps, MouseEvent } from "react";
import {
  branchDecisionPath,
  currentEntry,
  localPath,
  navigate,
  parseLocation,
  repoPath,
} from "./routes.tsx";

/** Whether a link opens a page of the UI: a path of this origin, in this tab. */
function inApp(href: string | undefined, target: string | undefined): href is string {
  return (
    !!href &&
    href.startsWith("/") &&
    !href.startsWith("//") &&
    !/^\/(r\/[^/]+\/)?(raw|mockups|images|chat-images|preview)\//.test(href) &&
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
  onClick,
  to: _to,
  ...props
}: {
  href?: string;
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
  to?: string;
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

/**
 * The page of a file of the repository `repo`, from its path from the top level, at `anchor`, the
 * part of its link after `#`, when given. A decision linked from an item's file, `from`, opens as
 * that item's branch has it; from anywhere else, on the decisions page, as the default branch has
 * it.
 */
export function pathLink(
  path: string,
  repo: string,
  anchor?: string,
  from?: { folder: string },
): { href: string; inApp: boolean } {
  const [file = "", hash = anchor ?? ""] = path.split("#");
  const at = (local: string) => repoPath(repo, local);
  const marked = hash ? `#${hash}` : "";
  // The one TypeScript copy of the core's folder rule, a link having no feature view: a feature's
  // folder is in `specs/`, a change's in `specs/changes/`, and both open at `/f/<folder>`.
  const feature = /^specs\/(?:changes\/)?(\d{4}-\d{2}-\d{2}-[^/]+)\/([^/]+\.md)$/.exec(file);
  if (feature) {
    return { href: at(`/f/${feature[1]}/${feature[2]}${marked}`), inApp: true };
  }
  // The constitution and the decisions open on their page, not as text.
  if (file === "specs/CONSTITUTION.md") {
    return { href: at("/decisions"), inApp: true };
  }
  const decision = /^specs\/decisions\/([^/]+)\.md$/.exec(file);
  if (decision && from) {
    return { href: at(`${branchDecisionPath(from.folder, decision[1]!)}${marked}`), inApp: true };
  }
  if (decision) {
    return { href: at(`/decisions/${decision[1]}`), inApp: true };
  }
  if (/^specs\/(drafts|backlog)\/.+\.md$/.test(file)) {
    return { href: at(`/edit/${file}`), inApp: true };
  }
  // The mockup route serves only the files of a `mockups` folder, as the server's rule.
  if (file.endsWith(".html") && file.split("/").slice(0, -1).includes("mockups")) {
    return { href: at(`/mockups/${file}`), inApp: false };
  }
  return { href: at(`/raw/${file}`), inApp: false };
}
