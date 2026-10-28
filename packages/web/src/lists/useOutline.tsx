// A list as an outliner, shared by the priorities and the inbox: each item of a section draws its
// nested items as rows of its own, at any depth, edited in place. `o` and `O` open a new row below
// or above the selected one, being typed: Enter saves it and opens the next one, Escape drops it.
// Tab and Shift+Tab indent and outdent a row, a nested row moves among its siblings, and `d`
// deletes a row with its nested rows. Each write goes in turn, over the version the one before it
// left; a row added, and a row's new text, show at once, before the file has them.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { NestedItem, Span } from "uraeda-binding";
import { OutlineEditor } from "./OutlineEditor.tsx";
import type { Dropped } from "./useDragOrder.ts";
import type { OutlineMove, WorkRow } from "./WorkList.tsx";

/** An item of a section, as the outliner reads it: its own fields stay in `source`. */
export type OutlineItem<Source> = {
  children: ReadonlyArray<NestedItem>;
  /** What the writes name it by, as `note-3` or `next-2`. */
  id: string;
  /** Whether it stays as it is, as a running line: nothing indents under it. */
  isFixed?: boolean;
  /** Whether it stays an item of its section, never nested under another: a line with a draft. */
  staysItem?: boolean;
  key: string;
  /** Absent for a row added and not written yet. */
  source?: Source;
  spans: ReadonlyArray<Span>;
  /** The markdown of its text, as its field edits it. */
  text: string;
};

/** The list as the outliner reads it: its version, and its sections, each with its items. */
export type Outline<Source> = {
  hash: string;
  sections: ReadonlyArray<{ id: string; items: ReadonlyArray<OutlineItem<Source>> }>;
};

/**
 * A place in the file: the item at `index` of its section's items, all of them; with `at`, the
 * item at `at` of that item's nested items in the order of the file, at `depth`. Where a new row
 * goes, and where a row is.
 */
export type Spot = {
  at?: number;
  depth?: number;
  index: number;
  /** A nested row's item, by its key: what a write finds it by, its place only if renamed. */
  item?: string;
  section: string;
};

/** A write made and not drawn yet: a row added, or a row's new text. `base` is set as it is written. */
type Pending =
  | { base?: string; id: number; kind: "insert"; spot: Spot; text: string }
  | { base?: string; id: number; kind: "edit"; key: string; text: string }
  | { base?: string; id: number; kind: "remove"; key: string };

/** A pending write as it is asked for: its id is given to it. */
type Asked = Pending extends infer One ? (One extends Pending ? Omit<One, "id"> : never) : never;

/** The new row being typed, at `spot`, with the text typed so far. */
type Fresh = { spot: Spot; text: string };

/** The key of the new row being typed. */
export const FRESH = "fresh";

/** Whether a key is a row added and not written yet. */
export const isPending = (key: string) => key.startsWith("pending:");

/** Text as spans, plain: what a row added or edited shows until the file has it. */
const spansOf = (text: string): Array<Span> => [
  { code: false, emphasis: false, strike: false, strong: false, text },
];

/** The count of rows nested under the item at `at` of `children`: the items after it, deeper. */
function descendants(children: ReadonlyArray<NestedItem>, at: number) {
  const depth = children[at]?.depth ?? 0;
  const end = children.findIndex((child, index) => index > at && child.depth <= depth);
  return (end === -1 ? children.length : end) - at - 1;
}

/** The index of the sibling just above the item at `at`, at `depth`, or -1 for none. */
function siblingAbove(children: ReadonlyArray<NestedItem>, at: number, depth: number) {
  for (let index = at - 1; index >= 0; index -= 1) {
    if (children[index].depth === depth) {
      return index;
    }
    if (children[index].depth < depth) {
      return -1;
    }
  }
  return -1;
}

/** The item of `spot` in `now`, by its key first, else by its place. */
function itemAt<Source>(now: Outline<Source>, spot: Spot, key?: string) {
  const all = now.sections.flatMap((section) => section.items);
  return (
    (key === undefined ? undefined : all.find((item) => item.key === key)) ??
    now.sections.find((section) => section.id === spot.section)?.items[spot.index]
  );
}

