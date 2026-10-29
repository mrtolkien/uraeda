// The key map's content, pure: every key that works where the human is, from the registry, in
// sections, and the search over them. A page's own keys come first, then the shell's single keys,
// then the leader's sequences by the group the menu names, then the go keys. Keys with one label
// share a row, `j` beside `↓`. With the single-key switch off, only the keys that still work are
// listed: the leader's sequences, written from the chord that opens the menu then.
import { GROUPS } from "./groups.ts";
import { isSingleKey, onMac } from "./match.ts";
import { CHORD, LEADER } from "./sequence.ts";
import type { IconName, Placed } from "./store.ts";

/** A row of the key map: the keys, each a sequence of tokens as typed, and what they do. */
export type KeyRow = { icon?: IconName; keys: Array<Array<string>>; label: string };

/** A titled group of rows. */
export type KeySection = { rows: Array<KeyRow>; title: string };

/** The sections' titles, in their order; a group of `groups.ts` takes its place after the menu's. */
const PAGE = "This page";
const SHELL = "Everywhere";
const MENU = "Leader menu";
const GO = "Go";

/** Where a binding is listed: its group for a sequence of the leader or of `g`, else its place. */
function sectionOf({ binding, place }: Placed): string {
  const path = binding.keys.split(" ");
  if (path[0] === LEADER && path.length > 1) {
    return path.length === 2 ? MENU : (GROUPS[path.slice(0, -1).join(" ")]?.label ?? MENU);
  }
  if (path[0] === "g" && path.length === 2) {
    return GO;
  }
  return place === "page" ? PAGE : SHELL;
}

/** The sections' order: the page's, the shell's, the menu's, each group's as named, then `g`'s. */
const ORDER = [PAGE, SHELL, MENU, ...Object.values(GROUPS).map((group) => group.label), GO];

const ARROWS: Record<string, string> = {
  ArrowDown: "↓",
  ArrowLeft: "←",
  ArrowRight: "→",
  ArrowUp: "↑",
  Backspace: "⌫",
  Enter: "⏎",
  Escape: "esc",
};

/** A token as the key map writes it: `↓` for ArrowDown, `Ctrl+K` for `mod+k`, Space as "space". */
export function written(token: string): string {
  // The modifiers before the key, whatever the key: `+` alone is a key, `mod++` a chord of it.
  const [, prefix = "", key = token] = /^((?:mod\+|alt\+|shift\+)*)(.+)$/.exec(token) ?? [];
  const mods = prefix
    .split("+")
    .filter(Boolean)
    .map((mod) =>
      mod === "mod" ? (onMac() ? "Cmd" : "Ctrl") : mod.charAt(0).toUpperCase() + mod.slice(1),
    );
  const name = ARROWS[key] ?? (mods.length > 0 ? key.toUpperCase() : key);
  return [...mods, name].join("+");
}

/** A label as a row says it, its first letter a capital, as the leader menu's are. */
const capital = (label: string) => label.charAt(0).toUpperCase() + label.slice(1);

/**
 * The sections of the bindings that work for `target`, the element the keys go to: those whose
 * guard lets them, and with `singleKeys` off, only the leader's, from its chord.
 */
export function keyMapSections(
  listed: ReadonlyArray<Placed>,
  target: EventTarget | null,
  singleKeys: boolean,
): Array<KeySection> {
  const sections = new Map<string, Map<string, KeyRow>>();
  for (const entry of listed) {
    const { binding } = entry;
    const path = binding.keys.split(" ");
    const isLeader = path[0] === LEADER && path.length > 1;
    if (
      (!singleKeys && isSingleKey(binding.keys) && !isLeader) ||
      !(binding.when?.(target) ?? true)
    ) {
      continue;
    }
    const tokens = !singleKeys && isLeader ? [CHORD, ...path.slice(1)] : path;
    const title = sectionOf(entry);
    const rows = sections.get(title) ?? new Map<string, KeyRow>();
    sections.set(title, rows);
    const label = capital(binding.label);
    const row = rows.get(label);
    if (row === undefined) {
      rows.set(label, { icon: binding.icon, keys: [tokens], label });
    } else if (!row.keys.some((keys) => keys.join(" ") === tokens.join(" "))) {
      row.keys.push(tokens);
    }
  }
  return ORDER.filter((title, index) => ORDER.indexOf(title) === index).flatMap((title) => {
    const rows = sections.get(title);
    return rows === undefined ? [] : [{ rows: [...rows.values()], title }];
  });
}

/**
 * The sections with only the rows the search finds: every word of `query` in the row's label, its
 * keys as written, or its section's title, whatever the case. Empty sections go.
 */
export function searchKeyMap(
  sections: ReadonlyArray<KeySection>,
  query: string,
): Array<KeySection> {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return [...sections];
  }
  return sections.flatMap((section) => {
    const rows = section.rows.filter((row) => {
      const keys = row.keys.map((tokens) => tokens.map(written).join(" "));
      const text = [section.title, row.label, ...keys].join(" ").toLowerCase();
      return words.every((word) => text.includes(word));
    });
    return rows.length === 0 ? [] : [{ ...section, rows }];
  });
}
