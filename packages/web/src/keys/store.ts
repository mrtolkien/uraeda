// What the key registry holds: the bindings every mounted component declared, in the order they
// were declared, with the rules over them. A key never means two things, a key is one `tokenOf` can
// give, or it would never run, and a sequence goes through groups `groups.ts` names, or the menu
// would draw nothing for them: all three throw in every build but production, so any page's test
// catches them. A selection's keys, a held stop's own, run before the page's and the shell's, and
// may reuse their keys: a key may mean something else while a selection holds, shown on it. Across
// layers, still, a key never starts another's sequence, and a selection has no fallback.
// The single-key switch drops the bindings whose first key is one printable character, and the hints
// the status line draws come from the page's and the shell's bindings that name one. A plain
// store, read through `useSyncExternalStore`: a handler is never published, so a re-render with a
// new closure tells no reader.
import type { Icon } from "@astryxdesign/core/Icon";
import type { ComponentProps } from "react";
import { GROUPS } from "./groups.ts";
import { isCanonical, isSingleKey } from "./match.ts";

/** An icon's name, as Astryx's `Icon` takes it. */
export type IconName = ComponentProps<typeof Icon>["icon"];

export type Binding = {
  /** Runs only when no other binding of the key ran. At most one fallback per key. */
  fallback?: boolean;
  /** The status line's text for the key or keys, "j k": absent means no hint. */
  hint?: string;
  /**
   * Still named while a layer is open, for the keys a layer's owner declares. Only the hint stays:
   * the binding's `run` never fires under a layer, whose owner takes its own keys.
   */
  hintInLayer?: boolean;
  /** The words the status line says after the hint's keys, where they are not the binding's label. */
  hintLabel?: string;
  /** The keys a click on the hint presses, where they are not the binding's own: "space". */
  hintPress?: string;
  icon?: IconName;
  /**
   * One token, or tokens separated by spaces for a sequence: "j", "J", "ArrowDown", "Home",
   * "shift+ArrowDown", "mod+k", "g h", "space n n". Space is "space"; a printable key is the
   * character typed; a named key is as `event.key` spells it. A token `tokenOf` cannot give throws.
   */
  keys: string;
  label: string;
  /** Returning `false` says nothing was done, and the key goes on to a fallback. */
  run: (event: KeyboardEvent) => void | false;
  /**
   * An extra guard on the event's target; absent means any target outside a text field. A key's
   * conflicts are checked among every declared binding whatever its guard says: a component whose
   * keys are not the active ones declares none.
   */
  when?: (target: EventTarget | null) => boolean;
};

/**
 * Who declares: a page or a list, whose hints show first, the shell, whose hints follow, or a held
 * selection, whose keys run before both and whose hints its stop draws, never the status line.
 */
export type Place = "page" | "shell" | "selection";

/** A binding and who declared it, as the key map lists it. */
export type Placed = { binding: Binding; place: Place };

/** A key that works, and what it does, as the status line shows it: "j k" "move". */
export type StatusHint = {
  keys: string;
  label: string;
  /** The keys of the binding that named it, which a click on the hint presses. */
  press: string;
};

/** A hint of the registry, and whether it stays while a layer is open. */
export type Hint = StatusHint & { inLayer: boolean };

type Entry = { bindings: ReadonlyArray<Binding>; place: Place };

const tokens = (keys: string) => keys.split(" ");

/**
 * What two bindings of the registry say about each other, `null` if they agree. Bindings of
 * different layers may share a key, the selection's winning, but never a key and a sequence it
 * starts, whose pending would swallow the key.
 */
function clash(a: Binding, b: Binding, sameLayer: boolean) {
  const ta = tokens(a.keys);
  const tb = tokens(b.keys);
  const length = Math.min(ta.length, tb.length);
  if (!ta.slice(0, length).every((token, index) => token === tb[index])) {
    return null;
  }
  if (ta.length !== tb.length) {
    const [key, sequence] = ta.length < tb.length ? [a, b] : [b, a];
    return `"${key.keys}" (${key.label}) is a key and the start of the sequence "${sequence.keys}" (${sequence.label})`;
  }
  if (!sameLayer) {
    return null;
  }
  if (a.fallback === true && b.fallback === true) {
    return `"${a.keys}" has two fallbacks, ${a.label} and ${b.label}`;
  }
  return a.fallback === true || b.fallback === true
    ? null
    : `"${a.keys}" is bound twice, to ${a.label} and to ${b.label}`;
}

/**
 * Throws where `mine`, declared beside `others`, makes a key mean two things: `ours` are the
 * bindings of `mine`'s layer, `theirs` the other layer's.
 */
function assertNoClash(
  ours: ReadonlyArray<Binding>,
  theirs: ReadonlyArray<Binding>,
  mine: ReadonlyArray<Binding>,
) {
  mine.forEach((binding, index) => {
    const pairs = [
      ...[...ours, ...mine.slice(0, index)].map((other) => clash(other, binding, true)),
      ...theirs.map((other) => clash(other, binding, false)),
    ];
    const problem = pairs.find((pair) => pair !== null);
    if (problem !== undefined && problem !== null) {
      throw new Error(`A key means two things on this page: ${problem}`);
    }
  });
}

/**
 * Throws where a selection's binding is a fallback: the bindings run selection first, so it would
 * run after the page's ordinary binding of its key, never before. A selection's key that did
 * nothing returns `false`, and the page's runs.
 */
function assertNoSelectionFallback(bindings: ReadonlyArray<Binding>) {
  const fallback = bindings.find((binding) => binding.fallback === true);
  if (fallback !== undefined) {
    throw new Error(
      `"${fallback.keys}" (${fallback.label}) is a selection's fallback, which would run after ` +
        `the page's binding of its key: return false from its run instead`,
    );
  }
}

