// What the key registry holds: the bindings every mounted component declared, in the order they
// were declared, with the rules over them. A key never means two things, and a key is one `tokenOf`
// can give, or it would never run: both throw in every build but production, so any page's test
// catches them. The single-key switch drops the bindings whose first key is one printable
// character, and the hints the status line draws come from the bindings that name one. A plain
// store, read through `useSyncExternalStore`: a handler is never published, so a re-render with a
// new closure tells no reader.
import type { Icon } from "@astryxdesign/core/Icon";
import type { ComponentProps } from "react";
import type { StatusHint } from "../statusHints.tsx";
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

/** Who declares: a page or a list, whose hints show first, or the shell, whose hints follow. */
export type Place = "page" | "shell";

/** A hint of the registry, and whether it stays while a layer is open. */
export type Hint = StatusHint & { inLayer: boolean };

type Entry = { bindings: ReadonlyArray<Binding>; place: Place };

const tokens = (keys: string) => keys.split(" ");

/** What two bindings of the registry say about each other, `null` if they agree. */
function clash(a: Binding, b: Binding) {
  const ta = tokens(a.keys);
  const tb = tokens(b.keys);
  const length = Math.min(ta.length, tb.length);
  if (!ta.slice(0, length).every((token, index) => token === tb[index])) {
    return null;
  }
  if (ta.length !== tb.length) {
    return `"${a.keys}" (${a.label}) is a key and the start of the sequence "${b.keys}" (${b.label})`;
  }
  if (a.fallback === true && b.fallback === true) {
    return `"${a.keys}" has two fallbacks, ${a.label} and ${b.label}`;
  }
  return a.fallback === true || b.fallback === true
    ? null
    : `"${a.keys}" is bound twice, to ${a.label} and to ${b.label}`;
}

/** Throws where `mine`, declared beside `others`, makes a key mean two things. */
function assertNoClash(others: ReadonlyArray<Binding>, mine: ReadonlyArray<Binding>) {
  mine.forEach((binding, index) => {
    for (const other of [...others, ...mine.slice(0, index)]) {
      const problem = clash(other, binding);
      if (problem !== null) {
        throw new Error(`A key means two things on this page: ${problem}`);
      }
    }
  });
}

/** Throws where a binding's keys are not tokens `tokenOf` gives: such a binding never runs. */
function assertCanonical(bindings: ReadonlyArray<Binding>) {
  for (const { keys, label } of bindings) {
    const bad = tokens(keys).find((token) => !isCanonical(token));
    if (bad !== undefined) {
      throw new Error(
        `"${keys}" (${label}) can never run: "${bad}" is not a key as the browser names it ` +
          `(modifiers lowercase, "mod+" only before a printable character, named keys as in ` +
          `event.key, Space as "space")`,
      );
    }
  }
}

export function createKeyStore(initialSingleKeys: boolean) {
  const entries = new Map<string, Entry>();
  const listeners = new Set<() => void>();
  let singleKeys = initialSingleKeys;
  let hints: ReadonlyArray<Hint> = [];

  /** Every declared binding, the page's first, each place in the order they were declared. */
  const declared = () =>
    (["page", "shell"] as const).flatMap((place) =>
      [...entries.values()].filter((entry) => entry.place === place).flatMap((e) => e.bindings),
    );

  /** The bindings that are on: with the switch off, not the single-key ones. */
  const active = () => declared().filter((binding) => singleKeys || !isSingleKey(binding.keys));

  /** Publishes the hints, to the readers only when their text changed. */
  const publish = () => {
    const seen = new Set<string>();
    const next = active().flatMap((binding) => {
      const hint = {
        inLayer: binding.hintInLayer === true,
        keys: binding.hint,
        label: binding.label,
      };
      const id = `${hint.keys} ${hint.label}`;
      if (hint.keys === undefined || seen.has(id)) {
        return [];
      }
      seen.add(id);
      return [{ ...hint, keys: hint.keys }];
    });
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
        const others = [...entries].filter(([other]) => other !== id);
        assertNoClash(
          others.flatMap(([, entry]) => entry.bindings),
          bindings,
        );
      }
      entries.set(id, { bindings, place });
      publish();
    },
    setSingleKeys(on: boolean) {
      singleKeys = on;
      publish();
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
}

export type KeyStore = ReturnType<typeof createKeyStore>;
