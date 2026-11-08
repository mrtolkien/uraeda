// The web's registries: one store of what each extension adds to the page, built in or yours, with
// its order, its on-state, and the rule over keys. The places, the leader's keys, home's panes, the
// phone's tabs, the New page's sections, the status line's items, the renderers of session items,
// and the settings' sections are each a kind of contribution, listed for the extensions on in the
// current repository: built-ins first in their order, today's, then yours by name. Every claim of a
// key is kept, and clashes are settled as the registry lists, among the extensions on there: the
// first registered of them keeps a key, and a later claim of it, or of a sequence it starts, is
// dropped and reported, so a clash never reaches the key registry, which throws on one.
import type { ComponentType, ReactNode } from "react";
import type { Item } from "uraeda-server/fate";
import type { IconName } from "../keys/store.ts";
import type { WorkSection, Tone } from "../lists/workSection.ts";

/**
 * A place: a page of its own, in the navigation column, the leader menu, and the phone's tabs.
 * Built-ins keep their paths; yours open at `/e/<name>/<id>`. The fields after `actions` are the
 * built-ins' own, which draw today's rows and tabs: yours draw from `title`, `icon`, and `count`.
 */
export type Place = {
  /** Its button among the column's actions, Git's, where `column` is "actions". */
  action?: ComponentType<{ isColumn: boolean }>;
  /** What its column row holds at its end, like the inbox's ＋. */
  actions?: ComponentType;
  /** Where the column draws it: Navigate by default, its actions, or nowhere, as Sessions. */
  column?: "actions" | "navigate" | "none";
  component: ComponentType;
  /**
   * Its count, read as a hook while its row or tab is drawn, inside its extension's boundary, so
   * it may call `uraeda/page`'s hooks: none, or a count that throws, shows nothing.
   */
  count?: () => number | undefined;
  /** Its key after `g`, which the built-ins have beside their leader key. */
  goKey?: string;
  icon: IconName;
  id: string;
  /** Its leader key, after `Space`. */
  key?: string;
  /** Its own row in Navigate, which draws its count its own way. */
  navRow?: ComponentType<{ pathname: string }>;
  path?: string;
  phoneTab?: "bar" | "more";
  /** Its own phone tab, which draws its count its own way. */
  tab?: ComponentType<{ isCurrent: boolean }>;
  title: string;
};

/**
 * A pane of Home's overview, in column 0 or 1, drawn as a work list's section with `component` in
 * its body. A built-in gives `section` instead: the section itself, rows and all, handed to its
 * `children`, so that its rows are the list's, which the keys move along.
 */
export type HomePane = {
  column: 0 | 1;
  /** Its body: yours give it, a built-in its `section`. */
  component?: ComponentType;
  icon: IconName;
  id: string;
  section?: ComponentType<{ children: (section: WorkSection) => ReactNode }>;
  title: string;
  tone: Tone;
};

/** An entry the New page can start from, which a card's selection inserts into the composer. */
export type NewEntry = {
  file: string;
  id: string;
  kind: "line" | "note";
  lines: ReadonlyArray<string>;
  linked?: string;
  linkedHref?: string;
  section?: string;
  text: string;
};

/** A New page's section, as a built-in hands it: the section, and each card's entry by its href. */
export type NewSectionRead = { entries: ReadonlyMap<string, NewEntry>; section: WorkSection };

/**
 * A section of the New page, under the composer. A built-in gives `section` instead of
 * `component`, as for home's panes.
 */
export type NewSection = {
  /** Its body: yours give it, a built-in its `section`. */
  component?: ComponentType<{ onInsert: (text: string) => void; search: string }>;
  id: string;
  section?: ComponentType<{
    children: (read: NewSectionRead) => ReactNode;
    search: string;
  }>;
  title: string;
  tone: Tone;
};

/** An item of the status line, after the hints. */
export type StatusItem = { component: ComponentType; id: string };

/** What draws a session's item of a tool, by the tool's name, in place of its output. */
export type ItemRenderer = { component: ComponentType<{ item: Item }>; tool: string };

