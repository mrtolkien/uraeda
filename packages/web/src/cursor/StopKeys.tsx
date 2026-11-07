// A held stop's own keys: declared in the registry's selection place while the cursor holds the
// stop, so they run before the page's and may reuse its keys, and drawn under the stop in its bar,
// as a list's selected row shows its keys.
import type { ReactNode } from "react";
import { useKeys, useSingleKeys } from "../keys/registry.tsx";
import { isSingleKey } from "../keys/match.ts";
import type { Binding } from "../keys/store.ts";
import { isNarrow, useWidthClass } from "../layout/useWidthClass.ts";
import { type BarAction, RowBar } from "../lists/RowBar.tsx";

/**
 * A key of a held stop: its keys as the registry takes them, its word, and what it does, `false`
 * when it did nothing, so the page's key of the same name runs. `bar` is the keys as the bar writes
 * them before the word, "J K" for "J K range": a key with none is left out of the bar, as `K` is,
 * which `J`'s entry names.
 */
export type StopKey = { bar?: string; keys: string; label: string; run: () => void | false };

const NONE: ReadonlyArray<Binding> = [];

/** Declares a stop's keys while it is `held`, in the selection's place, and none otherwise. */
export function useStopKeys(keys: ReadonlyArray<StopKey>, held: boolean): void {
  useKeys(
    held ? keys.map(({ keys: key, label, run }) => ({ keys: key, label, run })) : NONE,
    "selection",
  );
}

/**
 * The actions of a held stop's bar: each key with a `bar` text, but the single keys while they are
 * switched off. None on a narrow screen, where keys are little help and the phone's floating bar
 * would cover the page.
 */
export function useBarActions(keys: ReadonlyArray<StopKey>): Array<BarAction> {
  const singleKeys = useSingleKeys();
  const width = useWidthClass();
  if (isNarrow(width)) {
    return [];
  }
  return keys.flatMap(({ bar, keys: key, label, run }) =>
    bar === undefined || (!singleKeys && isSingleKey(key))
      ? []
      : [{ keys: bar, label, run: () => void run() }],
  );
}

/**
 * The bar of a held stop's keys, under it. It is for the keyboard user's eyes, to show the keys: its
 * buttons are seldom clicked, as a mouse moving hides the cursor, and the bar with it. Nothing when
 * the stop is not held, or when the bar has no action (`useBarActions`).
 */
export function StopBar({ held, keys }: { held: boolean; keys: ReadonlyArray<StopKey> }) {
  return held && <ShownBar keys={keys} />;
}

function ShownBar({ keys }: { keys: ReadonlyArray<StopKey> }) {
  const actions = useBarActions(keys);
  return actions.length === 0 ? null : <RowBar actions={actions} isCursor />;
}

/**
 * A held stop's keys and their bar, mounted only while the cursor holds it: a page of many stops,
 * as a long spec's blocks, declares nothing and listens to nothing for the others. `children` draws
 * the bar where it goes, given `null` when it has no action.
 */
export function HeldKeys({
  children = (bar) => bar,
  keys,
}: {
  children?: (bar: ReactNode) => ReactNode;
  keys: ReadonlyArray<StopKey>;
}) {
  useStopKeys(keys, true);
  const actions = useBarActions(keys);
  return children(actions.length === 0 ? null : <RowBar actions={actions} isCursor />);
}
