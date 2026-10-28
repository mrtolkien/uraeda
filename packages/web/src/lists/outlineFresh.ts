// The new row of an outline, being typed (see `useOutline`): where `o`, `O`, and an Add row open it,
// where Tab and Shift+Tab move it, and where Enter and Escape leave the selection.
import type { WorkRow } from "./Card.tsx";
import {
  type Fresh,
  isPending,
  itemAt,
  keyAt,
  type Outline,
  type OutlineItem,
  type OutlineWrites,
  type Spot,
  spotOfRow,
} from "./outline.ts";
import { depthOf, nestedEnd, siblingAbove } from "./nesting.ts";

/** The new row at `spot` moved in, or out, a level, among `items`, its text kept. */
function freshIndented<Source>(
  items: ReadonlyArray<OutlineItem<Source>>,
  spot: Spot,
  isOut: boolean,
  text: string,
): Fresh {
  if (spot.at === undefined) {
    const above = items[spot.index - 1];
    // In: the last item of the item above it, one that takes items.
    if (!isOut && above && !above.isFixed && !isPending(above.key)) {
      return {
        spot: {
          ...spot,
          at: above.children.length,
          depth: 1,
          index: spot.index - 1,
          item: above.key,
        },
        text,
      };
    }
    return { spot, text };
  }
  const children = items[spot.index]?.children ?? [];
  const depth = spot.depth ?? 1;
  if (!isOut && siblingAbove(children, spot.at, depth) !== -1) {
    return { spot: { ...spot, depth: depth + 1 }, text };
  }
  // Out: only the last of its parent's items, so that none after it comes under it.
  if (isOut && (children[spot.at]?.depth ?? 0) < depth) {
    return {
      spot:
        depth > 1
          ? { ...spot, depth: depth - 1 }
          : { index: spot.index + 1, section: spot.section },
      text,
    };
  }
  return { spot, text };
}

/**
 * The row above a new row at `spot`, once it is dropped: the last one added, after Enter, or the
 * row `o` was pressed on.
 */
function aboveOf(spot: Spot): Spot {
  if (spot.at === undefined) {
    return { ...spot, index: Math.max(0, spot.index - 1) };
  }
  return spot.at === 0
    ? { index: spot.index, section: spot.section }
    : { ...spot, at: spot.at - 1 };
}

/** What the new row is made with: the list as drawn and as read, and what writes and selects. */
export type FreshContext<Data, Source> = {
  afterWrites: (then: (now: Data) => void) => void;
  drawn: Outline<Source>;
  fresh: Fresh | undefined;
  /** The new row written at `spot` with `text`, in the place it shows. */
  insertAt: (spot: Spot, text: string) => void;
  /** The list as the writes asked so far will leave it, without the new row. */
  placed: () => Outline<Source>;
  setFollow: (follow: { key: string }) => void;
  setFresh: (fresh: Fresh | undefined) => void;
  writes: OutlineWrites<Data, Source>;
};

/**
 * What the keys do with the new row: `freshDone` and `freshIndent` from its field, `onAddBeside`
 * for `o` and `O`, and `openAt` for Enter on an Add row.
 */
export function freshActions<Data, Source>({
  afterWrites,
  drawn,
  fresh,
  insertAt,
  placed,
  setFollow,
  setFresh,
  writes,
}: FreshContext<Data, Source>) {
  /** The place right after `spot` and its nested rows, at its depth: where `o` adds. */
  const below = (spot: Spot): Spot => {
    if (spot.at === undefined) {
      return { index: spot.index + 1, section: spot.section };
    }
    const item = itemAt(drawn, spot);
    return { ...spot, at: nestedEnd(item?.children ?? [], spot.at, depthOf) };
  };

  /** The new row is done: saved at its place with `text`, the next one opened, or dropped. */
  const freshDone = (text: string | undefined, then: "next" | "stop") => {
    if (!fresh) {
      return;
    }
    const { spot } = fresh;
    if (text === undefined) {
      setFresh(undefined);
      // Back on the row above it, once the rows added before it are written and drawn.
      const above = aboveOf(spot);
      afterWrites((now) => {
        const key = keyAt(writes.read(now), above);
        if (key !== undefined) {
          setFollow({ key });
        }
      });
      return;
    }
    insertAt(spot, text);
    // Enter on a new row opens the next one, under it, at its depth.
    const next =
      spot.at === undefined ? { ...spot, index: spot.index + 1 } : { ...spot, at: spot.at + 1 };
    setFresh(then === "next" ? { spot: next, text: "" } : undefined);
  };

  /** The new row moves in, or out, a level, its text kept. */
  const freshIndent = (isOut: boolean, text: string) => {
    if (!fresh) {
      return;
    }
    const { spot } = fresh;
    const items = placed().sections.find((section) => section.id === spot.section)?.items ?? [];
    setFresh(freshIndented(items, spot, isOut, text));
  };

  /** `o` and `O`: a new row below or above the selected one, at its depth, being typed. */
  const onAddBeside = (row: WorkRow, isAbove = false) => {
    const spot = spotOfRow(row);
    // Nothing is added beside a row that stays as it is, nor a row not written yet; an Add row is
    // fixed, but adds.
    if (!spot || row.isFresh || (row.isFixed && !row.isAdd)) {
      return;
    }
    // An Add row adds at its section's end, either way; a row, after its nested rows or before it.
    setFresh({ spot: row.isAdd || isAbove ? spot : below(spot), text: "" });
  };

  /** A new row at the end of `section`'s items, as Enter on its Add row opens it. */
  const openAt = (section: string) => {
    const items = drawn.sections.find((one) => one.id === section)?.items ?? [];
    setFresh({ spot: { index: items.length, section }, text: "" });
  };

  return { freshDone, freshIndent, onAddBeside, openAt };
}