/** The key of the row at `spot` in `now`. */
function keyAt<Source>(now: Outline<Source>, spot: Spot) {
  const item = now.sections.find((one) => one.id === spot.section)?.items[spot.index];
  return spot.at === undefined ? item?.key : item?.children[spot.at]?.key;
}

/**
 * The list with `pending` made and `fresh` placed, as it will be: what the page draws. A write the
 * file shows, its version past the one it was written over, is no longer pending.
 */
function drawnOf<Source>(
  outline: Outline<Source>,
  pending: ReadonlyArray<Pending>,
  fresh?: Fresh,
): Outline<Source> {
  const live = pending.filter((one) => one.base === undefined || one.base === outline.hash);
  const edits = new Map(
    live.flatMap((one) => (one.kind === "edit" ? [[one.key, one.text] as const] : [])),
  );
  const sections = outline.sections.map((section) => ({
    ...section,
    items: section.items.map((item) => ({
      ...item,
      ...(edits.has(item.key) ? { spans: spansOf(edits.get(item.key) ?? "") } : {}),
      children: item.children.map((child) =>
        edits.has(child.key) ? { ...child, spans: spansOf(edits.get(child.key) ?? "") } : child,
      ),
    })),
  }));
  const place = (spot: Spot, key: string, text: string) => {
    const section = sections.find((one) => one.id === spot.section);
    if (!section) {
      return;
    }
    if (spot.at === undefined) {
      section.items.splice(spot.index, 0, {
        children: [],
        id: "",
        key,
        spans: spansOf(text),
        text,
      });
      return;
    }
    const item = section.items[spot.index];
    if (item) {
      const child = { depth: spot.depth ?? 1, key, spans: spansOf(text), text };
      section.items[spot.index] = { ...item, children: item.children.toSpliced(spot.at, 0, child) };
    }
  };
  // A row deleted goes with its nested rows: the rows after it, deeper than it.
  const remove = (key: string) => {
    for (const section of sections) {
      const at = section.items.findIndex((item) => item.key === key);
      if (at !== -1) {
        section.items.splice(at, 1);
        return;
      }
      for (const [index, item] of section.items.entries()) {
        const child = item.children.findIndex((one) => one.key === key);
        if (child !== -1) {
          const count = 1 + descendants(item.children, child);
          section.items[index] = { ...item, children: item.children.toSpliced(child, count) };
          return;
        }
      }
    }
  };
  // In the order they were asked: each place counts the rows added or deleted before it.
  for (const one of live) {
    if (one.kind === "insert") {
      place(one.spot, `pending:${one.id}`, one.text);
    } else if (one.kind === "remove") {
      remove(one.key);
    }
  }
  if (fresh) {
    place(fresh.spot, FRESH, fresh.text);
  }
  return { ...outline, sections };
}

/** How long a write waits for the list to show the one before it, at most. */
const DRAWN_MS = 2000;

/** The refusal of a write dropped after an earlier one was refused: the earlier one says why. */
const DROPPED = "";

/** The refusal of a write whose row the file no longer has. */
const GONE = "It is no longer in the file.";

/**
 * The list's writes, one after another, as the keys made them ahead of the file: each reads the
 * list as the write before it left it, once drawn, for its version and its rows' places, so that a
 * second delete is not refused for the first. `write` resolves with its refusal, if any; `latest`
 * is the list as last drawn.
 */
