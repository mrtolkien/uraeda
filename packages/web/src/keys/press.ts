// Pressing keys from a click: a hint of the status line, or a row of the leader's menu, presses the
// keys it names as the keyboard would, a real `keydown` on the element holding the focus, so the
// registry's rules (a text field, an open layer, a binding's guard) apply as they do to a key typed.
import type { MouseEvent } from "react";

/** The `keydown` of a token, as `tokenOf` reads it back: `space`, `mod+k`, `shift+ArrowDown`, `J`. */
function keydown(token: string) {
  const init: KeyboardEventInit = { bubbles: true, cancelable: true };
  let key = token;
  for (;;) {
    if (key.startsWith("mod+")) {
      init.ctrlKey = true;
      key = key.slice(4);
    } else if (key.startsWith("shift+")) {
      init.shiftKey = true;
      key = key.slice(6);
    } else {
      break;
    }
  }
  // A capital letter is typed with Shift.
  if (/^[A-Z]$/.test(key)) {
    init.shiftKey = true;
  }
  return new KeyboardEvent("keydown", { ...init, key: key === "space" ? " " : key });
}

/** Presses the keys of a binding, tokens separated by spaces, one after the other. */
export function pressKeys(keys: string) {
  const target = document.activeElement ?? document.body;
  for (const token of keys.split(" ")) {
    target.dispatchEvent(keydown(token));
  }
}

/** For a control that presses keys: a press on it keeps the focus where it was. */
export const keepFocus = (event: MouseEvent) => event.preventDefault();
