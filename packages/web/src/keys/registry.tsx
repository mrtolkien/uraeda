// The key registry: every shortcut that acts on the page is declared here, by the component that
// owns the action, while it is mounted, and heard by one listener on the window. A key is matched by
// the character typed (`match.ts`), never in a text field or under an open layer (`layers.ts`),
// and with the single-key switch off, only the keys that are not one printable character run
// (`store.ts`). The status line draws the hints of what is declared; no page, list, or shell part
// listens for keys of its own, except the allowlist of the plan's Complexity tracking.
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
import type { StatusHint } from "../statusHints.tsx";
import { useLayerOpen, isLayerOpen } from "./layers.ts";
import { tokenOf } from "./match.ts";
import { type Binding, createKeyStore, type KeyStore, type Place } from "./store.ts";

export type { Binding } from "./store.ts";

const StoreContext = createContext<KeyStore | null>(null);

/** A text field owns its keys, as typed: the registry never hears them. */
const TEXT_FIELD =
  'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]';

/** Runs the first binding of the key that did something, else its fallback. */
function dispatch(store: KeyStore, event: KeyboardEvent) {
  const token = event.defaultPrevented ? null : tokenOf(event);
  const target = event.target;
  if (
    token === null ||
    (target as Partial<Element> | null)?.closest?.(TEXT_FIELD) != null ||
    isLayerOpen(target)
  ) {
    return;
  }
  const matching = store.matching(token).filter((binding) => binding.when?.(target) ?? true);
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
  const [store] = useState(() => createKeyStore(singleKeys));
  useLayoutEffect(() => {
    store.setSingleKeys(singleKeys);
  }, [store, singleKeys]);
  useLayoutEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => dispatch(store, event);
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [store]);
  return <StoreContext value={store}>{children}</StoreContext>;
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
  const store = use(StoreContext);
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
  const store = use(StoreContext);
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
