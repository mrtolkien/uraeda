// The app's registry, and how a view reads it: the contributions of the extensions on in the current
// repository, as `ExtensionsOn` says, built-ins first. Outside it, as in a story, everything is on.
import { createContext, use, useMemo, useSyncExternalStore } from "react";
import { isCanonical } from "../keys/match.ts";
import { GROUPS } from "../keys/groups.ts";
import { navigateHere } from "../routes.tsx";
import type { Binding } from "../keys/store.ts";
import {
  clashesOf,
  type ContributionKind,
  type Contributions,
  createRegistry,
  entriesOf,
  type KeyClash,
  keysClash,
  leaderKeys,
  listOf,
  type Snapshot,
} from "./registry.ts";

/** The app's one registry, which the built-ins and the page runtime register into. */
export const registry = createRegistry();

/** Whether an extension, by its name, is on in the current repository. */
export type IsOn = (extension: string) => boolean;

const everything: IsOn = () => true;

export const IsOnContext = createContext<IsOn>(everything);

/** Whether the extension `name` is on in the current repository. */
export function useIsOn(name: string): boolean {
  return use(IsOnContext)(name);
}

/** The registry's state, redrawing the caller as it changes. */
const useSnapshot = () => useSyncExternalStore(registry.subscribe, registry.snapshot);

/** The contributions of `kind` of the extensions on in the current repository, in their order. */
export function useContributions<K extends ContributionKind>(kind: K): Array<Contributions[K]> {
  const isOn = use(IsOnContext);
  const snapshot = useSnapshot();
  return useMemo(() => listOf(snapshot, kind, isOn), [snapshot, kind, isOn]);
}

/** The contributions of `kind` of the extensions on here, each with its extension. */
export function useContributionEntries<K extends ContributionKind>(kind: K) {
  const isOn = use(IsOnContext);
  const snapshot = useSnapshot();
  return useMemo(() => entriesOf(snapshot, kind, isOn), [snapshot, kind, isOn]);
}

/** A sequence through groups `groups.ts` names, of keys as the browser names them. */
const isUsable = (keys: string) => {
  const tokens = keys.split(" ");
  return (
    tokens.every(isCanonical) &&
    tokens.slice(2).every((_, index) => GROUPS[tokens.slice(0, index + 2).join(" ")] !== undefined)
  );
};

/** The keys an extension lost to Uraeda's own, which the key registry would throw on. */
let ownClashes: ReadonlyArray<KeyClash> = [];
const clashListeners = new Set<() => void>();

/** Publishes the keys lost to Uraeda's own, when they changed. */
export function reportOwnClashes(next: ReadonlyArray<KeyClash>) {
  if (JSON.stringify(next) !== JSON.stringify(ownClashes)) {
    ownClashes = next;
    for (const listener of clashListeners) {
      listener();
    }
  }
}

/**
 * The keys the extensions' places and keys bind, after the leader and `g`, less those that clash
 * with `own`, Uraeda's fixed keys, or could never run: each dropped one is in `clashes`.
 */
export function useExtensionKeys(own: ReadonlyArray<Binding>): {
  bindings: Array<Binding>;
  clashes: Array<KeyClash>;
} {
  const isOn = use(IsOnContext);
  const snapshot = useSnapshot();
  const wanted: Array<Binding & { extension: string }> = [
    ...entriesOf(snapshot, "place", isOn).flatMap(({ extension, value: place }) => {
      const go = () => navigateHere(place.path ?? "/");
      return [
        ...(place.key === undefined ? [] : [`space ${place.key}`]),
        ...(place.goKey === undefined ? [] : [`g ${place.goKey}`]),
      ].map((each) => ({
        extension: extension.name,
        icon: place.icon,
        keys: each,
        label: place.title,
        run: go,
      }));
    }),
    ...entriesOf(snapshot, "key", isOn).map(
      ({ extension, value: { icon, keys: each, label, run } }) => ({
        ...(icon === undefined ? {} : { icon }),
        extension: extension.name,
        keys: leaderKeys(each),
        label,
        run: () => run(),
      }),
    ),
  ];
  const clashes: Array<KeyClash> = [];
  const bindings = wanted.flatMap(({ extension, ...binding }) => {
    const taken = own.some((other) => keysClash(other.keys, binding.keys));
    if (taken || !isUsable(binding.keys)) {
      clashes.push({ extension, keys: binding.keys, takenBy: "Uraeda" });
      return [];
    }
    return [binding];
  });
  return { bindings, clashes };
}

/**
 * Every key an extension could not have: another extension's, in each of `repositories` where both
 * are on (`isOnIn` says which are), or Uraeda's own here. The settings page shows each as "`y` is
 * taken by Deploy", with the repositories it is taken in when not all of them.
 */
export function useKeyClashes(
  repositories: ReadonlyArray<string>,
  isOnIn: (repository: string) => IsOn,
): ReadonlyArray<KeyClash> {
  const snapshot = useSnapshot();
  const own = useSyncExternalStore(
    (listener) => {
      clashListeners.add(listener);
      return () => void clashListeners.delete(listener);
    },
    () => ownClashes,
  );
  return useMemo(
    () => [...clashesIn(snapshot, repositories, isOnIn), ...own],
    [snapshot, repositories, isOnIn, own],
  );
}

/** The clashes of `snapshot` in each of `repositories`, one per key, with where it is taken. */
export function clashesIn(
  snapshot: Snapshot,
  repositories: ReadonlyArray<string>,
  isOnIn: (repository: string) => IsOn,
): Array<KeyClash> {
  const byKey = new Map<string, KeyClash & { repositories: Array<string> }>();
  for (const repository of repositories) {
    for (const clash of clashesOf(snapshot, isOnIn(repository))) {
      const id = JSON.stringify([clash.extension, clash.keys, clash.takenBy]);
      const seen = byKey.get(id) ?? { ...clash, repositories: [] };
      seen.repositories.push(repository);
      byKey.set(id, seen);
    }
  }
  return [...byKey.values()].map((clash) =>
    clash.repositories.length < repositories.length
      ? clash
      : { extension: clash.extension, keys: clash.keys, takenBy: clash.takenBy },
  );
}
