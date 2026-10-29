// The outliner's writes as each list makes them (see `useOutline`): each finds its rows again in the
// list as the write before it left it, and names the row to select once it is drawn.
import type { Dropped } from "./useDragOrder.ts";
import type { OutlineMove } from "./workSection.ts";
import {
  type ItemPlace,
  itemAt,
  keyAt,
  type Outline,
  type OutlineWrites,
  type Spot,
} from "./outline.ts";
import { siblingAbove } from "./nesting.ts";

/** The refusal of a write whose row the file no longer has. */
export const GONE = "It is no longer in the file.";

/**
 * An edit of the item at `spot`, or of its nested item at `spot.at`, found again in `now`: by
 * their keys, else by their places, written since. A nested row named by `key` is never taken by
 * its place in another item: that would be another row.
 */
export function editAt<Data, Source>(
  writes: OutlineWrites<Data, Source>,
  now: Data,
  spot: Spot,
  key: string | undefined,
  kind: string,
  text?: string,
) {
  const read = writes.read(now);
  const item = itemAt(read, spot, spot.at === undefined ? key : spot.item);
  if (!item) {
    return Promise.resolve(GONE);
  }
  if (spot.at === undefined) {
    return writes.edit(now, item.id, undefined, kind, text);
  }
  const found = item.children.findIndex((child) => child.key === key);
  const isOwnItem = spot.item === undefined || item.key === spot.item;
  if (found === -1 && key !== undefined && !isOwnItem) {
    return Promise.resolve(GONE);
  }
  return writes.edit(now, item.id, found === -1 ? spot.at : found, kind, text);
}

/** The write of a new row at `spot` with `text`, in the place it shows. */
export function insertWrite<Data, Source>(
  writes: OutlineWrites<Data, Source>,
  now: Data,
  spot: Spot,
  text: string,
) {
  const edit = (at: Spot, kind: string, key?: string) => editAt(writes, now, at, key, kind, text);
  const items = writes.read(now).sections.find((one) => one.id === spot.section)?.items;
  if (!items) {
    return Promise.resolve("No such section.");
  }
  const of = (at: number | undefined, index = spot.index) => ({ ...spot, at, index });
  if (spot.at === undefined) {
    if (items.length === 0) {
      return writes.add(now, spot.section, text);
    }
    return spot.index === 0
      ? edit(of(undefined, 0), "insert-above")
      : edit(of(undefined, spot.index - 1), "insert-below");
  }
  const item = items[spot.index];
  const children = item?.children ?? [];
  const depth = spot.depth ?? 1;
  if (spot.at === 0) {
    return children.length > 0
      ? edit(of(0), "insert-above")
      : edit(of(undefined), "append-child", item?.key);
  }
  const sibling = siblingAbove(children, spot.at, depth);
  if (sibling !== -1) {
    return edit(of(sibling), "insert-below");
  }
  // Its parent is just above it: before its first item, or its first one.
  return children[spot.at]?.depth === depth
    ? edit(of(spot.at), "insert-above")
    : edit(of(spot.at - 1), "append-child");
}

/** The key of the last item of the item above `spot`, which the item at `spot` indented into. */
export function indentedKey<Source>(now: Outline<Source>, spot: Spot) {
  const parent = itemAt(now, { ...spot, index: spot.index - 1 });
  const last = parent?.children.findLastIndex((child) => child.depth === 1) ?? -1;
  return last === -1 ? undefined : parent?.children[last]?.key;
}

/** The key of the nested row `key`, at `spot`, after `move`: where it went. */
export function outlinedKey<Source>(
  now: Outline<Source>,
  spot: Spot,
  key: string,
  move: OutlineMove,
) {
  // An item's own item outdented becomes the item after it.
  if (move === "outdent" && spot.depth === 1) {
    return keyAt(now, { index: spot.index + 1, section: spot.section });
  }
  const item = itemAt(now, spot);
  return item?.children.find((child) => child.key === key)?.key ?? keyAt(now, spot);
}

/** The item `one` is, or the item and the place of its nested row `one`, in `read`. */
function placeOf<Source>(read: Outline<Source>, one: string): ItemPlace | undefined {
  for (const item of read.sections.flatMap((section) => section.items)) {
    if (item.key === one) {
      return { id: item.id };
    }
    const at = item.children.findIndex((child) => child.key === one);
    if (at !== -1) {
      return { at, id: item.id };
    }
  }
  return undefined;
}

/**
 * The write of a drop that nests the row `key`, moves a nested row, or makes one an item: the row
 * and the one it goes under are found again by their keys as it is written.
 */
export function dropWrite<Data, Source>(
  writes: OutlineWrites<Data, Source>,
  now: Data,
  key: string,
  to: Dropped,
) {
  const read = writes.read(now);
  const from = placeOf(read, key);
  const under = to.parent === undefined ? undefined : placeOf(read, to.parent);
  if (!from || (to.parent !== undefined && !under)) {
    return Promise.resolve(GONE);
  }
  return writes.drop(
    now,
    from,
    under ? { index: to.index, under } : { index: to.index, section: to.section },
  );
}

/**
 * The key of the row `key` a drop placed at `to`, in `now`. Its key follows its text: a nested
 * row's is `<item>/<slug>`, an item's its slug. It is looked for where it went only: under the
 * item it went under, or among its section's items.
 */
export function droppedKey<Source>(now: Outline<Source>, key: string, to: Dropped) {
  const slug = key.split("/").at(-1) ?? key;
  const parent = to.parent;
  const all =
    parent === undefined
      ? (now.sections.find((section) => section.id === to.section)?.items ?? []).map(
          (item) => item.key,
        )
      : (now.sections
          .flatMap((section) => section.items)
          .find(
            (item) => item.key === parent || item.children.some((child) => child.key === parent),
          )
          ?.children.map((child) => child.key) ?? []);
  return (
    all.find((one) => one === key) ?? all.find((one) => one === slug || one.endsWith(`/${slug}`))
  );
}
