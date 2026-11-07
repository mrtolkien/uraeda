// The stops of the keyboard cursor: the elements it moves through, marked by what draws them, so the
// cursor knows no page. A block's toggle, a pending comment, a fold's or an embed's button, and a
// whole pane such as a question card are found by their mark, `data-stop`, in document order.

/**
 * What a stop is: a review's block, a pending comment, a whole pane such as a question card, or a
 * control whose own Enter acts, such as a fold's toggle.
 */
export type StopKind = "block" | "comment" | "pane" | "control";

/** The mark of a stop, its kind as its value. */
const MARK = "data-stop";

/**
 * The props that make an element a stop of `kind`: its mark, and `tabIndex` -1 where it is not
 * focusable itself, a pane or a note, so the cursor can give it the focus while Tab passes it by.
 */
export function stopProps(
  kind: StopKind,
  focusable = false,
): { "data-stop": StopKind; tabIndex?: number } {
  return focusable ? { "data-stop": kind } : { "data-stop": kind, tabIndex: -1 };
}

/** Whether a stop is shown: not hidden, not inert, and drawn with a box of its own. */
function isShown(stop: HTMLElement) {
  if (stop.closest("[hidden], [inert]") !== null) {
    return false;
  }
  return typeof stop.checkVisibility === "function" ? stop.checkVisibility() : true;
}

/** The shown stops of the document, in document order: what the cursor moves through. */
export function stopsOf(): Array<HTMLElement> {
  return [...document.querySelectorAll<HTMLElement>(`[${MARK}]`)].filter(isShown);
}

/** The stop holding `element`, itself included, `null` outside any. */
export function stopOf(element: Element | null): HTMLElement | null {
  return element?.closest<HTMLElement>(`[${MARK}]`) ?? null;
}
