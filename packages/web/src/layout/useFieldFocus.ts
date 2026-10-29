// The focus of an overlay as it opens: on its field that asks for it (`hasAutoFocus`). Astryx's
// sheet focuses itself when the field is not drawn yet, and Firefox gives a dialog's focus to its
// first button, the Close.
import { type RefObject, useEffect } from "react";

/** The frames the field that asks for the focus is waited for, as the overlay opens. */
const FOCUS_FRAMES = 10;

/**
 * Gives the focus to the field in `root` that asks for it, once it is drawn, while `isOpen`, unless
 * the focus is already inside `root`, on what the human picked.
 */
export function useFieldFocus(root: RefObject<HTMLElement | null>, isOpen: boolean) {
  useEffect(() => {
    if (!isOpen) {
      return;
    }
    let frames = 0;
    let frame = requestAnimationFrame(function find() {
      const field = root.current?.querySelector<HTMLElement>("[data-autofocus]");
      const focused = document.activeElement;
      if (field && (focused === root.current || !root.current?.contains(focused))) {
        field.focus({ preventScroll: true });
      } else if (!field && ++frames < FOCUS_FRAMES) {
        frame = requestAnimationFrame(find);
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [isOpen, root]);
}
