// A field's leave: the focus going out of the editor, from its text or from a layer's prompt under
// it, like Vim's `:`, never as the field is taken down.
import type { EditorView } from "@codemirror/view";

/**
 * The fields being taken down, whose blur is no human's leaving: a field's element removed takes
 * its focus with it unannounced, and React's development mode takes a field down and up again as
 * it mounts, which must not save or close a row.
 */
const destroying = new WeakSet<EditorView>();

/**
 * Runs `onLeave`, the field's `onBlur`, as the focus leaves the editor, from its text or from its
 * prompt under it, like Vim's `:`, once per stay. The focus moving between the two is no leaving.
 * The prompt also loses the focus as Enter or Escape closes it, its engine giving it back to the
 * text at once: a leave from the prompt counts only once the focus is still outside. Returns the
 * listeners' removal.
 */
export function hearLeave(view: EditorView, onLeave: () => void) {
  let left = false;
  const leave = () => {
    if (!left && !destroying.has(view)) {
      left = true;
      onLeave();
    }
  };
  const focusIn = () => {
    left = false;
  };
  const focusOut = (event: FocusEvent) => {
    if (view.dom.contains(event.relatedTarget as Node | null)) {
      return;
    }
    if (event.target === view.contentDOM) {
      leave();
      return;
    }
    queueMicrotask(() => {
      if (!view.dom.contains(view.dom.ownerDocument.activeElement)) {
        leave();
      }
    });
  };
  view.dom.addEventListener("focusin", focusIn);
  view.dom.addEventListener("focusout", focusOut);
  return () => {
    view.dom.removeEventListener("focusin", focusIn);
    view.dom.removeEventListener("focusout", focusOut);
  };
}

/** Marks a field as being taken down: its blur from now on is no leaving. */
export function takeDown(view: EditorView) {
  destroying.add(view);
}
