import { useEffect } from "react";
import { currentEntry, setLeaveGuard, subscribeLocation } from "../routes.tsx";
import { type ConfirmOptions, useConfirm } from "./Confirm.tsx";
import { hasDrawnUnsaved, useHasDrawnUnsaved } from "./unsaved.ts";

/** What leaving a page that holds unsaved text asks, by a link, `navigate`, or Back. */
export const LEAVE_PAGE: ConfirmOptions = {
  body: "Your unsaved text stays in this browser, and comes back when you return.",
  cancel: "Stay",
  confirm: "Leave page",
  title: "Leave page?",
};

/** The question, while `LeaveGuard` is drawn: `undefined` when no field drawn holds unsaved text. */
let check: (() => Promise<boolean> | undefined) | undefined;

/** The page's own history entry, not an overlay's above it: what Back puts back to stay. */
let shown = { state: window.history.state as unknown, url: window.location.href };
/** Set once the human chose to leave by Back: the Back that leaves is not asked about again. */
let leaving = false;

/**
 * Back to another page while a field drawn holds unsaved text: the entry left comes back above the
 * one reached, before the pages and the overlays see the change, and the human is asked; "Leave
 * page" goes back. Back over an overlay's entry, which keeps the page's address, closes it and
 * never asks, nor does the Back that leaves.
 */
function guardBack(event: PopStateEvent) {
  const left = new URL(shown.url);
  const samePage =
    left.pathname === window.location.pathname && left.search === window.location.search;
  const asking = leaving || samePage ? undefined : check?.();
  leaving = false;
  if (!asking) {
    return;
  }
  event.stopImmediatePropagation();
  window.history.pushState(shown.state, "", shown.url);
  void asking.then((leave) => {
    if (leave) {
      leaving = true;
      window.history.back();
    }
  });
}

/** Keeps the current history entry as the page's, unless it is an overlay's. */
function remember() {
  if (currentEntry().overlay === undefined) {
    shown = { state: window.history.state, url: window.location.href };
  }
}

// Before every other listener: the pages' and the overlays' are added as they are drawn.
window.addEventListener("popstate", guardBack);
subscribeLocation(remember);

/**
 * Asks before the page is left while a field drawn holds unsaved text: the app's "Leave page?" for
 * a link, `navigate`, or Back, and the browser's prompt for a reload or a closed tab, through a
 * `beforeunload` listener that exists only then. Drawn once, in `App`, inside `ConfirmHost`.
 */
export function LeaveGuard() {
  const confirm = useConfirm();
  const unsaved = useHasDrawnUnsaved();

  useEffect(() => {
    // The entry the app is drawn on.
    remember();
    check = () => (hasDrawnUnsaved() ? confirm(LEAVE_PAGE) : undefined);
    setLeaveGuard(check);
    return () => {
      check = undefined;
      setLeaveGuard(undefined);
    };
  }, [confirm]);

  useEffect(() => {
    if (!unsaved) {
      return;
    }
    const ask = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Browsers before the standard prompt asked only once this was set.
      event.returnValue = true;
    };
    window.addEventListener("beforeunload", ask);
    return () => window.removeEventListener("beforeunload", ask);
  }, [unsaved]);

  return null;
}
