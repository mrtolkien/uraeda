// A list as an outliner, shared by the priorities and the inbox: each item of a section draws its
// nested items as rows of its own, at any depth, edited in place. `o` and `O` open a new row below
// or above the selected one, being typed: Enter saves it and opens the next one, Escape drops it.
// Tab and Shift+Tab indent and outdent a row, a nested row moves among its siblings, and `d`
// deletes a row with its nested rows. Each write goes in turn, over the version the one before it
// left; a row added, and a row's new text, show at once, before the file has them.
import { useRef, useState } from "react";
import type { WorkRow } from "./Card.tsx";
import {
  type Asked,
  drawnOf,
  type Fresh,
  isPending,
  keyAt,
  type Outline,
  type OutlineItem,
  type OutlineWrites,
  type Pending,
  type Spot,
  spotOfRow,
} from "./outline.ts";
import { freshActions } from "./outlineFresh.ts";
import { rowOf } from "./outlineRows.tsx";
import {
  dropWrite,
  droppedKey,
  editAt,
  indentedKey,
  insertWrite,
  outlinedKey,
} from "./outlineWrites.ts";
import type { Dropped } from "./useDragOrder.ts";
import { DROPPED, useWritesInTurn } from "./useWritesInTurn.ts";
import type { OutlineMove } from "./workSection.ts";

export {
  type DropPlace,
  FRESH,
  isPending,
  type ItemPlace,
  type Outline,
  type OutlineItem,
  type OutlineWrites,
  type Spot,
  spotOfRow,
} from "./outline.ts";
export { useWritesInTurn } from "./useWritesInTurn.ts";

/** A write, in turn: refused, it shows; resolves with whether it was written. */
type Write<Data, Source> = (
  call: (now: Data) => Promise<string | undefined>,
  then?: (now: Outline<Source>) => string | undefined,
) => Promise<boolean>;

/** A pending write, and what tells it written over a version, drawn, or refused. */
type Pend = (one: Asked) => {
  based: (base: string) => void;
  done: () => void;
  refused: () => void;
};

/**
 * The outliner's writes from the keys and a drop, each in turn: a row added and a row's new text,
 * shown ahead of the file (`insertAt`, `editText`), an indent or a move (`onOutline`), a drop
 * (`onNest`), and a delete (`onDelete`).
 */
function outlineEdits<Data extends { hash: string }, Source>({
  drawn,
  pend,
  write,
  writes,
}: {
  drawn: Outline<Source>;
  pend: Pend;
  write: Write<Data, Source>;
  writes: OutlineWrites<Data, Source>;
}) {
  /** The new row written at `spot` with `text`, in the place it shows. */
  const insertAt = (spot: Spot, text: string) => {
    const { based, done, refused } = pend({ kind: "insert", spot, text });
    void write((now) => {
      based(now.hash);
      return insertWrite(writes, now, spot, text);
    }).then((isWritten) => (isWritten ? done() : refused()));
  };

  /** A row's text, `key` at `spot`, becomes `text`. */
  const editText = (spot: Spot, key: string, text: string) => {
    const { based, done, refused } = pend({ key, kind: "edit", text });
    void write(
      (now) => {
        based(now.hash);
        return editAt(writes, now, spot, key, "edit", text);
      },
      (now) => keyAt(now, spot),
    ).then((isWritten) => (isWritten ? done() : refused()));
  };

  /** Tab, Shift+Tab, and a nested row's moves: written, then the row selected where it went. */
  const onOutline = (spot: Spot, key: string, move: OutlineMove) => {
    if (spot.at === undefined) {
      // An item indents under the item above it in the file, never under one that stays as it is,
      // as a running line; and an item never outdents, nor indents when it stays an item, as a line
      // with a draft.
      const items = drawn.sections.find((section) => section.id === spot.section)?.items;
      const above = items?.[spot.index - 1];
      const isStaying = items?.[spot.index]?.staysItem === true;
      if (move !== "indent" || isStaying || !above || above.isFixed || isPending(above.key)) {
        return;
      }
      void write(
        (now) => editAt(writes, now, spot, key, "indent"),
        (now) => indentedKey(now, spot),
      );
      return;
    }
    void write(
      (now) => editAt(writes, now, spot, key, move),
      (now) => outlinedKey(now, spot, key, move),
    );
  };

  /**
   * A drop that nests a row, moves a nested row, or makes one an item: the row and the one it goes
   * under are found again by their keys as it is written, then the row selected where it went.
   */
  const onNest = (key: string, to: Dropped) =>
    write(
      (now) => dropWrite(writes, now, key, to),
      (now) => droppedKey(now, key, to),
    );

  /** `d`, once confirmed: the row leaves the file, its nested rows with it. */
  const onDelete = (row: WorkRow) => {
    const spot = spotOfRow(row);
    if (!spot || row.isFresh || isPending(row.key)) {
      return Promise.resolve(false);
    }
    // Gone at once, its nested rows with it, so that the rows after it are where they will be.
    const { based, done, refused } = pend({ key: row.key, kind: "remove" });
    return write((now) => {
      based(now.hash);
      return editAt(writes, now, spot, row.key, "remove");
    }).then((isWritten) => {
      if (isWritten) {
        done();
      } else {
        refused();
      }
      return isWritten;
    });
  };

  return { editText, insertAt, onDelete, onNest, onOutline };
}

