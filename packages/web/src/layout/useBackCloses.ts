import { useEffect, useRef } from "react";

/** The overlay a history entry was pushed for, by its label. */
export function overlayOf(state: unknown): string | undefined {
  return (state as { overlay?: string } | null)?.overlay;
}

/**
 * A history entry for an open overlay, named by its label, so Back closes it. Returns what closes
 * it from the overlay itself: going back over its entry, which calls `onClose`.
 */
export function useBackCloses(label: string, isOpen: boolean, onClose: () => void): () => void {
  const pushed = useRef(false);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) {
      // Closed by its owner, after a form's success: its history entry goes too.
      if (pushed.current) {
        pushed.current = false;
        if (overlayOf(window.history.state) === label) {
          window.history.back();
        }
      }
      return;
    }
    if (overlayOf(window.history.state) !== label) {
      window.history.pushState({ overlay: label }, "");
    }
    pushed.current = true;
    const onPop = () => {
      if (overlayOf(window.history.state) !== label) {
        pushed.current = false;
        onCloseRef.current();
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [isOpen, label]);

  // Closing goes back over the overlay's own entry, which closes it.
  return () => {
    if (overlayOf(window.history.state) === label) {
      window.history.back();
    } else {
      onClose();
    }
  };
}
