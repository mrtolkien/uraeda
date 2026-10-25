import { type RefObject, useEffect, useLayoutEffect, useRef } from "react";
import { parseLocation } from "./routeTable.ts";

/** The event `navigate` and `redirect` send as they change the location. */
export const CHANGE = "uraeda:navigate";

/**
 * What a history entry holds: its own id, the page's scroll position once left, the detail pane's
 * scroll position on wide screens (see `layout/Panes.tsx`), the path of the page it was opened
 * from and that page's scroll position then, an open overlay's label (see `layout/Overlay.tsx`),
 * and the folds opened in a view (see `useOpenKeys.ts`).
 */
type Entry = {
  /** The count of rows a session's Activity draws, kept so Back draws as many. */
  activity?: number;
  /** A chat its first message just created, on the page it left: its first turn is news. */
  created?: boolean;
  from?: string;
  id?: string;
  open?: Array<string>;
  opener?: number;
  overlay?: string;
  pane?: number;
  scroll?: number;
  /** The count of messages a session's transcript draws, kept so Back draws as many. */
  shown?: number;
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
 * Goes to an anchor of the page, as a link to it does, in a new history entry: the page opens what
 * the anchor names, like a fold, as for any link to it. The page stays where it is, its position
 * saved for Back; the caller brings the anchor into view.
 */
export function openAnchor(anchor: string) {
  saveScroll();
  window.history.pushState({ id: newId() }, "", `#${anchor}`);
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
