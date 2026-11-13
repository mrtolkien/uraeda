// What the key registry holds: the keys every mounted component declared, each in its scope, with
// the rules over them. A scope is where keys are on together: the shell, a page, a pane of a page
// while it has the focus, a held selection, an open layer. A key never means two things where two
// scopes can be on together, a key is one a keyboard gives, and a sequence goes through groups
// `groups.ts` names: each fails as it is declared, so any screen's test catches it; a release build
// names it and leaves that one key out, keeping the app up (`KeyStoreOptions`).
//
// - Two panes of one parent are never on together: each may have its own `j`.
// - A held selection's keys run before the page's and the shell's, and may reuse their keys: a key
//   may mean something else while a selection holds, shown on it.
// - An open layer owns the keys: only the newest layer's scopes are on, and its keys are its own.
// - A key never starts another's sequence where both can be on, a selection's included.
//
// Reads are tracked, as a signal's: an effect or a view that reads `active()` or `hints()` runs
// again when a key is declared or removed, a scope turns on or off, or the switch moves.
import { signal } from "nsh";
import { GROUPS } from "./groups";
import { isSingleKey, strokeOf } from "./token";

/** A shortcut, as the component that owns its action declares it. */
export type KeySpec = {
  /** Runs only when no other binding of the key did something. At most one fallback per key. */
  fallback?: boolean;
  /** The status line's text for the key or keys, "j k": absent means no hint. */
  hint?: string;
  /** The words the status line says after the hint's keys, where they are not the label. */
  hintLabel?: string;
  /** The keys a press on the hint presses, where they are not the binding's own: "space". */
  hintPress?: string;
  /** The icon's name, as the leader menu and the key map draw it. */
  icon?: string;
  /**
   * Heard while a text field has the focus too, before the field: for a layer's keys around its
   * own field, as a picker's arrows and Enter. Never a key that types: a field gets those first.
   */
  inField?: boolean;
  /**
   * One token, or tokens separated by spaces for a sequence: "j", "J", "ArrowDown", "Home",
   * "shift+ArrowDown", "mod+k", "g h", "space n n" (`token.ts`).
   */
  keys: string;
  /** What the key does, as the leader menu and the key map say it. */
  label: string;
  /** Runs again while the key is held, as a key that moves does. A sequence never repeats. */
  repeat?: boolean;
  /** Returning `false` says nothing was done, and the key goes on to a fallback. */
  run: () => void | false;
  /** An extra guard, read as the key comes: the binding is off, and unlisted, while it refuses. */
  when?: () => boolean;
};

/**
 * Where keys are on together. The shell's scope is the registry's own; a page's keys are on while
 * it is mounted; a pane's while `on` says it has the focus; a selection's while it holds; a
 * layer's while it is open, over every other.
 */
export type ScopeKind = "shell" | "page" | "pane" | "selection" | "layer";

export type ScopeSpec = {
  /** A page, unless given. */
  kind?: Exclude<ScopeKind, "shell">;
  /** What the key map titles its keys, and what a clash's message names: "Inbox". */
  name: string;
  /** Whether its keys are on, read as a signal: always while it exists, unless given. */
  on?: () => boolean;
};

export type Scope = {
  readonly id: number;
  readonly kind: ScopeKind;
  readonly name: string;
  readonly on: () => boolean;
  readonly parent: Scope | null;
};

/** A declared key and where it was declared, as the key map lists it. */
export type Declared = { readonly scope: Scope; readonly spec: KeySpec };

/** A key the registry refused in a release build, and why: it never runs, and the key map says so. */
export type Refused = Declared & { readonly problem: string };

/**
 * How the registry meets a key that could never run, or would mean two things. `strict`, in
 * development and tests, throws, so any screen's test catches it. Otherwise, in a release build,
 * it reports it (`report`, the console's error unless given), keeps the bindings declared before,
 * and leaves that one key out: a slip in one screen never takes the app down (ruling R515).
 */
export type KeyStoreOptions = { report?: (words: string) => void; strict?: boolean };

/** A key that works, and what it does, as the status line shows it: "j k" "move". */
export type StatusHint = {
  keys: string;
  label: string;
  /** The keys of the binding that named it, which a press on the hint presses. */
  press: string;
};

