// The key registry: every shortcut that acts on the page is declared here, by the component that
// owns the action, while it is mounted, and heard by one listener on the window. A key is matched by
// the character typed (`match.ts`), never in a text field or under an open layer (`layers.ts`), and
// with the single-key switch off, only the keys that are not one printable character run
// (`store.ts`). Sequences, and the leader's menu they open, are `leader.ts`'s. The status line draws
// the hints of what is declared; no page, list, or shell part listens for keys of its own, except
// the allowlist of the plan's Complexity tracking.
import {
  createContext,
  type ReactNode,
  use,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { inTextField, keepsSpace } from "./fields.ts";
import { createLeader, type Leader, type Pressed } from "./leader.ts";
import { useLayerOpen, isLayerOpen } from "./layers.ts";
import { tokenOf } from "./match.ts";
import type { Step } from "./sequence.ts";
import {
  type Binding,
  createKeyStore,
  type KeyStore,
  type Place,
  type StatusHint,
} from "./store.ts";

export type { Binding } from "./store.ts";

/** What the provider holds: the declared bindings, and the sequence the leader has pending. */
type Registry = { leader: Leader; store: KeyStore };

const StoreContext = createContext<Registry | null>(null);

/** Runs the first binding that did something, a fallback only when no other did. */
function runFirst(matching: ReadonlyArray<Binding>, event: KeyboardEvent) {
  const ordered = [
    ...matching.filter((b) => b.fallback !== true),
    ...matching.filter((b) => b.fallback === true),
  ];
  for (const binding of ordered) {
    if (binding.run(event) !== false) {
      event.preventDefault();
      return;
    }
  }
}

/**
 * Hands a key to what pends (a sequence, the leader's menu), else runs the bindings of the key. A
 * text field and an open layer own their keys, and end what pends.
 */
function dispatch({ leader, store }: Registry, event: KeyboardEvent) {
  const target = event.target;
  if (event.defaultPrevented) {
    // The field or control already took the key (a composer's Enter, Space on a radio): what
    // pends ends, as it does for any key a field owns.
    leader.end();
    return;
  }
  const token = tokenOf(event);
  if (token === null) {
    return;
  }
  if (inTextField(target) || isLayerOpen(target)) {
    leader.end();
    return;
  }
  const allowed = (binding: Binding) => binding.when?.(target) ?? true;
  // Space on a checkbox, a radio, a switch, or a combobox is theirs, unless the menu is open.
  const isKept = token === "space" && leader.get() === null && keepsSpace(target);
  const { consumed, ran }: Pressed = isKept
    ? { consumed: false, ran: null }
    : leader.press(token, event, store);
  if (ran !== null) {
    runFirst(
      store.all().filter((binding) => binding.keys === ran && allowed(binding)),
      event,
    );
  }
  if (consumed) {
    event.preventDefault();
    return;
  }
  runFirst(store.matching(token).filter(allowed), event);
}

/**
 * Holds what the page declares and listens for the keys. `singleKeys` is the setting: `false` drops
 * every binding whose first key is one printable character. Unmounted, `useKeys` below declares
 * nothing, as in a story.
 */
export function KeysProvider({
  children,
  singleKeys = true,
}: {
  children: ReactNode;
  singleKeys?: boolean;
}) {
  const [registry] = useState<Registry>(() => ({
    leader: createLeader(),
    store: createKeyStore(singleKeys),
  }));
  useLayoutEffect(() => {
    registry.store.setSingleKeys(singleKeys);
    if (!singleKeys) {
      // Off means off: a menu open when it turns off closes, the chord's too.
      registry.leader.end();
    }
  }, [registry, singleKeys]);
  useLayoutEffect(() => {
    // A Space the registry prevented: Firefox presses a button on the Space's keyup, whatever its
    // keydown did, so the keyup is prevented as well.
    let tookSpace = false;
    const onKeyDown = (event: KeyboardEvent) => {
      const wasPrevented = event.defaultPrevented;
      dispatch(registry, event);
      tookSpace = event.key === " " && !wasPrevented && event.defaultPrevented;
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (tookSpace && event.key === " ") {
        tookSpace = false;
        event.preventDefault();
      }
    };
    const onBlur = () => void (tookSpace = false);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      registry.leader.dispose();
    };
  }, [registry]);
  return <StoreContext value={registry}>{children}</StoreContext>;
}

/** A binding without its handlers, which the registry reads at the key, not at the render. */
type Shape = Omit<Binding, "run" | "when"> & { hasWhen: boolean };

/**
 * Declares the keys that work while the caller is mounted: its page's, or `place` "shell" for the
 * shell's own. The handlers are the latest closures of the last render, though readers (the hints,
 * the menu) hear only of a change in what the bindings say. Throws, in every build but production,
 * where a key would mean two things.
 */
export function useKeys(bindings: ReadonlyArray<Binding>, place: Place = "page") {
  const store = use(StoreContext)?.store;
  const id = useId();
  const latest = useRef(bindings);
  useLayoutEffect(() => {
    latest.current = bindings;
  });
  // By their text: a list written inline in the caller is the same list at every render.
  const text = JSON.stringify(
    bindings.map(({ run: _run, when, ...binding }) => ({
      ...binding,
      hasWhen: when !== undefined,
    })),
  );
  useLayoutEffect(() => {
    const shapes = JSON.parse(text) as ReadonlyArray<Shape>;
    store?.set(
      id,
      place,
      shapes.map(({ hasWhen, ...shape }, index) => ({
        ...shape,
        run: (event) => latest.current[index]?.run(event),
        when: hasWhen ? (target) => latest.current[index]?.when?.(target) ?? true : undefined,
      })),
    );
  }, [id, place, store, text]);
  useLayoutEffect(() => () => store?.remove(id), [id, store]);
}

const NONE: ReadonlyArray<never> = [];
const noSubscription = () => () => {};

/**
 * The hints of the keys that work now, as the status line draws them: the page's first, then the
 * shell's. While a layer is open, only those that stay for it.
 */
export function useHints(): ReadonlyArray<StatusHint> {
  const store = use(StoreContext)?.store;
  const hints = useSyncExternalStore(
    store?.subscribe ?? noSubscription,
    store?.getHints ?? (() => NONE),
  );
  const isLayerShown = useLayerOpen();
  return useMemo(
    () =>
      hints
        .filter((hint) => !isLayerShown || hint.inLayer)
        .map(({ keys, label }) => ({ keys, label })),
    [hints, isLayerShown],
  );
}

/**
 * Whether the single-key shortcuts are on: what a component that listens for a letter of its own
 * (an allowlisted dialog's) and draws its key reads, so every letter key stops with the setting.
 * On where no provider is mounted.
 */
export function useSingleKeys(): boolean {
  const store = use(StoreContext)?.store;
  return useSyncExternalStore(
    store?.subscribe ?? noSubscription,
    store?.getSingleKeys ?? (() => true),
  );
}

/**
 * The leader's pending sequence, for the menu that draws it: the keys pressed so far, whether it is
 * shown yet, every binding to read its next keys from, and how to end it.
 */
export function useLeader(): {
  bindings: ReadonlyArray<Binding>;
  end: () => void;
  step: Step | null;
} {
  const registry = use(StoreContext);
  const step = useSyncExternalStore(
    registry?.leader.subscribe ?? noSubscription,
    registry?.leader.get ?? (() => null),
  );
  return {
    bindings: step === null || registry === null ? NONE : registry.store.all(),
    end: registry?.leader.end ?? (() => {}),
    step,
  };
}
