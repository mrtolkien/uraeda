// The sequences' state machine, pure: what a key does to a pending sequence of the leader menu
// (`space n n`) or of `g` (`g i`), with no timer and no event. A step is the keys pressed so far,
// the first included, and whether the menu showing them is shown yet; the delay that shows a step
// is the leader's (`leader.ts`), over this. One-token bindings are not run here: the registry runs
// those, with their fallbacks.
//
// It stays in TSX: one call a key, over the few dozen bindings that are on (ruling R140).
import { GROUPS } from "./groups";
import { CHORD, isPrintable, LEADER } from "./token";

export type Step = { isShown: boolean; path: ReadonlyArray<string> };

export type Result = {
  /** The key belongs to the sequence, though nothing ran: the page does not hear it. */
  consumed: boolean;
  /** The key is none of the step's: the sequence ends, and the status line says so. */
  missed?: boolean;
  /** The keys of the binding the token completed. */
  ran: string | null;
  step: Step | null;
};

/** What a key does at a step of the menu: a group opens the next step, anything else runs. */
export type MenuEntry = { icon: string; isGroup?: boolean; key: string; label: string };

/** A binding as the machine reads it. */
type Bound = { icon?: string; keys: string; label: string; when?: () => boolean };

/** The icon of an entry whose binding names none. */
const RUNS = "enter";

const tokensOf = (keys: string) => keys.split(" ");
const startsWith = (tokens: ReadonlyArray<string>, prefix: ReadonlyArray<string>) =>
  prefix.every((token, index) => tokens[index] === token);

const PASSED: Result = { consumed: false, ran: null, step: null };
const ENDED: Result = { consumed: true, ran: null, step: null };
const MISSED: Result = { ...ENDED, missed: true };

/** Keys that are no menu keys: a chord (not the leader's own), and Tab, which moves the focus. */
const isPassing = (token: string) =>
  token === "Tab" || (token !== CHORD && token.length > 1 && token.includes("+"));

/** What the key does at `step`, `null` for no sequence pending. */
export function next(
  bindings: ReadonlyArray<Pick<Bound, "keys">>,
  step: Step | null,
  token: string,
): Result {
  const all = bindings.map((binding) => tokensOf(binding.keys));
  if (step === null) {
    const first = token === CHORD ? LEADER : token;
    return all.some((tokens) => tokens.length > 1 && tokens[0] === first)
      ? { consumed: true, ran: null, step: { isShown: false, path: [first] } }
      : PASSED;
  }
  if (token === "Escape") {
    return ENDED;
  }
  if (token === "Backspace") {
    const up = step.path.length > 1 ? { ...step, path: step.path.slice(0, -1) } : null;
    return { consumed: true, ran: null, step: up };
  }
  if (token === CHORD) {
    return { consumed: true, ran: null, step: { ...step, path: [LEADER] } };
  }
  if (isPassing(token)) {
    return PASSED;
  }
  const path = [...step.path, token];
  const done = all.findIndex((tokens) => tokens.length === path.length && startsWith(tokens, path));
  if (done >= 0) {
    return { consumed: true, ran: bindings[done]?.keys ?? null, step: null };
  }
  if (all.some((tokens) => tokens.length > path.length && startsWith(tokens, path))) {
    return { consumed: true, ran: null, step: { ...step, path } };
  }
  // A named key no sequence uses is its owner's (Enter presses, an arrow moves): it ends the
  // sequence and goes on. Only a printable key, or Space, is "x does nothing".
  if (token !== LEADER && !isPrintable(token)) {
    return PASSED;
  }
  // Any other key is none of the step's: the menu closes, as LazyVim's which-key does, and the
  // key does nothing else, for it was meant for the menu.
  return MISSED;
}

/**
 * What each next key does at `path`, in the order the bindings were declared: a leaf runs, a group
 * opens the next step. A binding whose guard refuses is not listed, as it would not run.
 */
export function entriesAt(
  bindings: ReadonlyArray<Bound>,
  path: ReadonlyArray<string>,
): Array<MenuEntry> {
  const entries = new Map<string, MenuEntry>();
  for (const binding of bindings) {
    if (binding.when?.() === false) {
      continue;
    }
    const tokens = tokensOf(binding.keys);
    const key = tokens[path.length];
    if (key === undefined || entries.has(key) || !startsWith(tokens, path)) {
      continue;
    }
    if (tokens.length === path.length + 1) {
      entries.set(key, { icon: binding.icon ?? RUNS, key, label: binding.label });
      continue;
    }
    const group = GROUPS[[...path, key].join(" ")];
    if (group !== undefined) {
      entries.set(key, { ...group, isGroup: true, key });
    }
  }
  return [...entries.values()];
}

/** Whether a key is a letter or a digit: the keys that are not come first. */
const isLetter = (key: string) => /^[\p{L}\p{N}]$/u.test(key);

/** The entries in alphabetical order of their keys, Space and the symbols first. */
export function sortedEntries(entries: ReadonlyArray<MenuEntry>): Array<MenuEntry> {
  return entries.toSorted((a, b) => {
    if (a.key === LEADER || b.key === LEADER) {
      return a.key === b.key ? 0 : a.key === LEADER ? -1 : 1;
    }
    if (isLetter(a.key) !== isLetter(b.key)) {
      return isLetter(a.key) ? 1 : -1;
    }
    return a.key.localeCompare(b.key, "en", { sensitivity: "base" }) || (a.key < b.key ? 1 : -1);
  });
}