const tokens = (keys: string) => keys.split(" ");

/** The layer a scope is in, itself for a layer: none for the page under every layer. */
const layerOf = (scope: Scope): Scope | null =>
  scope.kind === "layer" ? scope : scope.parent === null ? null : layerOf(scope.parent);

/** The held selection a scope is in, itself for a selection, inside its layer. */
const selectionOf = (scope: Scope): Scope | null =>
  scope.kind === "selection"
    ? scope
    : scope.parent === null || scope.kind === "layer"
      ? null
      : selectionOf(scope.parent);

/** A scope's ancestors, from the shell down to itself. */
const pathOf = (scope: Scope): Array<Scope> =>
  scope.parent === null ? [scope] : [...pathOf(scope.parent), scope];

/**
 * Whether two scopes can be on together: not in two layers, not in two panes of one parent, and
 * not a pane and a selection beside it. The layout shell's tabs are that selection: they hold the
 * keys only while no pane of the frame has them, so a pane's own keys, a held row's included, may
 * reuse the tabs' `j` and `Enter`.
 */
function mayMeet(a: Scope, b: Scope) {
  if (layerOf(a) !== layerOf(b)) {
    return false;
  }
  const [pa, pb] = [pathOf(a), pathOf(b)];
  const apart = pa.findIndex((scope, index) => scope !== pb[index]);
  const [ours, theirs] = [pa[apart], pb[apart]];
  // One holds the other, or they are one scope.
  if (apart === -1 || ours === undefined || theirs === undefined) {
    return true;
  }
  const kinds = [ours.kind, theirs.kind].toSorted().join(" ");
  return kinds !== "pane pane" && kinds !== "pane selection";
}

/** What two declared keys say about each other, `null` if they agree. */
function clash(a: Declared, b: Declared) {
  const [ta, tb] = [tokens(a.spec.keys), tokens(b.spec.keys)];
  const length = Math.min(ta.length, tb.length);
  // Most keys share nothing: the scopes are compared only for two that do.
  if (!ta.slice(0, length).every((token, index) => token === tb[index])) {
    return null;
  }
  if (!mayMeet(a.scope, b.scope)) {
    return null;
  }
  if (ta.length !== tb.length) {
    // Whoever holds: the pending sequence would swallow the key.
    const [key, sequence] = ta.length < tb.length ? [a.spec, b.spec] : [b.spec, a.spec];
    return `"${key.keys}" (${key.label}) is a key and the start of the sequence "${sequence.keys}" (${sequence.label})`;
  }
  // A selection's key is another meaning while it holds, of the page's key or the shell's.
  if ((selectionOf(a.scope) === null) !== (selectionOf(b.scope) === null)) {
    return null;
  }
  if (a.spec.fallback === true && b.spec.fallback === true) {
    return `"${a.spec.keys}" has two fallbacks, ${a.spec.label} and ${b.spec.label}`;
  }
  return a.spec.fallback === true || b.spec.fallback === true
    ? null
    : `"${a.spec.keys}" is bound twice, to ${a.spec.label} and to ${b.spec.label}`;
}

/** Why a key could never work as declared, `null` when it can. */
function flaw({ scope, spec }: Declared) {
  const { keys, label } = spec;
  const path = tokens(keys);
  const bad = path.find((token) => strokeOf(token) === null);
  if (bad !== undefined) {
    return (
      `"${keys}" (${label}) can never run: "${bad}" is no key the registry hears (modifiers ` +
      `are "mod+" and "shift+", lowercase, "mod+" before a lowercase character or a named key, ` +
      `named keys as in "ArrowDown", Space as "space", and never a key the system keeps)`
    );
  }
  for (let length = 2; length < path.length; length += 1) {
    const group = path.slice(0, length).join(" ");
    if (GROUPS[group] === undefined) {
      return `"${keys}" (${label}) goes through the group "${group}", which groups.ts does not name`;
    }
  }
  if (spec.inField === true && isSingleKey(keys)) {
    return `"${keys}" (${label}) types in a text field, which gets its keys first: it cannot be heard there`;
  }
  if (spec.repeat === true && path.length > 1) {
    return `"${keys}" (${label}) is a sequence, which a held key never runs again`;
  }
  // The keys run selection first, so its fallback would run after the page's own binding.
  if (spec.fallback === true && selectionOf(scope) !== null) {
    return `"${keys}" (${label}) is a selection's fallback: return false from its run instead`;
  }
  return null;
}

