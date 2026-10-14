import { useEffect, useRef } from "react";

/** The overlay a history entry was pushed for, by its label. */
export function overlayOf(state: unknown): string | undefined {
  return (state as { overlay?: string } | null)?.overlay;
}

/**
 * A history entry for an open overlay, named by its label, so Back closes it. Returns what closes
 * it from the overlay itself: going back over its entry, which calls `onClose`. The entry is
 * pushed once per opening, whatever the label becomes while open; an overlay opened again while
 * its closing still goes back over its entry waits for that, then pushes a new one.
 */
export function useBackCloses(label: string, isOpen: boolean, onClose: () => void): () => void {
  // The label of the entry this overlay pushed, while it is in the history.
  const entry = useRef<string>(undefined);
  // Whether a Back this overlay started has not landed yet.
  const leaving = useRef(false);
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
        leaving.current = true;
        window.history.back();
      }
      if (!leaving.current) {
        return;
      }
      const onLanded = () => {
        leaving.current = false;
      };
      window.addEventListener("popstate", onLanded, { once: true });
      return () => window.removeEventListener("popstate", onLanded);
    }
    const push = () => {
      const name = labelRef.current;
      if (overlayOf(window.history.state) !== name) {
        window.history.pushState({ overlay: name }, "");
      }
      entry.current = name;
    };
    if (!leaving.current) {
      push();
    }
    const onPop = () => {
      if (leaving.current) {
        // The Back of its last closing landed: the overlay, open again, takes a new entry.
        leaving.current = false;
        push();
        return;
      }
      if (overlayOf(window.history.state) !== entry.current) {
        entry.current = undefined;
        onCloseRef.current();
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
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