/** Throws where a binding's keys are not tokens `tokenOf` gives: such a binding never runs. */
function assertCanonical(bindings: ReadonlyArray<Binding>) {
  for (const { keys, label } of bindings) {
    const bad = tokens(keys).find((token) => !isCanonical(token));
    if (bad !== undefined) {
      throw new Error(
        `"${keys}" (${label}) can never run: "${bad}" is not a key as the browser names it ` +
          `(modifiers lowercase, "mod+" only before a lowercase character or a named key, ` +
          `named keys as in event.key, Space as "space")`,
      );
    }
  }
}

/**
 * Throws where a sequence goes through a group `groups.ts` does not name: its keys would work, and
 * the menu would draw nothing for it. The first key is the root, not a group.
 */
function assertGroupsNamed(bindings: ReadonlyArray<Binding>) {
  for (const { keys, label } of bindings) {
    const path = tokens(keys);
    for (let length = 2; length < path.length; length += 1) {
      const group = path.slice(0, length).join(" ");
      if (GROUPS[group] === undefined) {
        throw new Error(
          `"${keys}" (${label}) goes through the group "${group}", which groups.ts does not name`,
        );
      }
    }
  }
}

/** The hints that come first in the status line, by their keys, in this order. */
const FIRST_HINTS = ["space", "?", "[ ]"];

/** A hint's place among the first hints, by its keys: past them for any other. */
const rank = (keys: string) => {
  const at = FIRST_HINTS.indexOf(keys);
  return at === -1 ? FIRST_HINTS.length : at;
};

/** The status line's hints of `bindings`, each once, the first hints first. */
function hintsOf(bindings: ReadonlyArray<Binding>): Array<Hint> {
  const seen = new Set<string>();
  const next = bindings.flatMap((binding) => {
    const hint = {
      inLayer: binding.hintInLayer === true,
      keys: binding.hint,
      label: binding.hintLabel ?? binding.label,
      press: binding.hintPress ?? binding.keys,
    };
    const id = `${hint.keys} ${hint.label}`;
    if (hint.keys === undefined || seen.has(id)) {
      return [];
    }
    seen.add(id);
    return [{ ...hint, keys: hint.keys }];
  });
  // The leader's hint, "space menu", is always the first, the way into every other key, the key
  // map's, "? keys", the second, and the sidebars' folds the third; the others keep their order
  // after them.
  next.sort((a, b) => rank(a.keys) - rank(b.keys));
  return next;
}

export function createKeyStore(initialSingleKeys: boolean) {
  const entries = new Map<string, Entry>();
  const listeners = new Set<() => void>();
  let singleKeys = initialSingleKeys;
  let hints: ReadonlyArray<Hint> = [];

  /**
   * Every declared binding with its place, the selection's first, then the page's, then the
   * shell's, each in the order declared: the first that runs wins.
   */
  const placed = (): Array<Placed> =>
    (["selection", "page", "shell"] as const).flatMap((place) =>
      [...entries.values()]
        .filter((entry) => entry.place === place)
        .flatMap((entry) => entry.bindings.map((binding) => ({ binding, place }))),
    );

  /** Every declared binding, in `placed`'s order. */
  const declared = () => placed().map(({ binding }) => binding);

  /** Whether a binding is on: with the switch off, not a single-key one. */
  const isOn = (binding: Binding) => singleKeys || !isSingleKey(binding.keys);

  /** The bindings that are on. */
  const active = () => declared().filter(isOn);

  /** Publishes the hints, to the readers only when their text changed. */
  const publish = () => {
    // A selection's hints are drawn on its stop, beside what they act on.
    const next = hintsOf(
      placed().flatMap(({ binding, place }) =>
        place !== "selection" && isOn(binding) ? [binding] : [],
      ),
    );
    if (JSON.stringify(next) !== JSON.stringify(hints)) {
      hints = next;
      for (const listener of listeners) {
        listener();
      }
    }
  };

  return {
    active,
    /** Every binding, switch or not: the menu the Ctrl or Cmd+K chord opens walks its tree. */
    all: declared,
    getHints: () => hints,
    /** Every binding with its place, switch or not: what the key map lists. */
    getSingleKeys: () => singleKeys,
    listed: placed,
    /** The bindings of a one-token key that are on. */
    matching: (token: string) => active().filter((binding) => binding.keys === token),
    remove(id: string) {
      entries.delete(id);
      publish();
    },
    /** Declares, or replaces, a component's bindings: it keeps its place in the order. */
    set(id: string, place: Place, bindings: ReadonlyArray<Binding>) {
      if (process.env.NODE_ENV !== "production") {
        assertCanonical(bindings);
        assertGroupsNamed(bindings);
        const isSelection = place === "selection";
        if (isSelection) {
          assertNoSelectionFallback(bindings);
        }
        // A selection's keys may mean something else than the page's and the shell's, but a key
        // never starts a sequence of any layer.
        const others = [...entries].filter(([other]) => other !== id).map(([, entry]) => entry);
        const ofLayer = (same: boolean) =>
          others
            .filter((entry) => (entry.place === "selection") === (isSelection === same))
            .flatMap((entry) => entry.bindings);
        assertNoClash(ofLayer(true), ofLayer(false), bindings);
      }
      entries.set(id, { bindings, place });
      publish();
    },
    setSingleKeys(on: boolean) {
      const changed = singleKeys !== on;
      singleKeys = on;
      publish();
      if (changed) {
        // A reader of the switch itself hears it, whether or not a hint's text changed.
        for (const listener of listeners) {
          listener();
        }
      }
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
}

export type KeyStore = ReturnType<typeof createKeyStore>;
