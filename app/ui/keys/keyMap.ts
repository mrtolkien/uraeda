// The key map's content, pure: every key that works where the human is, from the registry, in
// sections, and the search over them. A page's own keys come first, under the page's name, then
// the shell's single keys, then the leader's sequences by the group the menu names, then the go
// keys. Keys with one label share a row, `j` beside `↓`. With the single-key switch off, only the
// keys that still work are listed: the leader's sequences, written from the chord that opens the
// menu then, and a fallback only with the keys nothing else listed takes.
import { GROUPS } from "./groups";
import type { Declared, Scope } from "./store";
import { CHORD, isSingleKey, LEADER, written } from "./token";

/** A row of the key map: the keys, each a sequence of tokens as typed, and what they do. */
export type KeyRow = { icon?: string; keys: Array<Array<string>>; label: string };

/** A titled group of rows. */
export type KeySection = { rows: Array<KeyRow>; title: string };

/** The sections after the pages' own, in their order: a group takes its place after the menu's. */
const SHELL = "Everywhere";
const MENU = "Leader menu";
const GO = "Go";
const LAST = [SHELL, MENU, ...Object.values(GROUPS).map((group) => group.label), GO];

/** Whether a binding is a sequence of the leader's menu: Space, then a key. */
const isLeader = (path: ReadonlyArray<string>) => path[0] === LEADER && path.length > 1;

/** The scope a key is listed under: its page's or its layer's, whose panes and selections it holds. */
const home = (scope: Scope): Scope =>
  (scope.kind === "pane" || scope.kind === "selection") && scope.parent !== null
    ? home(scope.parent)
    : scope;

/** Where a binding is listed: its group for a sequence of the leader or of `g`, else its place. */
function sectionOf({ scope, spec }: Declared): string {
  const path = spec.keys.split(" ");
  if (isLeader(path)) {
    return path.length === 2 ? MENU : (GROUPS[path.slice(0, -1).join(" ")]?.label ?? MENU);
  }
  if (path[0] === "g" && path.length === 2) {
    return GO;
  }
  return home(scope).name;
}

/** A label as a row says it, its first letter a capital, as the leader menu's are. */
const capital = (label: string) => label.charAt(0).toUpperCase() + label.slice(1);

const keysOf = (entries: ReadonlyArray<Declared>) => new Set(entries.map(({ spec }) => spec.keys));

const inSelection = (scope: Scope): boolean =>
  scope.kind === "selection" || (scope.parent !== null && inSelection(scope.parent));

/**
 * The bindings that work, each with its tokens as the human types them: those whose guard lets
 * them, and with `singleKeys` off only those that still work. The leader's are written from its
 * chord where Space is not its key: with the switch off, or on a control that keeps Space. A
 * fallback keeps only its keys that no other binding listed holds: it runs only when the other did
 * nothing, which the map cannot tell. So does a page's or the shell's binding of a key a held
 * selection takes, which runs first.
 */
function working(on: ReadonlyArray<Declared>, where: { keepsSpace: boolean; singleKeys: boolean }) {
  const byChord = !where.singleKeys || where.keepsSpace;
  const kept = on.filter(
    ({ spec }) =>
      (where.singleKeys || !isSingleKey(spec.keys) || isLeader(spec.keys.split(" "))) &&
      (spec.when?.() ?? true),
  );
  const held = keysOf(kept.filter(({ spec }) => spec.fallback !== true));
  const selected = keysOf(kept.filter(({ scope }) => inSelection(scope)));
  return kept.flatMap((entry) => {
    const shadowed = !inSelection(entry.scope) && selected.has(entry.spec.keys);
    if (shadowed || (entry.spec.fallback === true && held.has(entry.spec.keys))) {
      return [];
    }
    const path = entry.spec.keys.split(" ");
    return [{ entry, tokens: byChord && isLeader(path) ? [CHORD, ...path.slice(1)] : path }];
  });
}

/**
 * The sections of the keys that are on (`keysOn()` of the registry), where the focus is: whether
 * its control keeps Space, and whether the single keys are on.
 */
export function keyMapSections(
  on: ReadonlyArray<Declared>,
  where: { keepsSpace: boolean; singleKeys: boolean },
): Array<KeySection> {
  const sections = new Map<string, Map<string, KeyRow>>();
  for (const { entry, tokens } of working(on, where)) {
    const title = sectionOf(entry);
    const rows = sections.get(title) ?? new Map<string, KeyRow>();
    sections.set(title, rows);
    const label = capital(entry.spec.label);
    const row = rows.get(label);
    if (row === undefined) {
      rows.set(label, { icon: entry.spec.icon, keys: [tokens], label });
    } else if (!row.keys.some((keys) => keys.join(" ") === tokens.join(" "))) {
      row.keys.push(tokens);
    }
  }
  const pages = [...sections.keys()].filter((title) => !LAST.includes(title));
  return [...pages, ...LAST].flatMap((title) => {
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
