// The side column's rail on a half screen (`SideColumn.tsx`): whether the column is railed, its
// width beside its page, and the keyboard's focus as the rail opens and closes.
import { type RefObject, useLayoutEffect, useRef } from "react";
import { LIMITS } from "./documentColumnWidth.ts";
import { useLengthIn } from "./useWidthOf.ts";
import { useWidthClass } from "./useWidthClass.ts";

/**
 * The least room a page takes beside the column on a half screen: a reading pane, and the wide
 * page's inset at each side (`Page.tsx`).
 */
const PAGE_LEAST = "calc(var(--size-reading-pane) + 2 * var(--spacing-8))";

/**
 * Whether the column, in `box` with its page, is railed, and its width as drawn beside the page: on
 * a half screen, it keeps the page a reading pane, narrower than its `size` when it must, so a drag
 * never turns it into a rail; railed when even its least would not leave it. A column kept
 * `isBeside` never rails.
 */
export function useRailing(box: RefObject<HTMLElement | null>, isBeside: boolean, size: number) {
  const page = useLengthIn(box, PAGE_LEAST);
  const shares = useWidthClass() === "semi" && !isBeside && page.width > 0;
  return {
    drawn: shares ? Math.min(size, page.width - page.px) : size,
    railed: shares && page.width - LIMITS.min < page.px,
  };
}

/**
 * Keeps the keyboard's focus as the railed column opens and closes, as its button goes with the
 * rail: opened from the button, the focus moves to the open tab; closed by Escape from inside it,
 * back to the button, which `useRail` keeps from opening it again.
 */
export function useRailFocus(
  isOpen: boolean,
  wasEscaped: () => boolean,
  place: RefObject<HTMLElement | null>,
  button: RefObject<HTMLButtonElement | null>,
) {
  // Whether the button held the focus as the column opened, which removed it.
  const onButton = useRef(false);
  useLayoutEffect(() => {
    const lost = document.activeElement === null || document.activeElement === document.body;
    // Read first: the button focused below sets it again.
    const fromButton = onButton.current;
    onButton.current = false;
    if (isOpen && lost && fromButton) {
      place.current?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')?.focus();
    }
    if (!isOpen && lost && wasEscaped()) {
      button.current?.focus();
    }
  }, [button, isOpen, place, wasEscaped]);
  /** The button's own focus handlers. */
  return {
    onBlur: () => {
      onButton.current = false;
    },
    onFocus: () => {
      onButton.current = true;
    },
  };
}
