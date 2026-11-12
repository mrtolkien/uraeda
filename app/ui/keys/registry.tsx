// The key registry: every shortcut of the app is declared here, with `registerKey`, by the
// component that owns the action, while it is mounted, and heard here alone. No screen, list, or
// shell part calls Native Shell's `keymap`, or listens for a key otherwise.
//
// Native Shell hears one keystroke per binding, takes the key from everything else once it is
// bound, and gives the newest binding of a keystroke the key. So the registry binds, at any time,
// exactly the keys that work now (`listenKeys`): the first key of every binding whose scope is on,
// each bound once and left alone while it stays, so a control that binds its own keys as it takes
// the focus still gets them; and, while a sequence waits, every key that types, bound over them
// all. A text field with the focus gets its keys first: only a binding that asks (`inField`) is
// heard there.
import { cleanup, computed, context, effect, type JSX, keymap, untracked } from "nsh";
import { interaction } from "../timing";
import { createLeader } from "./leader";
import type { Step } from "./sequence";
import {
  createKeyStore,
  type Declared,
  type KeySpec,
  type Scope,
  type ScopeSpec,
  type StatusHint,
} from "./store";
import { CHORD, LEADER, SEQUENCE_KEYS, strokeOf } from "./token";

export type { Declared, KeySpec, Scope, ScopeKind, ScopeSpec, StatusHint } from "./store";

/** The app's one registry, and the sequence its leader has pending. */
const store = createKeyStore();
const leader = createLeader(store);

/** The scope a component declares its keys in: the nearest `KeyScope` around it, else the shell. */
const Current = context<Scope>(store.shell);

/**
 * Declares a shortcut, or several, for as long as the caller is mounted: the only way a key acts
 * on the app. Called as a component renders, in the scope of the nearest `KeyScope` around it,
 * the shell's without one; in an effect, the keys follow what the effect reads, as a hint that
 * changes. Throws where a key could never run, or would mean two things where it is on
 * (`store.ts`). Returns what removes the keys before their component goes.
 */
export function registerKey(
  spec: KeySpec | ReadonlyArray<KeySpec>,
  scope: Scope = Current(),
): () => void {
  const specs: ReadonlyArray<KeySpec> = Array.isArray(spec) ? spec : [spec as KeySpec];
  const remove = store.register(scope, specs);
  cleanup(remove);
  return remove;
}

/**
 * A scope for the keys declared by what it holds: a page's (the default), a `pane`'s, on while
 * `on` says it has the focus, a `selection`'s, on while it holds, or a `layer`'s, which owns the
 * keys while it is mounted. It draws nothing of its own.
 */
export function KeyScope(props: ScopeSpec & { children?: JSX.Element }) {
  const scope = keyScope(props);
  return <Current.Provider value={scope}>{props.children}</Current.Provider>;
}

/**
 * Gives what it holds a scope made with `keyScope`, where the scope's maker is not its parent: a
 * layer's, which its caller makes and hands to the layer and to the content it writes (`Float`).
 */
export function InScope(props: { children?: JSX.Element; scope: Scope }) {
  return <Current.Provider value={props.scope}>{props.children}</Current.Provider>;
}

/**
 * The same scope for a component that declares its keys itself, with `registerKey(spec, scope)`:
 * it goes, with its keys, when the component does.
 */
export function keyScope(spec: ScopeSpec, parent: Scope = Current()): Scope {
  const scope = store.scope({ kind: spec.kind, name: spec.name, on: spec.on }, parent);
  cleanup(() => store.remove(scope));
  return scope;
}

/**
 * Whether the keys the caller would declare work now, read as a signal: its pane has the focus, its
 * section's scope is on, and no dialog over it holds the keys. A list's cursor is lit while they do.
 */
export function keysWorkHere(): () => boolean {
  const scope = Current();
  return () => store.works(scope);
}

/**
 * Says the caller keeps Space while `kept` holds, as a checkbox, a radio, or a switch with the
 * focus: Space is then the control's, not the leader's, unless the menu is open.
 */
export function keepSpace(kept: () => boolean) {
  cleanup(store.keepSpace(kept));
}

/** The status line's hints of the keys that work now, read as a signal. */
export const keyHints = (): ReadonlyArray<StatusHint> => store.hints();

/** Every key whose scope is on, whatever the switch says, read as a signal: the key map's. */
export const keysOn = (): ReadonlyArray<Declared> => store.on();

/** Whether a control keeps Space now, read as a signal. */
export const spaceIsKept = () => store.keepsSpace();

/**
 * Whether the single-key shortcuts are on, a signal the shell writes from the setting. Off, only
 * the keys that are not one printable character run, and Ctrl+K opens the leader menu.
 */
