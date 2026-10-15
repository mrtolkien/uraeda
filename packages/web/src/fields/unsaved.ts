import { useMemo, useSyncExternalStore } from "react";
import type { Picked } from "../storyComment.ts";

/** A field's text typed and not saved, as the store keeps it. */
export type Unsaved = {
  /** When it was last typed, ISO 8601. */
  at: string;
  /** The saved text when the edit began. */
  base: string;
  /** A review comment's lines, and the commit they were on. */
  extra?: { commit: string; end: number; heading: string; start: number };
  /** The element picked in an embedded story, which a comment on it names. */
  picked?: Picked;
  /**
   * The comment an edit is of, as its number changes when comments before it go: a settled
   * comment's subject, or a review comment's lines.
   */
  subject?: string;
  /** What the field shows. */
  text: string;
};

/** The start of every key of the store, in `localStorage` too. */
const PREFIX = "uraeda:unsaved:";

/** How long unsaved text is kept: older entries are dropped when the app starts. */
const KEPT_FOR = 30 * 24 * 60 * 60 * 1000;

/** The entries by key: the store's truth, which `localStorage` mirrors when it can. */
const entries = new Map<string, Unsaved>();
let loaded = false;

/** Who listens to one key, and who listens to any. */
const listeners = new Map<string, Set<() => void>>();
const anyListeners = new Set<() => void>();

/** The store's key of a field of a repository, `<path>#notes` for one. */
export function unsavedKey(repo: string, field: string): string {
  return `${PREFIX}${repo}:${field}`;
}

/** Whether a value read from `localStorage` is an entry. */
function isUnsaved(value: unknown): value is Unsaved {
  const entry = value as Unsaved | null;
  return (
    typeof entry === "object" &&
    entry !== null &&
    typeof entry.text === "string" &&
    typeof entry.base === "string" &&
    typeof entry.at === "string"
  );
}

/**
 * Reads the entries `localStorage` holds, once: storage that throws, blocked or missing, leaves
 * the store in memory only.
 */
function load() {
  if (loaded) {
    return;
  }
  loaded = true;
  try {
    const storage = window.localStorage;
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key?.startsWith(PREFIX) && !entries.has(key)) {
        const value: unknown = JSON.parse(storage.getItem(key) ?? "null");
        if (isUnsaved(value)) {
          entries.set(key, value);
        }
      }
    }
  } catch {
    // No storage, or an entry not written by the store: what was read is kept.
  }
}

/** Mirrors a key to `localStorage`, when it can: full or blocked storage keeps it in memory. */
function mirror(key: string, value: Unsaved | undefined) {
  try {
    if (value) {
      window.localStorage.setItem(key, JSON.stringify(value));
    } else {
      window.localStorage.removeItem(key);
    }
  } catch {
    // The entry stays in memory only.
  }
}

function notify(key: string) {
  for (const listener of listeners.get(key) ?? []) {
    listener();
  }
  notifyAny();
}

function notifyAny() {
  for (const listener of anyListeners) {
    listener();
  }
}

/** Whether two texts differ by more than spaces and line breaks at their ends. */
export function differ(a: string, b: string): boolean {
  return a.trim() !== b.trim();
}

/** The entry of a key, if its field holds unsaved text. */
export function readUnsaved(key: string): Unsaved | undefined {
  load();
  return entries.get(key);
}

/** Keeps a field's unsaved text. */
export function writeUnsaved(key: string, value: Unsaved) {
  load();
  entries.set(key, value);
  mirror(key, value);
  notify(key);
}

/** Forgets a field's unsaved text: it was saved, discarded, or equals the saved text again. */
export function dropUnsaved(key: string) {
  load();
  if (!entries.delete(key)) {
    return;
  }
  mirror(key, undefined);
  notify(key);
}

/**
 * Says `value` was saved from a key's field: its entry goes while it still holds that text, and text
 * typed since stays unsaved, over the text saved. Returns whether the entry went.
 */
