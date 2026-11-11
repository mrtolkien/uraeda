// What the keyboard's settings change in the whole app, from the server's values in force: the
// single-key shortcuts and Vim in every field. The frame draws it once, beside its own keys.
import { effect } from "nsh";
import { record } from "../../store";
import { singleKeys } from "../../ui/keys";
import { setVimMode } from "../../ui/text";

export function FollowKeyboard() {
  const settings = record("Settings", null);
  effect(() => {
    const keyboard = settings()?.keyboard;
    if (keyboard === undefined) return;
    singleKeys.set(keyboard.singleKeyShortcuts.inForce);
    setVimMode(keyboard.vimMode.inForce);
  });
  return null;
}