export const singleKeys = store.singleKeys;

/** The sequence that waits for its next key, read as a signal: `null` for none. */
export const pendingKeys = (): Step | null => leader.step();

/** Ends the sequence that waits, if any: a page change does. */
export const endKeys = () => leader.end();

/** A key heard: what pends takes it first, else the bindings of the key run. */
function heard(token: string) {
  interaction(token);
  const { consumed, ran } = leader.press(token);
  if (ran !== null) {
    store.run(ran, store.on());
  }
  if (!consumed) {
    store.run(token);
  }
}

/**
 * Presses the keys a hint or a menu's row names, as the keyboard would, wherever the focus is: a
 * press asked for them. The menu a sequence opens shows at once, where a key typed waits.
 */
export function pressKeys(keys: string) {
  for (const token of keys.split(" ")) {
    heard(token);
  }
  leader.show();
}

/** How Native Shell hears a key: also in a text field, and again while it is held. */
type How = { inField: boolean; repeat: boolean };

/** The first keys of what works now, each with how it is heard. */
function wanted(): Map<string, How> {
  const keys = new Map<string, How>();
  const add = (token: string, how: How) => {
    const had = keys.get(token);
    keys.set(token, {
      inField: how.inField || had?.inField === true,
      repeat: how.repeat || had?.repeat === true,
    });
  };
  for (const { spec } of store.active()) {
    const [first = "", ...rest] = spec.keys.split(" ");
    // A sequence never starts on a held key, nor in a field.
    const alone = rest.length === 0;
    add(first, { inField: alone && spec.inField === true, repeat: alone && spec.repeat === true });
  }
  // The chord opens the leader's menu with the switch on or off.
  if (store.on().some(({ spec }) => spec.keys.startsWith(`${LEADER} `))) {
    add(CHORD, { inField: false, repeat: false });
  }
  // Space on a control that keeps it is the control's.
  if (store.keepsSpace()) {
    keys.delete(LEADER);
  }
  return keys;
}

/** The keys a pending sequence hears, by their keystrokes, each heard as its token. */
const SEQUENCE_STROKES: Record<string, () => void> = Object.fromEntries(
  SEQUENCE_KEYS.flatMap((token) => {
    const stroke = strokeOf(token);
    return stroke === null ? [] : [[stroke, () => heard(token)]];
  }),
);

const optionsOf = (how: How) => ({
  repeat: how.repeat,
  when: how.inField ? ("always" as const) : ("notEditing" as const),
});

/**
 * Hears the keys for as long as the caller is mounted: once, by the component that holds the app.
 * Native Shell undoes a binding with the effect that made it, so the bindings are made after the
 * effect, outside it, and each stays until its key is no longer wanted.
 */
export function listenKeys() {
  const bound = new Map<string, { how: string; unbind: () => void }>();
  let sequence: (() => void) | null = null;
  let next: { keys: Map<string, How>; pending: boolean } | null = null;
  let stopped = false;

  const bind = (token: string, how: How) => {
    const stroke = strokeOf(token);
    try {
      return stroke === null ? () => {} : keymap.bind(stroke, () => heard(token), optionsOf(how));
    } catch (error) {
      // A key this platform keeps for itself, as Cmd+H on a Mac: the others still work.
      console.error(`The key "${token}" cannot be heard here: ${String(error)}`);
      return () => {};
    }
  };

  const sync = () => {
    const now = next;
    next = null;
    if (now === null || stopped) {
      return;
    }
    for (const [token, entry] of bound) {
      if (JSON.stringify(now.keys.get(token)) !== entry.how) {
        entry.unbind();
        bound.delete(token);
      }
    }
    for (const [token, how] of now.keys) {
      if (!bound.has(token)) {
        bound.set(token, { how: JSON.stringify(how), unbind: bind(token, how) });
      }
    }
    // While a sequence waits, every key that types is its own, over any other binding of it.
    if (now.pending && sequence === null) {
      sequence = keymap.bind(SEQUENCE_STROKES, optionsOf({ inField: false, repeat: false }));
    } else if (!now.pending && sequence !== null) {
      sequence();
      sequence = null;
    }
  };

  effect(() => {
    const queued = next !== null;
    next = { keys: wanted(), pending: leader.step() !== null };
    if (!queued) {
      void Promise.resolve().then(sync);
    }
  });
  // A layer that opens or closes, and the switch as it moves, end the sequence that waited.
  const layer = computed(() => store.layer());
  effect(() => {
    store.singleKeys();
    layer();
    untracked(() => leader.end());
  });
  cleanup(() => {
    stopped = true;
    leader.end();
    sequence?.();
    for (const { unbind } of bound.values()) {
      unbind();
    }
    bound.clear();
  });
}
