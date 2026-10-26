// What a keydown means to the key registry (review focus 1, 2, 3): the character typed, whatever
// Shift does, AltGr as no modifier, and no token for a composition, a dead key, or a lone modifier.
import { expect, test } from "vite-plus/test";
import { isSingleKey, tokenOf } from "../keys/match.ts";

/**
 * A keydown as a browser reports it: happy-dom's `getModifierState` answers `AltGraph` with Alt, so
 * it is stubbed, and so is `CapsLock`, which happy-dom never reports.
 */
function press(key: string, init: KeyboardEventInit & { altGraph?: boolean; caps?: boolean } = {}) {
  const { altGraph = false, caps = false, ...rest } = init;
  const event = new KeyboardEvent("keydown", { key, ...rest });
  event.getModifierState = (name) =>
    (name === "AltGraph" && altGraph) || (name === "CapsLock" && caps);
  return event;
}

// Break: matching `code`, or lowercasing the key, which loses `J K G +`.
test("a printable key is the character typed, whatever Shift did to it", () => {
  expect(tokenOf(press("+", { shiftKey: true }))).toBe("+");
  expect(tokenOf(press("J", { shiftKey: true }))).toBe("J");
  expect(tokenOf(press("j"))).toBe("j");
  expect(tokenOf(press("=", { code: "Equal" }))).toBe("=");
  // A layout that types `j` on another key: the character, not the key's place, is the token.
  expect(tokenOf(press("j", { code: "KeyH" }))).toBe("j");
});

// Break: skipping every Ctrl+Alt, which kills `[` and `]` on AZERTY.
test("a character typed with AltGr is that character, and a real Ctrl shortcut is not", () => {
  expect(tokenOf(press("[", { altGraph: true, altKey: true, ctrlKey: true }))).toBe("[");
  expect(tokenOf(press("]", { altGraph: true }))).toBe("]");
  // Windows reports AltGr as Ctrl and Alt together, with no `AltGraph` state in every browser.
  expect(tokenOf(press("[", { altKey: true, ctrlKey: true }))).toBe("[");
  expect(tokenOf(press("[", { ctrlKey: true }))).not.toBe("[");
  expect(tokenOf(press("x", { altKey: true }))).not.toBe("x");
});

// Break: the token taken from `event.key` as typed, so Caps Lock turns `j` into `J`, which moves
// the item and writes to git.
test("Caps Lock does not change a letter's case: Shift does", () => {
  expect(tokenOf(press("J", { caps: true }))).toBe("j");
  expect(tokenOf(press("j", { caps: true, shiftKey: true }))).toBe("J");
  expect(tokenOf(press("K", { caps: true }))).toBe("k");
  expect(tokenOf(press("G", { caps: true, shiftKey: true }))).toBe("G");
  // The key's own case is the keyboard's, with no Caps Lock: Shift states it.
  expect(tokenOf(press("J", { shiftKey: true }))).toBe("J");
  // A character with no case, and a letter of another script, is what was typed.
  expect(tokenOf(press("[", { caps: true }))).toBe("[");
  expect(tokenOf(press("ю", { caps: true }))).toBe("ю");
});

test("a keydown of an IME's composition, with keyCode 229, is no shortcut", () => {
  expect(tokenOf(press("j", { keyCode: 229 }))).toBeNull();
  expect(tokenOf(press("Enter", { keyCode: 229 }))).toBeNull();
  expect(tokenOf(press("j", { keyCode: 74 }))).toBe("j");
});

test("a composition, a dead key, and a lone modifier are no shortcut", () => {
  expect(tokenOf(press("j", { isComposing: true }))).toBeNull();
  expect(tokenOf(press("Dead"))).toBeNull();
  expect(tokenOf(press("Process"))).toBeNull();
  expect(tokenOf(press("Unidentified"))).toBeNull();
  for (const key of ["Shift", "Control", "Alt", "Meta", "AltGraph", "CapsLock"]) {
    expect(tokenOf(press(key, { shiftKey: key === "Shift" }))).toBeNull();
  }
});

test("a repeated key keeps its token: holding j goes on moving", () => {
  expect(tokenOf(press("j", { repeat: true }))).toBe("j");
});

test("Space, a named key with Shift, and Ctrl or Cmd+K have their own tokens", () => {
  expect(tokenOf(press(" "))).toBe("space");
  expect(tokenOf(press("ArrowDown"))).toBe("ArrowDown");
  expect(tokenOf(press("ArrowDown", { shiftKey: true }))).toBe("shift+ArrowDown");
  expect(tokenOf(press("k", { ctrlKey: true }))).toBe("mod+k");
  expect(tokenOf(press("k", { metaKey: true }))).toBe("mod+k");
  expect(tokenOf(press("K", { ctrlKey: true, shiftKey: true }))).toBe("mod+shift+k");
  expect(tokenOf(press("Escape"))).toBe("Escape");
});

test("Space typed with Shift is still Space", () => {
  expect(tokenOf(press(" ", { shiftKey: true }))).toBe("space");
});

test("the keys of a keyboard's extra layers are no shortcut, so a wrong key ends nothing", () => {
  for (const key of ["Fn", "FnLock", "NumLock", "ScrollLock", "Hyper", "Super", "OS"]) {
    expect(tokenOf(press(key))).toBeNull();
  }
});

test("a single-key shortcut starts with one printable character or Space", () => {
  for (const keys of ["j", "J", "+", "[", "/", ",", "space", "g h", "space n n"]) {
    expect(isSingleKey(keys)).toBe(true);
  }
  for (const keys of ["ArrowDown", "shift+ArrowDown", "Home", "Enter", "Escape", "mod+k"]) {
    expect(isSingleKey(keys)).toBe(false);
  }
});
