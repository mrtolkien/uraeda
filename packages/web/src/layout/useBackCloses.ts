import { useEffect, useRef } from "react";

/** The overlay a history entry was pushed for, by its label. */
export function overlayOf(state: unknown): string | undefined {
  return (state as { overlay?: string } | null)?.overlay;
}

/**
 * The Backs that overlays closed by their owner started, and that have not landed yet: every
 * overlay opened meanwhile, the same or another, waits for them before it pushes its entry.
 */
let pendingBacks = 0;
/** Whether the `popstate` being handled is the landing of one of those Backs. */
let landing = false;
/** The overlays' own `popstate` handlers, called after the count is updated. */
const handlers = new Set<() => void>();

function onPopState() {
  landing = pendingBacks > 0;
  if (landing) {
    pendingBacks -= 1;
  }
  // The overlays open now: one opened by a handler waits for the next `popstate`.
  for (const handler of Array.from(handlers)) {
    handler();
  }
  landing = false;
  listen();
}

/** Listens to `popstate` while an overlay is open or a Back is under way, and only then. */
function listen() {
  const needed = handlers.size > 0 || pendingBacks > 0;
  window.removeEventListener("popstate", onPopState);
  if (needed) {
    window.addEventListener("popstate", onPopState);
  }
}

/**
 * A history entry for an open overlay, named by its label, so Back closes it. Returns what closes
 * it from the overlay itself: going back over its entry, which calls `onClose`. The entry is
 * pushed once per opening, whatever the label becomes while open; an overlay opened while the
 * closing of any overlay still goes back over its entry waits for that, then pushes a new one.
 */
export function useBackCloses(label: string, isOpen: boolean, onClose: () => void): () => void {
  // The label of the entry this overlay pushed, while it is in the history.
  const entry = useRef<string>(undefined);
  const labelRef = useRef(label);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    labelRef.current = label;
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) {
      // Closed by its owner, after a form's success: its history entry goes too.
      const pushed = entry.current;
      entry.current = undefined;
      if (pushed !== undefined && overlayOf(window.history.state) === pushed) {
        pendingBacks += 1;
        listen();
        window.history.back();
      }
      return;
    }
    const push = () => {
      const name = labelRef.current;
      if (overlayOf(window.history.state) !== name) {
        window.history.pushState({ overlay: name }, "");
      }
      entry.current = name;
    };
    let waiting = pendingBacks > 0;
    if (!waiting) {
      push();
    }
    const onPop = () => {
      if (waiting) {
        // The Backs of the last closings landed: the overlay takes its entry.
        if (pendingBacks === 0) {
          waiting = false;
          push();
        }
        return;
      }
      if (landing) {
        // Another overlay's closing, over an entry above this one's.
        return;
      }
      if (overlayOf(window.history.state) !== entry.current) {
        entry.current = undefined;
        onCloseRef.current();
      }
    };
    handlers.add(onPop);
    listen();
    return () => {
      handlers.delete(onPop);
      listen();
    };
  }, [isOpen]);

  // Closing goes back over the overlay's own entry, which closes it.
  return () => {
    if (entry.current !== undefined && overlayOf(window.history.state) === entry.current) {
      window.history.back();
    } else {
      onClose();
    }
  };
}