/** A section of the settings page, under its extension's row. */
export type SettingsSection = {
  component: ComponentType;
  icon: IconName;
  id: string;
  title: string;
};

/** A key under the leader: `keys` is after `Space`, "y" or "space y" alike. */
export type ExtensionKey = { icon?: IconName; keys: string; label: string; run: () => void };

/** Every kind of contribution, by its name. */
export type Contributions = {
  homePane: HomePane;
  itemRenderer: ItemRenderer;
  key: ExtensionKey;
  newSection: NewSection;
  place: Place;
  settingsSection: SettingsSection;
  statusItem: StatusItem;
};

export type ContributionKind = keyof Contributions;

/** A contribution, tagged with its kind. */
export type Contribution = {
  [K in ContributionKind]: { kind: K; value: Contributions[K] };
}[ContributionKind];

/** Who registers: an extension's name, and its title, which a clash names. */
export type ExtensionRef = { name: string; title: string };

/**
 * A key an extension could not have, as another took it first: `takenBy` is that one's title, and
 * `repositories` where, when not in all of them.
 */
export type KeyClash = {
  extension: string;
  keys: string;
  repositories?: ReadonlyArray<string>;
  takenBy: string;
};

type Entry = {
  /** The keys it claims, whether it keeps them or not, which depends on who else is on. */
  claims: ReadonlyArray<string>;
  extension: ExtensionRef;
  /** A built-in's place among the built-ins; none for yours. */
  order: number | undefined;
  seq: number;
  /** Its value, a place's path filled in. */
  value: Contribution;
};

/** The registry's state: replaced, never changed, at each registration and undo. */
export type Snapshot = ReadonlyArray<Entry>;

/** `keys` under the leader, as the key registry spells it: "y" is "space y". */
export const leaderKeys = (keys: string) => (keys.startsWith("space ") ? keys : `space ${keys}`);

/** Whether two keys mean the same press: the same, or one the start of the other's sequence. */
export function keysClash(a: string, b: string): boolean {
  const ta = a.split(" ");
  const tb = b.split(" ");
  return ta.slice(0, Math.min(ta.length, tb.length)).every((token, index) => token === tb[index]);
}

/** The keys a contribution claims: a key's, and a place's leader and go keys. */
function claimsOf(contribution: Contribution): Array<string> {
  if (contribution.kind === "key") {
    return [leaderKeys(contribution.value.keys)];
  }
  if (contribution.kind === "place") {
    const { goKey, key } = contribution.value;
    return [
      ...(key === undefined ? [] : [`space ${key}`]),
      ...(goKey === undefined ? [] : [`g ${goKey}`]),
    ];
  }
  return [];
}

/** The contribution as registered: a place at its path. */
function atPath(name: string, contribution: Contribution): Contribution {
  if (contribution.kind !== "place" || contribution.value.path !== undefined) {
    return contribution;
  }
  const place = { ...contribution.value, path: `/e/${name}/${contribution.value.id}` };
  return { kind: "place", value: place };
}

/** The contribution as listed: a place without the keys it lost. */
function listed(contribution: Contribution, kept: ReadonlyArray<string>): Contribution {
  if (contribution.kind !== "place") {
    return contribution;
  }
  const { goKey, key } = contribution.value;
  const losesKey = key !== undefined && !kept.includes(`space ${key}`);
  const losesGo = goKey !== undefined && !kept.includes(`g ${goKey}`);
  if (!losesKey && !losesGo) {
    return contribution;
  }
  const place = { ...contribution.value };
  if (losesKey) {
    delete place.key;
  }
  if (losesGo) {
    delete place.goKey;
  }
  return { kind: "place", value: place };
}

/** Built-ins first, in their order; then yours, by name; each in the order it registered. */
function compare(a: Entry, b: Entry): number {
  if (a.order !== undefined || b.order !== undefined) {
    if (a.order === undefined || b.order === undefined) {
      return a.order === undefined ? 1 : -1;
    }
    return a.order - b.order || a.seq - b.seq;
  }
  return a.extension.name.localeCompare(b.extension.name) || a.seq - b.seq;
}

