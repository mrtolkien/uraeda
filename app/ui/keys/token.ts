// A key as the registry names it, one token: the character typed for a printable key, whatever
// Shift did to it ("j", "J", "?", "["), "space", a named key as a browser spells it ("ArrowDown",
// "Escape"), and the modifiers that are part of a shortcut in front ("shift+ArrowDown", "mod+k",
// "mod+shift+z"). A binding's keys are one token, or several separated by spaces for a sequence:
// "g h", "space n n".
//
// Native Shell names a key otherwise, by the key of the US layout that types it without Shift,
// Shift being a modifier: `?` is "shift+/", `J` "shift+j", ArrowDown "down". `strokeOf` is the one
// place that knows it. Native Shell matches the key on any layout, so a token is the character of
// the US layout's key, which a French keyboard may type elsewhere.

/** The first key of the leader's tree, and the chord that opens it when letters are off. */
export const LEADER = "space";
export const CHORD = "mod+k";

/** The characters Shift types on the US layout, and the key that types each. */
const SHIFTED: Readonly<Record<string, string>> = {
  "!": "1",
  '"': "'",
  "#": "3",
  $: "4",
  "%": "5",
  "&": "7",
  "(": "9",
  ")": "0",
  "*": "8",
  "+": "=",
  ":": ";",
  "<": ",",
  ">": ".",
  "?": "/",
  "@": "2",
  "^": "6",
  _: "-",
  "{": "[",
  "|": "\\",
  "}": "]",
  "~": "`",
};

/** The characters the US layout types without Shift, besides letters and digits. */
const PLAIN = "`-=[]\\;',./";

/** The named keys, as a browser spells them, and as Native Shell does. */
const NAMED: Readonly<Record<string, string>> = {
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowUp: "up",
  Backspace: "backspace",
  Delete: "delete",
  End: "end",
  Enter: "enter",
  Escape: "escape",
  Home: "home",
  Insert: "insert",
  PageDown: "pagedown",
  PageUp: "pageup",
  Tab: "tab",
};

/** What the system keeps on a desktop, which Native Shell refuses to bind: quit, full screen. */
const KEPT = new Set(["mod+q", "f11"]);

/** How a token is written for a human, where it is not the token itself. */
const GLYPHS: Readonly<Record<string, string>> = {
  ArrowDown: "↓",
  ArrowLeft: "←",
  ArrowRight: "→",
  ArrowUp: "↑",
  Backspace: "⌫",
  Enter: "⏎",
  Escape: "esc",
};

/** Whether a key name is one printable character: `[` and `J`, not `ArrowDown` or `Escape`. */
export function isPrintable(key: string) {
  return [...key].length === 1 && key !== " ";
}

/** Whether the binding's first key is one printable character or Space: a single-key shortcut. */
export function isSingleKey(keys: string) {
  const [first = ""] = keys.split(" ");
  return first === LEADER || isPrintable(first);
}

/** The keystroke of one printable character, `null` for one the US layout has no key for. */
function charStroke(char: string): string | null {
  if (/^[a-z0-9]$/.test(char) || PLAIN.includes(char)) {
    return char;
  }
  if (/^[A-Z]$/.test(char)) {
    return `shift+${char.toLowerCase()}`;
  }
  const base = SHIFTED[char];
  return base === undefined ? null : `shift+${base}`;
}

/** A named key's keystroke: `Enter`, `ArrowDown`, `F5`. */
function namedStroke(name: string): string | null {
  const functionKey = /^F([1-9]|1[0-9]|2[0-4])$/.exec(name);
  return functionKey ? name.toLowerCase() : (NAMED[name] ?? null);
}

/** The keystroke of a token, before what the system keeps is taken out. */
function stroke(token: string): string | null {
  if (token === LEADER) {
    return "space";
  }
  if (isPrintable(token)) {
    return charStroke(token);
  }
  if (token.startsWith("mod+shift+")) {
    // With Shift too, only a character, lowercase: Ctrl+Shift+Z is `mod+shift+z`, as for redo.
    const char = token.slice(10);
    return /^[a-z0-9]$/.test(char) || (char.length === 1 && PLAIN.includes(char))
      ? `mod+shift+${char}`
      : null;
  }
  if (token.startsWith("mod+")) {
    const rest = token.slice(4);
    const key = isPrintable(rest)
      ? /^[a-z0-9]$/.test(rest) || PLAIN.includes(rest)
        ? rest
        : null
      : namedStroke(rest);
    return key === null ? null : `mod+${key}`;
  }
  if (token.startsWith("shift+")) {
    const key = namedStroke(token.slice(6));
    return key === null ? null : `shift+${key}`;
  }
  return namedStroke(token);
}

/**
 * The keystroke of a token as Native Shell's `keymap` names it, `null` where no key gives the
 * token, so its binding could never run: a modifier written otherwise than `mod+` and `shift+`, a
 * capital after `mod+`, a character the US layout has no key for, or a key the system keeps.
 */
export function strokeOf(token: string): string | null {
  const made = stroke(token);
  return made === null || KEPT.has(made) ? null : made;
}

/** A token as a human reads it: `↓` for ArrowDown, `Ctrl+K` for `mod+k`, Space as "space". */
export function written(token: string): string {
  // The modifiers before the key, whatever the key: `+` alone is a key.
  const [, prefix = "", key = token] = /^((?:mod\+|shift\+)*)(.+)$/.exec(token) ?? [];
  const mods = prefix
    .split("+")
    .filter(Boolean)
    .map((mod) => (mod === "mod" ? "Ctrl" : "Shift"));
  const name = GLYPHS[key] ?? (mods.length > 0 && isPrintable(key) ? key.toUpperCase() : key);
  return [...mods, name].join("+");
}

/**
 * Every key a pending sequence hears: each character the US layout types, Space, and the keys
 * that go back up, close, and start again. A named key is left to who has it.
 */
export const SEQUENCE_KEYS: ReadonlyArray<string> = [
  ..."abcdefghijklmnopqrstuvwxyz",
  ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  ..."0123456789",
  ...PLAIN,
  ...Object.keys(SHIFTED),
  LEADER,
  "Backspace",
  "Escape",
  CHORD,
];