export function useWritesInTurn<Data extends { hash: string }>(data: Data) {
  const latest = useRef(data);
  const waiting = useRef(new Set<{ hash: string; resolve: () => void }>());
  useLayoutEffect(() => {
    latest.current = data;
    for (const waiter of waiting.current) {
      if (waiter.hash !== data.hash) {
        waiting.current.delete(waiter);
        waiter.resolve();
      }
    }
  }, [data]);
  /** Once the list shows another version than `hash`, or after `DRAWN_MS`. */
  const drawnAfter = (hash: string) =>
    latest.current.hash === hash
      ? new Promise<void>((resolve) => {
          const waiter = { hash, resolve };
          waiting.current.add(waiter);
          setTimeout(() => {
            waiting.current.delete(waiter);
            resolve();
          }, DRAWN_MS);
        })
      : Promise.resolve();
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  // Counts the refusals: a write asked before one is dropped, as it was placed after what was refused.
  const refusals = useRef(0);
  const inTurn = (write: (now: Data) => Promise<string | undefined>) => {
    const asked = refusals.current;
    const turn = queue.current.then(async () => {
      if (refusals.current !== asked) {
        return DROPPED;
      }
      const now = latest.current;
      // A write that throws is refused too: what it showed ahead of the file goes.
      const failed = await write(now).catch((error: unknown) => String(error));
      if (failed === undefined) {
        await drawnAfter(now.hash);
      } else {
        refusals.current += 1;
      }
      return failed;
    });
    queue.current = turn.catch(() => undefined);
    return turn;
  };
  /** `then` with the list as the writes asked so far left it, drawn. */
  const afterWrites = (then: (now: Data) => void) => {
    void queue.current.then(() => then(latest.current));
  };
  return { afterWrites, inTurn, latest };
}

/** An item, `id`, or its nested item at `at`: what a drop moves, or goes under. */
export type ItemPlace = { at?: number; id: string };

/** Where a drop puts an item: under an item, or an item of a section, at `index` there. */
export type DropPlace = { index: number; section: string } | { index: number; under: ItemPlace };

/** What the outliner writes with, as each list writes it. */
export type OutlineWrites<Data, Source> = {
  /** A section's first item, `text`, in an empty section. */
  add: (now: Data, section: string, text: string) => Promise<string | undefined>;
  /** A drop: the item at `from`, its own items with it, to `to`. */
  drop: (now: Data, from: ItemPlace, to: DropPlace) => Promise<string | undefined>;
  /** The list as the outliner reads it. */
  read: (data: Data) => Outline<Source>;
  /** The outline edit `kind` of the item `id`, or of its nested item at `at`. */
  edit: (
    now: Data,
    id: string,
    at: number | undefined,
    kind: string,
    text?: string,
  ) => Promise<string | undefined>;
};