/**
 * The keys each entry keeps among the extensions `isOn`, and the claims dropped: in registration
 * order, a claim is dropped when an earlier entry kept the same press.
 */
function settle(snapshot: Snapshot, isOn: (extension: string) => boolean) {
  const held: Array<{ keys: string; title: string }> = [];
  const kept = new Map<Entry, ReadonlyArray<string>>();
  const clashes: Array<KeyClash> = [];
  for (const entry of snapshot) {
    if (entry.claims.length === 0 || !isOn(entry.extension.name)) {
      continue;
    }
    const mine = entry.claims.filter((keys) => {
      const holder = held.find((one) => keysClash(one.keys, keys));
      if (holder) {
        clashes.push({ extension: entry.extension.name, keys, takenBy: holder.title });
      }
      return !holder;
    });
    held.push(...mine.map((keys) => ({ keys, title: entry.extension.title })));
    kept.set(entry, mine);
  }
  return { clashes, kept };
}

/** The contributions of `kind` in `snapshot` of the extensions `isOn`, with their extension. */
export function entriesOf<K extends ContributionKind>(
  snapshot: Snapshot,
  kind: K,
  isOn: (extension: string) => boolean,
): Array<{ extension: ExtensionRef; value: Contributions[K] }> {
  const { kept } = settle(snapshot, isOn);
  return (
    snapshot
      .filter((entry) => entry.value.kind === kind && isOn(entry.extension.name))
      .map((entry) => ({ entry, keeps: kept.get(entry) ?? [] }))
      // A key whose keys another holds is dropped whole.
      .filter(({ entry, keeps }) => kind !== "key" || keeps.length > 0)
      .sort((a, b) => compare(a.entry, b.entry))
      .map(({ entry, keeps }) => ({
        extension: entry.extension,
        value: listed(entry.value, keeps).value as Contributions[K],
      }))
  );
}

/** The contributions of `kind` in `snapshot` of the extensions `isOn`, in their order. */
export function listOf<K extends ContributionKind>(
  snapshot: Snapshot,
  kind: K,
  isOn: (extension: string) => boolean,
): Array<Contributions[K]> {
  return entriesOf(snapshot, kind, isOn).map((entry) => entry.value);
}

/** The keys dropped in `snapshot` among the extensions `isOn`, each with the one that holds it. */
export const clashesOf = (
  snapshot: Snapshot,
  isOn: (extension: string) => boolean,
): Array<KeyClash> => settle(snapshot, isOn).clashes;

export function createRegistry() {
  let entries: Snapshot = [];
  let seq = 0;
  const listeners = new Set<() => void>();
  const publish = (next: Snapshot) => {
    entries = next;
    for (const listener of listeners) {
      listener();
    }
  };
  const remove = (gone: (entry: Entry) => boolean) => {
    if (entries.some(gone)) {
      publish(entries.filter((entry) => !gone(entry)));
    }
  };
  return {
    /** The keys dropped among the extensions `isOn`, each with the extension that holds it. */
    clashes: (isOn: (extension: string) => boolean) => clashesOf(entries, isOn),
    list: <K extends ContributionKind>(kind: K, isOn: (extension: string) => boolean) =>
      listOf(entries, kind, isOn),
    /**
     * Adds `contribution` of `extension`, a built-in with its `order`, yours without, with every
     * key it claims: which it keeps is settled as the registry lists. Gives back what undoes it.
     */
    register(extension: ExtensionRef, order: number | undefined, contribution: Contribution) {
      seq += 1;
      const entry: Entry = {
        claims: claimsOf(contribution),
        extension,
        order,
        seq,
        value: atPath(extension.name, contribution),
      };
      publish([...entries, entry]);
      return () => remove((one) => one === entry);
    },
    /** Undoes every contribution of the extension `name`, as it unloads. */
    remove: (name: string) => remove((entry) => entry.extension.name === name),
    snapshot: () => entries,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
}

export type Registry = ReturnType<typeof createRegistry>;
