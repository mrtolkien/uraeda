// A record's value as the client holds it, and the views a screen reads of it: the whole value, a
// list's rows with one signal per item, and a growing text. A change is applied once, to the
// value, and then reaches only the views on its path: an append to a reply sets that reply's
// text, and its item's signal, and no list's rows.
import { type Accessor, type Signal, signal, untracked } from "nsh";
import { applyOne, idOf, valueAt } from "./apply";
import type { JsonValue, Op } from "./protocol";

type Json = JsonValue;

/** A row of a list's rows: its `id`, the one object the list keeps for it while it is there. */
export type RowOf = { readonly id: string };

/** A list of a record: its rows, new at each insert, remove, or move, and its items, by id. */
export type ListView<T> = {
  /** The rows, in order: each row's object stays the same (`===`) while its item is there. */
  rows: Accessor<ReadonlyArray<RowOf>>;
  /** The item `id` as it is now, read from its own signal: only its own changes redraw it. */
  item: (id: string) => T | undefined;
};

type HeldList = {
  path: ReadonlyArray<string>;
  rows: Signal<ReadonlyArray<RowOf>>;
  /** The row object of each id, kept while the item is in the list. */
  rowOf: Map<string, RowOf>;
  /** The signals of the items read so far, made as each is first read. */
  items: Map<string, Signal<Json | undefined>>;
  view: ListView<unknown>;
};

/** A record held: its value, and the views read of it. */
export class Held {
  /** The value, or `undefined` before the first `data`. */
  readonly value: Signal<Json | undefined> = signal<Json | undefined>(undefined);
  /** The number of the last change applied, under the epoch it came in. */
  seq: number | undefined = undefined;
  private readonly lists = new Map<string, HeldList>();
  private readonly texts = new Map<string, { path: ReadonlyArray<string>; text: Signal<string> }>();

  /** The whole value, from `data`: every view reads it again. */
  data(value: Json, seq: number) {
    this.seq = seq;
    this.value.set(value);
    for (const list of this.lists.values()) this.refreshList(list, value);
    for (const { path, text } of this.texts.values()) text.set(textAt(value, path));
  }

  /**
   * A change, if it fits: `false`, and nothing changed, when it does not. Each operation reaches
   * the views on its path only.
   */
  change(ops: ReadonlyArray<Op>, seq: number): boolean {
    const before = untracked(this.value);
    if (before === undefined) return false;
    let next = before;
    try {
      for (const op of ops) next = applyOne(next, op);
    } catch {
      return false;
    }
    this.seq = seq;
    this.value.set(next);
    for (const op of ops) this.reach(op, next);
    return true;
  }

  /** The list at `path`, made once. */
  list<T>(path: ReadonlyArray<string>): ListView<T> {
    const key = JSON.stringify(path);
    let list = this.lists.get(key);
    if (list === undefined) {
      const made: HeldList = {
        items: new Map(),
        path: [...path],
        rowOf: new Map(),
        rows: signal<ReadonlyArray<RowOf>>([]),
        view: undefined as unknown as ListView<unknown>,
      };
      made.view = {
        item: (id) => this.itemSignal(made, id)(),
        rows: made.rows,
      };
      this.refreshList(made, untracked(this.value));
      this.lists.set(key, made);
      list = made;
    }
    return list.view as ListView<T>;
  }

  /** The text at `path`, made once: empty until there is one. */
  text(path: ReadonlyArray<string>): Accessor<string> {
    const key = JSON.stringify(path);
    let held = this.texts.get(key);
    if (held === undefined) {
      held = { path: [...path], text: signal(textAt(untracked(this.value), path)) };
      this.texts.set(key, held);
    }
    return held.text;
  }

  /** What one operation changed, told to the views on its path. */
  private reach(op: Op, value: Json) {
    const path = op.path;
    if (op.op === "append") {
      const held = this.texts.get(JSON.stringify(path));
      held?.text.set(untracked(held.text) + op.text);
    } else {
      for (const held of this.texts.values()) {
        if (isPrefix(path, held.path)) held.text.set(textAt(value, held.path));
      }
    }
    for (const list of this.lists.values()) this.reachList(list, op, value);
  }

  private reachList(list: HeldList, op: Op, value: Json) {
    const path = op.path;
    const at = list.path.length;
    if (path.length < at || (path.length === at && op.op !== "insert")) {
      // The list itself, or what holds it, was set or removed.
      if (isPrefix(path, list.path)) this.refreshList(list, value);
      return;
    }
    if (!isPrefix(list.path, path)) return;
    if (path.length === at) {
      // An insert: one new row.
      this.placeRows(list, value);
      const id = idOf(op.op === "insert" ? op.value : null);
      if (id !== undefined) list.items.get(id)?.set(valueAt(value, [...list.path, id]));
      return;
    }
    const id = path[at]!;
    if (path.length === at + 1 && (op.op === "remove" || op.op === "move")) {
      this.placeRows(list, value);
    }
    list.items.get(id)?.set(valueAt(value, [...list.path, id]));
  }

  /** The rows again, after an insert, a remove, or a move: the same object for every id kept. */
  private placeRows(list: HeldList, value: Json) {
    const items = valueAt(value, list.path);
    const rows: RowOf[] = [];
    const kept = new Map<string, RowOf>();
    if (Array.isArray(items)) {
      for (const item of items) {
        const id = idOf(item);
        if (id === undefined) continue;
        const row = list.rowOf.get(id) ?? { id };
        kept.set(id, row);
        rows.push(row);
      }
    }
    list.rowOf = kept;
    const before = untracked(list.rows);
    const same = before.length === rows.length && rows.every((row, index) => before[index] === row);
    if (!same) list.rows.set(rows);
  }

  /** The list read whole again: from `data`, or a `set` of what holds it. */
  private refreshList(list: HeldList, value: Json | undefined) {
    this.placeRows(list, value ?? null);
    for (const [id, item] of list.items) item.set(valueAt(value, [...list.path, id]));
  }

  private itemSignal(list: HeldList, id: string): Signal<Json | undefined> {
    let item = list.items.get(id);
    if (item === undefined) {
      item = signal(valueAt(untracked(this.value), [...list.path, id]));
      list.items.set(id, item);
    }
    return item;
  }
}

function textAt(value: Json | undefined, path: ReadonlyArray<string>): string {
  const text = valueAt(value, path);
  return typeof text === "string" ? text : "";
}

/** Whether `prefix` is the start of `path`, or all of it. */
function isPrefix(prefix: ReadonlyArray<string>, path: ReadonlyArray<string>): boolean {
  return prefix.length <= path.length && prefix.every((step, index) => path[index] === step);
}