export function savedUnsaved(key: string, value: string): boolean {
  const now = readUnsaved(key);
  if (now?.text === value) {
    dropUnsaved(key);
    return true;
  }
  if (now) {
    writeUnsaved(key, { ...now, base: value });
  }
  return false;
}

/**
 * Once item `number` of `count` is removed, the entries of the items after it, by their keys
 * `keyOf(number)`, follow their new numbers, one less; its own goes with it.
 */
export function renumberUnsaved(keyOf: (number: number) => string, number: number, count: number) {
  dropUnsaved(keyOf(number));
  for (let after = number + 1; after <= count; after += 1) {
    const entry = readUnsaved(keyOf(after));
    if (entry) {
      writeUnsaved(keyOf(after - 1), entry);
      dropUnsaved(keyOf(after));
    }
  }
}

/** Whether any field whose key starts with `prefix` holds unsaved text: any field, by default. */
export function hasUnsaved(prefix = PREFIX): boolean {
  load();
  for (const key of entries.keys()) {
    if (key.startsWith(prefix)) {
      return true;
    }
  }
  return false;
}

/** Drops the entries last typed more than 30 days before `now`: called once, as the app starts. */
export function pruneUnsaved(now: Date) {
  load();
  for (const [key, entry] of entries) {
    const at = Date.parse(entry.at);
    if (Number.isNaN(at) || now.getTime() - at > KEPT_FOR) {
      dropUnsaved(key);
    }
  }
}

/**
 * Forgets what the store read, as a new page load: the next read takes `localStorage` again.
 * Tests, which mount the app many times in one module, start each one from the storage they set.
 */
export function forgetUnsaved() {
  entries.clear();
  loaded = false;
}

/** The entry of one key, drawn again only when that key changes. */
export function useUnsaved(key: string): Unsaved | undefined {
  return useSyncExternalStore(
    (listener) => {
      let keyed = listeners.get(key);
      if (!keyed) {
        keyed = new Set();
        listeners.set(key, keyed);
      }
      keyed.add(listener);
      return () => {
        keyed.delete(listener);
        if (keyed.size === 0) {
          listeners.delete(key);
        }
      };
    },
    () => readUnsaved(key),
  );
}

/** Listens to every key of the store. */
function subscribeAny(listener: () => void) {
  anyListeners.add(listener);
  return () => {
    anyListeners.delete(listener);
  };
}

/** Which of `keys` hold unsaved text, drawn again as any entry changes. */
export function useUnsavedOf(keys: ReadonlyArray<string>): ReadonlySet<string> {
  const held = useSyncExternalStore(subscribeAny, () =>
    keys.filter((key) => readUnsaved(key)).join("\n"),
  );
  return useMemo(() => new Set(held ? held.split("\n") : []), [held]);
}

/**
 * The fields drawn now, each with its key and its saved text: only their unsaved text is on the
 * page. An entry whose field is not drawn, like a sheet's comment once the sheet closed, is kept
 * for when it shows again, and is not on the page.
 */
const drawn = new Map<object, { key: string; saved: string }>();

/** Says a field is drawn, by an object of its own, until the function returned is called. */
export function drawField(field: object, key: string, saved: string): () => void {
  drawn.set(field, { key, saved });
  notifyAny();
  return () => {
    drawn.delete(field);
    notifyAny();
  };
}

/** Whether a field drawn now holds text that differs from its saved text: what leaving loses. */
export function hasDrawnUnsaved(): boolean {
  load();
  for (const { key, saved } of drawn.values()) {
    const entry = entries.get(key);
    if (entry && differ(entry.text, saved)) {
      return true;
    }
  }
  return false;
}

/** Whether a field drawn now holds unsaved text, drawn again as it changes. */
export function useHasDrawnUnsaved(): boolean {
  return useSyncExternalStore(subscribeAny, hasDrawnUnsaved);
}