/**
 * The outliner's writes in turn, and what they show ahead of the file: `pending`, until the list
 * past `hash` has them; `follow`, the row a write placed, to select. A refusal goes to `onRefused`.
 */
function usePendingWrites<Data extends { hash: string }, Source>(
  data: Data,
  writes: OutlineWrites<Data, Source>,
  onRefused: ((message: string | undefined) => void) | undefined,
  hash: string,
) {
  const { afterWrites, inTurn, latest } = useWritesInTurn(data);
  const [pending, setPending] = useState<ReadonlyArray<Pending>>([]);
  const [follow, setFollow] = useState<{ key: string }>();
  const made = useRef(0);
  // A write the file shows is no longer pending: dropped once its version is past.
  if (pending.some((one) => one.base !== undefined && one.base !== hash)) {
    setPending((all) => all.filter((one) => one.base === undefined || one.base === hash));
  }

  const write: Write<Data, Source> = async (call, then) => {
    const failed = await inTurn(call);
    // A write dropped after a refusal leaves that refusal shown.
    if (failed !== DROPPED) {
      onRefused?.(failed);
    }
    const key = failed === undefined ? then?.(writes.read(latest.current)) : undefined;
    if (key !== undefined) {
      setFollow({ key });
    }
    return failed === undefined;
  };

  /**
   * A pending write: its version is set as it is written, for it to go once the file has it. A
   * refused one goes at once, with those asked after it, which were placed after it.
   */
  const pend: Pend = (one) => {
    made.current += 1;
    const id = made.current;
    setPending((all) => [...all, { ...one, id } as Pending]);
    return {
      based: (base: string) =>
        setPending((all) => all.map((other) => (other.id === id ? { ...other, base } : other))),
      /** Written and drawn, or written the same: the file shows it, or nothing to show. */
      done: () => setPending((all) => all.filter((other) => other.id !== id)),
      refused: () => setPending((all) => all.filter((other) => other.id < id)),
    };
  };
  return { afterWrites, follow, pend, pending, setFollow, write };
}

/**
 * The outliner of a list: `data` as it will be drawn (`drawn`), each item's row and nested rows
 * (`rowOf`), what the keys call (`onAddBeside`, `onOutline`, `onDelete`, `openAt`), and the row a
 * write placed elsewhere, to select (`follow`). A refusal goes to `onRefused`.
 */
export function useOutline<Data extends { hash: string }, Source>(
  data: Data,
  writes: OutlineWrites<Data, Source>,
  onRefused: ((message: string | undefined) => void) | undefined,
  labels: { edit: string; fresh: string },
) {
  const outline = writes.read(data);
  const { afterWrites, follow, pend, pending, setFollow, write } = usePendingWrites(
    data,
    writes,
    onRefused,
    outline.hash,
  );
  const [fresh, setFresh] = useState<Fresh>();
  const drawn = drawnOf(outline, pending, fresh);
  const edits = outlineEdits({ drawn, pend, write, writes });
  const { freshDone, freshIndent, onAddBeside, openAt } = freshActions({
    afterWrites,
    drawn,
    fresh,
    insertAt: edits.insertAt,
    placed: () => drawnOf(outline, pending),
    setFollow,
    setFresh,
    writes,
  });
  const fields = {
    editText: edits.editText,
    fresh,
    freshDone,
    freshIndent,
    labels,
    onOutline: edits.onOutline,
  };

  return {
    drawn,
    follow,
    onAddBeside,
    onDelete: edits.onDelete,
    onNest: edits.onNest,
    onOutline: (row: WorkRow, move: OutlineMove) => {
      const spot = spotOfRow(row);
      if (spot && !row.isFresh && !row.isFixed) {
        edits.onOutline(spot, row.key, move);
      }
    },
    openAt,
    rowOf: (item: OutlineItem<Source>, spot: Spot, href: string) => rowOf(fields, item, spot, href),
    /** A write in turn with the others, as a drop's: refused, it shows. */
    write: (call: (now: Data) => Promise<string | undefined>) => write(call),
  };
}