/** The hints that come first in the status line, by their keys, in this order: how to learn more. */
const FIRST_HINTS = ["space", "?"];

/** Whether a scope is a pane's, or inside one. */
const inPane = (scope: Scope): boolean =>
  scope.kind === "pane" ||
  (scope.parent !== null && scope.kind !== "layer" && inPane(scope.parent));

/**
 * Where a hint stands in the status line: the menu and the map, then the keys nearest the focus, a
 * held selection's, the focused pane's, the page's and the frame's, the shell's last. A line too
 * short for them all hides the last whole.
 */
const rank = ({ scope, spec }: Declared) => {
  const at = FIRST_HINTS.indexOf(spec.hint ?? "");
  if (at !== -1) return at;
  const near = selectionOf(scope) !== null ? 0 : inPane(scope) ? 1 : scope.kind === "shell" ? 3 : 2;
  return FIRST_HINTS.length + near;
};

/** Who runs first: a held selection, then the page with its panes and layers, then the shell. */
const order = (scope: Scope) => (selectionOf(scope) !== null ? 0 : scope.kind === "shell" ? 2 : 1);

export function createKeyStore(options: KeyStoreOptions = {}) {
  const strict = options.strict ?? process.env.NODE_ENV !== "production";
  const report = options.report ?? ((words: string) => console.error(words));
  const shell: Scope = { id: 0, kind: "shell", name: "Everywhere", on: () => true, parent: null };
  const scopes = new Set<Scope>([shell]);
  const keepers = new Set<() => boolean>();
  let declared: Array<Declared> = [];
  let refused: Array<Refused> = [];
  let nextId = 1;
  /** Moves at each change of what is declared, so a read of it is tracked. */
  const changes = signal(0);
  const changed = () => changes.update((count) => count + 1);
  const singleKeys = signal(true);

  /** Whether a scope's keys are on, the layers aside: a layer answers for itself alone. */
  const isOn = (scope: Scope): boolean =>
    scope.on() && (scope.parent === null || scope.kind === "layer" || isOn(scope.parent));

  /** The newest open layer, which owns the keys: none while the page has them. */
  const topLayer = () =>
    [...scopes].reduce<Scope | null>(
      (top, scope) =>
        scope.kind === "layer" && isOn(scope) && (top === null || scope.id > top.id) ? scope : top,
      null,
    );

  /** Every declared key, a held selection's first, then the page's, then the shell's. */
  const listed = (): Array<Declared> => {
    changes();
    return [0, 1, 2].flatMap((place) => declared.filter(({ scope }) => order(scope) === place));
  };

  /** Whether a scope's keys are on: in the newest layer, and on. */
  const here = (scope: Scope) => layerOf(scope) === topLayer() && isOn(scope);

  /** The keys whose scope is on, whatever the switch says: what a chord's menu walks. */
  const on = (): Array<Declared> => listed().filter(({ scope }) => here(scope));

  /** The keys that work: on, and with the switch off, not a single-key one. */
  const active = () => on().filter(({ spec }) => singleKeys() || !isSingleKey(spec.keys));

  const allowed = ({ spec }: Declared) => spec.when?.() ?? true;

  return {
    active,
    /**
     * The status line's hints, each once, in `rank`'s order: the leader's and the key map's, then
     * a held selection's, the focused pane's, the page's and the frame's, the shell's. A
     * selection's keys are hinted only while it holds, as a round's letters while a question is
     * shown. `inField`: a text field has the focus.
     */
    hints(inField = false): Array<StatusHint> {
      const seen = new Set<string>();
      const found = active().flatMap((key) => {
        const { spec } = key;
        const label = spec.hintLabel ?? spec.label;
        const id = `${spec.hint} ${label}`;
        // A guarded key is hinted only where its guard holds: on the row it acts on; in a field
        // with the focus, only a key the field lets through.
        const heard = !inField || spec.inField === true;
        if (spec.hint === undefined || !heard || !allowed(key) || seen.has(id)) {
          return [];
        }
        seen.add(id);
        return [{ hint: { keys: spec.hint, label, press: spec.hintPress ?? spec.keys }, key }];
      });
      return found.toSorted((a, b) => rank(a.key) - rank(b.key)).map(({ hint }) => hint);
    },
    /**
     * Says a control keeps Space while `kept` holds, as a checkbox with the focus does: the
     * leader then leaves Space to it. Returns what takes the word back.
     */
    keepSpace(kept: () => boolean) {
      keepers.add(kept);
      changed();
      return () => {
        keepers.delete(kept);
        changed();
      };
    },
    /** Whether a control keeps Space now. */
    keepsSpace() {
      changes();
      return [...keepers].some((kept) => kept());
    },
    /**
     * Whether the keys declared in `scope` work now: it is on, and no newer layer holds the keys.
     * A list's cursor is lit while they do.
     */
    works(scope: Scope) {
      changes();
      return here(scope);
    },
    /** The newest open layer's id, `null` while the page has the keys. */
    layer() {
      changes();
      return topLayer()?.id ?? null;
    },
    listed,
    on,
    /**
     * Declares keys in a scope: throws, declaring none, where one could never run, or would make a
     * key mean two things; in a release build, reports it and leaves that key out (`KeyStoreOptions`).
     * Returns what removes them.
     */
    register(scope: Scope, specs: ReadonlyArray<KeySpec>) {
      const added: Array<Declared> = [];
      const left: Array<Refused> = [];
      for (const spec of specs) {
        const mine = { scope, spec };
        const broken = flaw(mine);
        const problem =
          broken ?? [...declared, ...added].map((other) => clash(other, mine)).find(Boolean);
        if (problem === undefined || problem === null) {
          added.push(mine);
          continue;
        }
        const words =
          broken === null
            ? `A key means two things in ${scope.name}: ${problem}`
            : `A key cannot work in ${scope.name}: ${problem}`;
        if (strict) {
          throw new Error(words);
        }
        report(words);
        left.push({ ...mine, problem });
      }
      declared = [...declared, ...added];
      refused = [...refused, ...left];
      changed();
      return () => {
        declared = declared.filter((entry) => !added.includes(entry));
        refused = refused.filter((entry) => !left.includes(entry));
        changed();
      };
    },
    /** The keys refused in a release build, where the focus is: the key map names them. */
    refused(): Array<Refused> {
      changes();
      return refused.filter(({ scope }) => here(scope));
    },
    /** Removes a scope, the scopes in it, and their keys, as its component goes. */
    remove(scope: Scope) {
      const gone = [...scopes].filter((inside) => pathOf(inside).includes(scope));
      for (const inside of gone) {
        scopes.delete(inside);
      }
      declared = declared.filter((entry) => !gone.includes(entry.scope));
      refused = refused.filter((entry) => !gone.includes(entry.scope));
      changed();
    },
    /**
     * Runs the bindings of `keys` among those that work now, or `among`: the first that did
     * something, a fallback only when no other did. Says whether one was bound.
     */
    run(keys: string, among: ReadonlyArray<Declared> = active()) {
      const bound = among.filter((entry) => entry.spec.keys === keys && allowed(entry));
      const ordered = [
        ...bound.filter(({ spec }) => spec.fallback !== true),
        ...bound.filter(({ spec }) => spec.fallback === true),
      ];
      ordered.find(({ spec }) => spec.run() !== false);
      return bound.length > 0;
    },
    /** A new scope under `parent`, the shell unless given. */
    scope(spec: ScopeSpec, parent: Scope = shell): Scope {
      const made: Scope = {
        id: nextId,
        kind: spec.kind ?? "page",
        name: spec.name,
        on: spec.on ?? (() => true),
        parent,
      };
      nextId += 1;
      scopes.add(made);
      changed();
      return made;
    },
    shell,
    /** Whether the single-key shortcuts are on: the setting, which the shell writes here. */
    singleKeys,
  };
}

export type KeyStore = ReturnType<typeof createKeyStore>;
