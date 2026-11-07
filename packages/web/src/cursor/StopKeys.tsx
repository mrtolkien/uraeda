// A held stop's own keys: declared in the registry's selection place while the cursor holds the
// stop, so they run before the page's and may reuse its keys, and drawn under the stop in its bar,
// as a list's selected row shows its keys.
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
 * The bar of a held stop's keys, under it: each key with a `bar` text, but the single keys while
 * they are switched off. It is for the keyboard user's eyes, to show the keys: its buttons are
 * seldom clicked, as a mouse moving hides the cursor, and the bar with it. Nothing when the stop is
 * not held, or on a narrow screen, where keys are little help and the phone's floating bar would
 * cover the page.
 */
export function StopBar({ held, keys }: { held: boolean; keys: ReadonlyArray<StopKey> }) {
  const singleKeys = useSingleKeys();
  const width = useWidthClass();
  if (!held || isNarrow(width)) {
    return null;
  }
  const actions: Array<BarAction> = keys.flatMap(({ bar, keys: key, label, run }) =>
    bar === undefined || (!singleKeys && isSingleKey(key))
      ? []
      : [{ keys: bar, label, run: () => void run() }],
  );
  return actions.length === 0 ? null : <RowBar actions={actions} />;
}
