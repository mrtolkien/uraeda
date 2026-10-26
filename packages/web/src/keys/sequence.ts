// The sequences' state machine, pure: what a key does to a pending sequence of the leader menu
// (`space n n`) or of `g` (`g i`), with no timer and no event. A step is the keys pressed so far,
// the first included, and whether the menu showing them is shown yet; the delays that show or end a
// step are the leader's (`leader.ts`), over this. One-token bindings are not run here: the listener
// runs those, with their fallbacks.
import { isPrintable } from "./match.ts";
import type { Binding } from "./store.ts";
import { GROUPS } from "./groups.ts";
import type { MenuEntry } from "./LeaderMenu.tsx";

export type Step = { isShown: boolean; path: ReadonlyArray<string> };

export type Result = {
  /** The key belongs to the sequence, though nothing ran: the page does not hear it. */
  consumed: boolean;
  /** The keys of the binding the token completed. */
  ran: string | null;
  step: Step | null;
};

/** The first key of the leader's tree, and the chord that opens it when letters are off. */
export const LEADER = "space";
export const CHORD = "mod+k";

/** The icon of an entry whose binding names none. */
const RUNS: MenuEntry["icon"] = "uraeda:enter";

const tokensOf = (keys: string) => keys.split(" ");
const startsWith = (tokens: ReadonlyArray<string>, prefix: ReadonlyArray<string>) =>
  prefix.every((token, index) => tokens[index] === token);

const PASSED: Result = { consumed: false, ran: null, step: null };

/** Keys that are no menu keys: a chord (not the leader's own), and Tab, which moves the focus. */
const isPassing = (token: string) =>
  token === "Tab" || (token !== CHORD && token.length > 1 && token.includes("+"));

const ENDED: Result = { consumed: true, ran: null, step: null };

/** What the key does at `step`, `null` for no sequence pending. */
export function next(
  bindings: ReadonlyArray<Pick<Binding, "keys">>,
  step: Step | null,
  token: string,
): Result {
  const all = bindings.map((binding) => tokensOf(binding.keys));
  if (step === null) {
    const first = token === CHORD ? LEADER : token;
    return all.some((tokens) => tokens.length > 1 && tokens[0] === first)
      ? { consumed: true, ran: null, step: { isShown: false, path: [first] } }
      : { consumed: false, ran: null, step: null };
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
  // A named key no binding uses is the browser's (F5 reloads, PageDown pages, Enter presses, an
  // arrow moves): it ends the sequence and goes on. Only a printable key, or Space, is "x does
  // nothing".
  if (token !== "space" && !isPrintable(token)) {
    return PASSED;
  }
  // An unbound key leaves the leader's menu the human reads open; `g`'s sequence, shown or not,
  // and one typed fast just end.
  return step.isShown && step.path[0] === LEADER ? { consumed: true, ran: null, step } : ENDED;
}

/**
 * What each next key does at `path`, in the order the bindings were declared: a leaf runs, a group
 * opens the next step. A binding whose `when` is false for `target`, where the key is pressed, is
 * not listed, as `leader.press` does not run it. A group no feature named in `groups.ts` has no
 * entry, though the store throws for one.
 */
export function entriesAt(
  bindings: ReadonlyArray<Pick<Binding, "icon" | "keys" | "label" | "when">>,
  path: ReadonlyArray<string>,
  target: EventTarget | null = null,
): Array<MenuEntry> {
  const entries = new Map<string, MenuEntry>();
  for (const binding of bindings) {
    // A binding whose guard is false for the target does not run at the key, so it is not listed.
    if (binding.when?.(target) === false) {
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
