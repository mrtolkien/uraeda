// What a keydown means to the key registry, as one token: the character typed for a printable key,
// whatever Shift did to it ("J", "+", "["), "space", a named key as the browser names it
// ("ArrowDown", "Escape"), and the modifiers that are part of a shortcut in front ("shift+ArrowDown",
// "mod+k", "alt+x"). Matching is on `event.key`, never `code`, so a layout other than the US one
// still types the keys the bindings name.

/** Keys that are no shortcut: a composition's, and a modifier pressed alone. */
const NOT_KEYS = new Set([
  "AltGraph",
  "Alt",
  "CapsLock",
  "Control",
  "Dead",
  "Fn",
  "FnLock",
  "Hyper",
  "Meta",
  "NumLock",
  "OS",
  "ScrollLock",
  "Super",
  "Symbol",
  "SymbolLock",
  "Process",
  "Shift",
  "Unidentified",
]);

/** Whether a key name is one printable character: `[` and `J`, not `ArrowDown` or `Escape`. */
export function isPrintable(key: string) {
  return [...key].length === 1;
}

const LETTER = /^[a-zA-Z]$/;

/**
 * A Latin letter in the case Shift gives it, not Caps Lock's; with a modifier it is lowercase, and
 * Shift is the token's own.
 */
const letter = (key: string, { altKey, ctrlKey, metaKey, shiftKey }: KeyboardEvent) =>
  shiftKey && !altKey && !ctrlKey && !metaKey ? key.toUpperCase() : key.toLowerCase();

/**
 * The token of a keydown, `null` where it is no shortcut: a key of a composition (`isComposing`),
 * a dead key, an IME's `Process`, `Unidentified`, or a modifier alone. A repeated key still has its
 * token: holding `j` goes on moving, and what a repeat starts is the sequences' rule.
 *
 * AltGr is not a modifier: it reports `ctrlKey` and `altKey` together on Windows, and `[` and `]`
 * on AZERTY need it, so a printable character typed with AltGr is that character.
 */
export function tokenOf(event: KeyboardEvent): string | null {
  const { key } = event;
  // An IME's keydown has `keyCode` 229, whatever `isComposing` says (Safari ends it first).
  if (event.isComposing || event.keyCode === 229 || NOT_KEYS.has(key)) {
    return null;
  }
  const isChar = isPrintable(key) && key !== " ";
  const altGraph =
    event.getModifierState("AltGraph") || (event.ctrlKey && event.altKey && !event.metaKey);
  if (isChar && altGraph) {
    return key;
  }
  const mod = event.ctrlKey || event.metaKey;
  // The case of a Latin letter is Shift's: Caps Lock turns `j` into `J`, the key that moves the
  // item and writes to git. Any other character is what was typed.
  const name =
    key === " " ? "space" : LETTER.test(key) ? letter(key, event) : mod ? key.toLowerCase() : key;
  // Shift is in the character it typed, and Space with it is still Space; on a named key, or with
  // another modifier, it is the shortcut's.
  const isShift = event.shiftKey && ((!isChar && key !== " ") || mod || event.altKey);
  return `${mod ? "mod+" : ""}${event.altKey ? "alt+" : ""}${isShift ? "shift+" : ""}${name}`;
}

/** Whether the binding's first key is one printable character or Space: a single-key shortcut. */
export function isSingleKey(keys: string) {
  const [first = ""] = keys.split(" ");
  return first === "space" || isPrintable(first);
}