/** A row's place, as the outliner drew it. */
export const spotOfRow = (row: WorkRow) => row.spot as Spot | undefined;

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
  const { afterWrites, inTurn, latest } = useWritesInTurn(data);
  const [pending, setPending] = useState<ReadonlyArray<Pending>>([]);
  const [fresh, setFresh] = useState<Fresh>();
  const [follow, setFollow] = useState<{ key: string }>();
  const made = useRef(0);
  const outline = writes.read(data);
  const drawn = drawnOf(outline, pending, fresh);
  // A write the file shows is no longer pending: dropped once its version is past.
  useEffect(() => {
    if (pending.some((one) => one.base !== undefined && one.base !== outline.hash)) {
      setPending((all) => all.filter((one) => one.base === undefined || one.base === outline.hash));
    }
  }, [pending, outline.hash]);

  /** A write, in turn: refused, it shows; resolves with whether it was written. */
  const write = async (
    call: (now: Data) => Promise<string | undefined>,
    then?: (now: Outline<Source>) => string | undefined,
  ) => {
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
   * An edit of the item at `spot`, or of its nested item at `spot.at`, found again in `now`: by
   * their keys, else by their places, written since. A nested row named by `key` is never taken by
   * its place in another item: that would be another row.
   */
  const edit = (now: Data, spot: Spot, key: string | undefined, kind: string, text?: string) => {
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
  };

  /**
   * A pending write: its version is set as it is written, for it to go once the file has it. A
   * refused one goes at once, with those asked after it, which were placed after it.
   */
  const pend = (one: Asked) => {
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

  /** The new row written at `spot` with `text`, in the place it shows. */
  const insertAt = (spot: Spot, text: string) => {
    const { based, done, refused } = pend({ kind: "insert", spot, text });
    void write((now) => {
      based(now.hash);
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
          ? edit(now, of(undefined, 0), undefined, "insert-above", text)
          : edit(now, of(undefined, spot.index - 1), undefined, "insert-below", text);
      }
      const item = items[spot.index];
      const children = item?.children ?? [];
      const depth = spot.depth ?? 1;
      if (spot.at === 0) {
        return children.length > 0
          ? edit(now, of(0), undefined, "insert-above", text)
          : edit(now, of(undefined), item?.key, "append-child", text);
      }
      const sibling = siblingAbove(children, spot.at, depth);
      if (sibling !== -1) {
        return edit(now, of(sibling), undefined, "insert-below", text);
      }
      // Its parent is just above it: before its first item, or its first one.
      return children[spot.at]?.depth === depth
        ? edit(now, of(spot.at), undefined, "insert-above", text)
        : edit(now, of(spot.at - 1), undefined, "append-child", text);
    }).then((isWritten) => (isWritten ? done() : refused()));
  };

  /** The place right after `spot` and its nested rows, at its depth: where `o` adds. */
  const below = (spot: Spot): Spot => {
    if (spot.at === undefined) {
      return { index: spot.index + 1, section: spot.section };
    }
    const item = itemAt(drawn, spot);
    return { ...spot, at: spot.at + 1 + descendants(item?.children ?? [], spot.at) };
  };

  /** A row's text, `key` at `spot`, becomes `text`. */
  const editText = (spot: Spot, key: string, text: string) => {
    const { based, done, refused } = pend({ key, kind: "edit", text });
    void write(
      (now) => {
        based(now.hash);
        return edit(now, spot, key, "edit", text);
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
        (now) => edit(now, spot, key, "indent"),
        (now) => {
          const parent = itemAt(now, { ...spot, index: spot.index - 1 });
          const last = parent?.children.findLastIndex((child) => child.depth === 1) ?? -1;
          return last === -1 ? undefined : parent?.children[last]?.key;
        },
      );
      return;
    }
    void write(
      (now) => edit(now, spot, key, move),
      (now) => {
        // An item's own item outdented becomes the item after it.
        if (move === "outdent" && spot.depth === 1) {
          return keyAt(now, { index: spot.index + 1, section: spot.section });
        }
        const item = itemAt(now, spot);
        return item?.children.find((child) => child.key === key)?.key ?? keyAt(now, spot);
      },
    );
  };

  /** The new row is done: saved at its place with `text`, the next one opened, or dropped. */
  const freshDone = (text: string | undefined, then: "next" | "stop") => {
    if (!fresh) {
      return;
    }
    const { spot } = fresh;
    if (text === undefined) {
      setFresh(undefined);
      // Back on the row above it, once the rows added before it are written and drawn: the last
      // one added, after Enter, or the row `o` was pressed on.
      const above =
        spot.at === undefined
          ? { ...spot, index: Math.max(0, spot.index - 1) }
          : spot.at === 0
            ? { index: spot.index, section: spot.section }
            : { ...spot, at: spot.at - 1 };
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
    const items =
      drawnOf(outline, pending).sections.find((section) => section.id === spot.section)?.items ??
      [];
    if (spot.at === undefined) {
      const above = items[spot.index - 1];
      // In: the last item of the item above it, one that takes items.
      if (!isOut && above && !above.isFixed && !isPending(above.key)) {
        setFresh({
          spot: {
            ...spot,
            at: above.children.length,
            depth: 1,
            index: spot.index - 1,
            item: above.key,
          },
          text,
        });
        return;
      }
      setFresh({ spot, text });
      return;
    }
    const children = items[spot.index]?.children ?? [];
    const depth = spot.depth ?? 1;
    if (!isOut && siblingAbove(children, spot.at, depth) !== -1) {
      setFresh({ spot: { ...spot, depth: depth + 1 }, text });
      return;
    }
    // Out: only the last of its parent's items, so that none after it comes under it.
    if (isOut && (children[spot.at]?.depth ?? 0) < depth) {
      setFresh({
        spot:
          depth > 1
            ? { ...spot, depth: depth - 1 }
            : { index: spot.index + 1, section: spot.section },
        text,
      });
      return;
    }
    setFresh({ spot, text });
  };

  /** The field of the row `key` at `spot`, edited in place, or the new row's. */
  const editorOf = (spot: Spot, key: string, value: string) =>
    key === FRESH
      ? () => (
          <OutlineEditor
            // A new field at each place: the next row, or the same one indented, opens empty, or
            // with its text.
            key={`${spot.section}:${spot.index}:${spot.at ?? ""}:${spot.depth ?? ""}`}
            isNew
            label={labels.fresh}
            onCancel={() => freshDone(undefined, "stop")}
            onIndent={freshIndent}
            // Enter opens the next new row; leaving the field only saves.
            onSave={(text, how) => freshDone(text, how === "enter" ? "next" : "stop")}
            value={fresh?.text ?? ""}
          />
        )
      : (hooks: { onDone: () => void }) => (
          <OutlineEditor
            label={labels.edit}
            onCancel={hooks.onDone}
            onIndent={(isOut, text) => {
              hooks.onDone();
              if (text !== "" && text !== value.trim()) {
                editText(spot, key, text);
              }
              onOutline(spot, key, isOut ? "outdent" : "indent");
            }}
            onSave={(text) => {
              hooks.onDone();
              editText(spot, key, text);
            }}
            value={value}
          />
        );

  /**
   * The row of `item` at `spot`, with its nested rows, as the outliner draws it: its key, its
   * place, its field, and whether it is new or not written yet. `href` is where its nested rows
   * lead; a row that stays as it is keeps its nested rows as they are too.
   */
  const rowOf = (item: OutlineItem<Source>, spot: Spot, href: string) => {
    const isWritten = !isPending(item.key);
    const isNew = item.key === FRESH;
    const nested = item.children.map((child, at): WorkRow => {
      const childSpot = { ...spot, at, depth: child.depth, item: item.key };
      const isChildWritten = !isPending(child.key);
      const isChildNew = child.key === FRESH;
      return {
        depth: child.depth,
        // A row that stays as it is, a running line, keeps its nested rows as they are too.
        ...(isChildWritten && !item.isFixed
          ? { editor: editorOf(childSpot, child.key, child.text) }
          : {}),
        editsInPlace: isChildWritten && !isChildNew && !item.isFixed,
        href,
        isFixed: item.isFixed === true || !isChildWritten || isChildNew,
        isFresh: isChildNew,
        key: child.key,
        lines: [],
        parent: item.key,
        spot: childSpot,
        text: child.spans.map((span) => span.text).join(""),
      };
    });
    return {
      children: nested,
      ...(isWritten ? { editor: editorOf(spot, item.key, item.text) } : {}),
      isFixed: item.isFixed === true || !isWritten || isNew,
      isFresh: isNew,
      isWritten: isWritten && !isNew,
      key: item.key,
      lines: [],
      spot,
      ...(item.staysItem ? { staysLine: true } : {}),
    };
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

  /**
   * A drop that nests a row, moves a nested row, or makes one an item: the row and the one it goes
   * under are found again by their keys as it is written, then the row selected where it went.
   */
  const onNest = (key: string, to: Dropped) => {
    /** The item `key` is, or the item and the place of its nested row `key`, in `read`. */
    const placeOf = (read: Outline<Source>, one: string): ItemPlace | undefined => {
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
    };
    return write(
      (now) => {
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
      },
      // Its key follows its text: a nested row's is `<item>/<slug>`, an item's its slug. It is looked
      // for where it went only: under the item it went under, or among its section's items.
      (now) => {
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
                  (item) =>
                    item.key === parent || item.children.some((child) => child.key === parent),
                )
                ?.children.map((child) => child.key) ?? []);
        return (
          all.find((one) => one === key) ??
          all.find((one) => one === slug || one.endsWith(`/${slug}`))
        );
      },
    );
  };

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
      return edit(now, spot, row.key, "remove");
    }).then((isWritten) => {
      if (isWritten) {
        done();
      } else {
        refused();
      }
      return isWritten;
    });
  };

  return {
    drawn,
    follow,
    onAddBeside,
    onDelete,
    onNest,
    onOutline: (row: WorkRow, move: OutlineMove) => {
      const spot = spotOfRow(row);
      if (spot && !row.isFresh && !row.isFixed) {
        onOutline(spot, row.key, move);
      }
    },
    openAt,
    rowOf,
    /** A write in turn with the others, as a drop's: refused, it shows. */
    write: (call: (now: Data) => Promise<string | undefined>) => write(call),
  };
}
