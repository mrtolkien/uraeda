// The outliner's model (see `useOutline`): a list as sections of items with their nested items, the
// places in it, the writes made ahead of the file, and the list as it will be once they are
// written.
import type { NestedItem, Span } from "uraeda-binding";
import type { WorkRow } from "./Card.tsx";
import { depthOf, nestedEnd } from "./nesting.ts";

/** An item of a section, as the outliner reads it: its own fields stay in `source`. */
export type OutlineItem<Source> = {
  children: ReadonlyArray<NestedItem>;
  /** What the writes name it by, as `note-3` or `next-2`. */
  id: string;
  /** Whether it stays as it is, as a running line: nothing indents under it. */
  isFixed?: boolean;
  key: string;
  /** Absent for a row added and not written yet. */
  source?: Source;
  spans: ReadonlyArray<Span>;
  /**
   * Whether it stays an item of its section, never nested under another: a proposal with a file.
   */
  staysItem?: boolean;
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
export type Pending =
  | { base?: string; id: number; kind: "insert"; spot: Spot; text: string }
  | { base?: string; id: number; key: string; kind: "edit"; text: string }
  | { base?: string; id: number; key: string; kind: "remove" };

/** A pending write as it is asked for: its id is given to it. */
export type Asked = Pending extends infer One
  ? One extends Pending
    ? Omit<One, "id">
    : never
  : never;

/** The new row being typed, at `spot`, with the text typed so far. */
export type Fresh = { spot: Spot; text: string };

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
  /** The outline edit `kind` of the item `id`, or of its nested item at `at`. */
  edit: (
    now: Data,
    id: string,
    at: number | undefined,
    kind: string,
    text?: string,
  ) => Promise<string | undefined>;
  /** The list as the outliner reads it. */
  read: (data: Data) => Outline<Source>;
};

/** The key of the new row being typed. */
export const FRESH = "fresh";

/** Whether a key is a row added and not written yet. */
export const isPending = (key: string) => key.startsWith("pending:");

/** A row's place, as the outliner drew it. */
export const spotOfRow = (row: WorkRow) => row.spot as Spot | undefined;

/** Text as spans, plain: what a row added or edited shows until the file has it. */
const spansOf = (text: string): Array<Span> => [
  { code: false, emphasis: false, strike: false, strong: false, text },
];

/** The item of `spot` in `now`, by its key first, else by its place. */
export function itemAt<Source>(now: Outline<Source>, spot: Spot, key?: string) {
  const all = now.sections.flatMap((section) => section.items);
  return (
    (key === undefined ? undefined : all.find((item) => item.key === key)) ??
    now.sections.find((section) => section.id === spot.section)?.items[spot.index]
  );
}

/** The key of the row at `spot` in `now`. */
export function keyAt<Source>(now: Outline<Source>, spot: Spot) {
  const item = now.sections.find((one) => one.id === spot.section)?.items[spot.index];
  return spot.at === undefined ? item?.key : item?.children[spot.at]?.key;
}

/**
 * The list with `pending` made and `fresh` placed, as it will be: what the page draws. A write the
 * file shows, its version past the one it was written over, is no longer pending.
 */
export function drawnOf<Source>(
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
          const count = nestedEnd(item.children, child, depthOf) - child;
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
