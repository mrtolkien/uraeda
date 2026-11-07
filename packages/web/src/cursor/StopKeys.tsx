// A held stop's own keys: declared in the registry's selection place while the cursor holds the
// stop, so they run before the page's and may reuse its keys, and drawn under the stop in its bar,
// as a list's selected row shows its keys.
import type { ReactNode } from "react";
import { useKeys, useSingleKeys } from "../keys/registry.tsx";
import { isSingleKey } from "../keys/match.ts";
import { isNarrow, useWidthClass } from "../layout/useWidthClass.ts";
import { type BarAction, RowBar } from "../lists/RowBar.tsx";

/**
 * A key of a held stop: its keys as the registry takes them, its word, and what it does, `false`
 * when it did nothing, so the page's key of the same name runs. `bar` is the keys as the bar writes
 * them before the word, "J K" for "J K range": a key with none is left out of the bar, as `K` is,
 * which `J`'s entry names.
 */
export type StopKey = { bar?: string; keys: string; label: string; run: () => void | false };

/** Declares a held stop's keys, in the selection's place. */
function useStopKeys(keys: ReadonlyArray<StopKey>): void {
  useKeys(
    keys.map(({ keys: key, label, run }) => ({ keys: key, label, run })),
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
 * A held stop's keys and their bar, mounted only while the cursor holds it: a page of many stops,
 * as a long spec's blocks, declares nothing and listens to nothing for the others. `children` draws
 * the bar where it goes, given `null` when it has no action. The bar draws `shown`, `keys` unless
 * it names keys the page declares too, as the round's `n`.
 */
export function HeldKeys({
  children = (bar) => bar,
  keys,
  shown = keys,
}: {
  children?: (bar: ReactNode) => ReactNode;
  keys: ReadonlyArray<StopKey>;
  shown?: ReadonlyArray<StopKey>;
}) {
  useStopKeys(keys);
  const actions = useBarActions(shown);
  return children(actions.length === 0 ? null : <RowBar actions={actions} isCursor />);
}
