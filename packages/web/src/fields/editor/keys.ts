// The editor's own keys, the field's and not the page's (Keyboard decision: a text field owns its
// keys): Ctrl or Cmd+Enter submits, Enter runs a one-line field's action, Escape leaves the field or
// cancels it. None of them while an input method composes: its Enter picks the composed text.
import { Prec } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import type { EditorActions } from "./slot.ts";

/** Whether a key goes to an input method composing text, not to the field. */
const composing = (event: KeyboardEvent, view: EditorView) => event.isComposing || view.composing;

/** Whether a key is pressed with Ctrl, Cmd, or Alt. */
const modified = (event: KeyboardEvent) => event.ctrlKey || event.metaKey || event.altKey;

/** Runs a field's own key's action, which takes the key: a `FieldKey`'s `run`. */
export function took(action: () => void): true {
  action();
  return true;
}

/** Takes the key when its action did something. */
function handled(event: KeyboardEvent, ran: boolean) {
  if (ran) {
    event.preventDefault();
  }
  return ran;
}

/**
 * The field's keys, before CodeMirror's own, which would add a line on Ctrl+Enter or Enter.
 * `variant: "line"` never inserts a line break: Enter runs the field's action or nothing.
 * `enters` is whether the field has an Enter action, which Shift+Enter leaves out to add a line.
 */
export function fieldKeys(actions: () => EditorActions & { enters: boolean; line: boolean }) {
  return Prec.high(
    EditorView.domEventHandlers({
      keydown(event, view) {
        if (composing(event, view)) {
          // The input method's: neither the field's actions nor CodeMirror's own keys, whose Enter
          // would add a line as the input method picks its text. Taken, so CodeMirror cancels the
          // key's default: the composition goes on through its own events, not the key's.
          return true;
        }
        const own = actions();
        if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
          // Taken without a submit too: CodeMirror's own would add a blank line.
          own.submit();
          return handled(event, true);
        }
        if (event.key === "Enter" && !modified(event)) {
          if (own.enters && !event.shiftKey) {
            return handled(event, own.enter());
          }
          // A one-line field never breaks its line, Shift+Enter included.
          return own.line ? handled(event, true) : false;
        }
        // Shift+Escape too, which leaves the field from any of Vim's modes.
        if (event.key === "Escape" && !modified(event)) {
          return handled(event, own.escape() === "handled");
        }
        return false;
      },
    }),
  );
}
