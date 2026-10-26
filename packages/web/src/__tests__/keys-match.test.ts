// What a keydown means to the key registry (review focus 1, 2, 3): the character typed, whatever
// Shift does, AltGr as no modifier, and no token for a composition, a dead key, or a lone modifier.
import { afterEach, expect, test, vi } from "vite-plus/test";
import { isCanonical, isSingleKey, tokenOf } from "../keys/match.ts";

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

/** Reports the platform as `platform`, as a browser on that system does. */
const onPlatform = (platform: string) =>
  vi.spyOn(navigator, "platform", "get").mockReturnValue(platform);

afterEach(() => vi.restoreAllMocks());

// Break: reading Option as a modifier on a Mac: `[` and `]` on a German or French Mac are Option+5
// and Option+6, and the old hotkeys hook ran them too (R136).
test("on a Mac, a character typed with Option is that character, and a letter with Option is not", () => {
  onPlatform("MacIntel");
  expect(tokenOf(press("[", { altKey: true }))).toBe("[");
  expect(tokenOf(press("]", { altKey: true }))).toBe("]");
  // `{` is Shift and Option there: still the character.
  expect(tokenOf(press("{", { altKey: true, shiftKey: true }))).toBe("{");
  // A Latin letter with Option, and a command or control chord with it, are no character typed.
  expect(tokenOf(press("x", { altKey: true }))).toBe("alt+x");
  expect(tokenOf(press("[", { altKey: true, metaKey: true }))).not.toBe("[");
  expect(tokenOf(press(" ", { altKey: true }))).toBe("alt+space");
});

test("off a Mac, Alt with a character is a shortcut's modifier, as before", () => {
  onPlatform("Win32");
  expect(tokenOf(press("[", { altKey: true }))).toBe("alt+[");
  onPlatform("Linux x86_64");
  expect(tokenOf(press("]", { altKey: true }))).toBe("alt+]");
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

// A named key with Ctrl or Cmd keeps its name as the browser gives it, which no binding can
// declare (`store.ts` rejects `mod+` before a named key): the chord ends a sequence and goes on.
test("Ctrl or Cmd with a named key keeps the key's name, and with a letter, lowercases it", () => {
  expect(tokenOf(press("ArrowDown", { ctrlKey: true }))).toBe("mod+ArrowDown");
  expect(tokenOf(press("Home", { metaKey: true }))).toBe("mod+Home");
  expect(tokenOf(press("ArrowDown", { ctrlKey: true, shiftKey: true }))).toBe(
    "mod+shift+ArrowDown",
  );
  expect(tokenOf(press("K", { ctrlKey: true }))).toBe("mod+k");
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

// What `tokenOf` gives for a keydown is what a binding can declare, and nothing else is.
test("a token is canonical where tokenOf can give it, and not otherwise", () => {
  const given = [
    press(" "),
    press("j"),
    press("J", { shiftKey: true }),
    press("["),
    press("k", { ctrlKey: true }),
    press("ArrowDown"),
    press("ArrowDown", { shiftKey: true }),
    press("F5"),
    press("Escape"),
  ].map(tokenOf);
  for (const token of given) {
    expect(isCanonical(token ?? ""), `${token}`).toBe(true);
  }
  // Ctrl or Cmd with a named key is given, and is no binding's.
  expect(isCanonical("mod+ArrowDown")).toBe(false);
  expect(isCanonical("mod+shift+k")).toBe(false);
  for (const token of ["Space", "escape", "ctrl+k", "mod+K", "shift+J", "Shift", "alt+x", ""]) {
    expect(isCanonical(token), token).toBe(false);
  }
});
