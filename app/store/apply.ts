// A change applied to a value the client holds, as the protocol's crate applies it (`apply` of
// `crates/protocol/src/change.rs`), on values that are never changed in place: an operation copies
// the records and lists on its path, and keeps every other object as it was. So a row of a list
// that did not change is the same object (`===`) after the change, and a reader that compares by
// identity, a list's cells, redraws only what changed.
//
// A path's step is a record's field, or an item's `id` in a list: finding an item reads its list
// once, which a page of 100 items makes cheap. Nothing here walks the whole value.
import type { JsonValue, Op } from "./protocol";

type Json = JsonValue;
type Fields = { [key: string]: Json };

/** A change that does not fit the value held: the two sides differ, and the client reads again. */
export class ApplyError extends Error {}

/** `value` after `ops`, in order. Throws `ApplyError` when one does not fit: `value` is untouched. */
export function apply(value: Json, ops: ReadonlyArray<Op>): Json {
  let next = value;
  for (const op of ops) {
    next = applyOne(next, op);
  }
  return next;
}

/** `value` after one operation. */
export function applyOne(value: Json, op: Op): Json {
  const path = op.path;
  switch (op.op) {
    case "set":
      return path.length === 0
        ? op.value
        : within(value, path, path.length - 1, (parent) =>
            put(parent, path[path.length - 1]!, op.value, true),
          );
    case "append":
      return within(value, path, path.length, (text) => {
        if (typeof text !== "string") throw new ApplyError(`no text at ${show(path)}`);
        return text + op.text;
      });
    case "insert":
      return within(value, path, path.length, (list) => {
        const item = op.value;
        const id = idOf(item);
        if (id === undefined) throw new ApplyError(`an item without an id at ${show(path)}`);
        const items = listAt(list, path);
        if (indexOf(items, id) >= 0) throw new ApplyError(`${id} is already in ${show(path)}`);
        return placed(items, item, op.before ?? null, path);
      });
    case "remove":
      return within(value, path, path.length - 1, (parent) =>
        without(parent, path[path.length - 1]!, path),
      );
    case "move":
      return within(value, path, path.length - 1, (parent) => {
        const items = listAt(parent, path);
        const id = path[path.length - 1]!;
        const at = indexOf(items, id);
        if (at < 0) throw new ApplyError(`no item ${id} in ${show(path)}`);
        const rest = items.filter((_, index) => index !== at);
        return placed(rest, items[at]!, op.before ?? null, path);
      });
  }
}

/** What is at `path` in `value`, or `undefined`. */
export function valueAt(value: Json | undefined, path: ReadonlyArray<string>): Json | undefined {
  let here: Json | undefined = value;
  for (const step of path) {
    here = child(here, step);
    if (here === undefined) return undefined;
  }
  return here;
}

/** An item's `id`, when it is a record with a text `id`. */
export function idOf(item: Json | undefined): string | undefined {
  if (item === null || typeof item !== "object" || Array.isArray(item)) return undefined;
  const id = item.id;
  return typeof id === "string" ? id : undefined;
}

function child(container: Json | undefined, step: string): Json | undefined {
  if (Array.isArray(container)) {
    const at = indexOf(container, step);
    return at < 0 ? undefined : container[at];
  }
  if (container !== null && typeof container === "object") {
    return Object.hasOwn(container, step) ? container[step] : undefined;
  }
  return undefined;
}

/** `value` with what is `depth` steps down `path` given to `change`, and the copies above it. */
function within(
  value: Json,
  path: ReadonlyArray<string>,
  depth: number,
  change: (at: Json) => Json,
): Json {
  if (depth < 0) throw new ApplyError("the empty path names no field or item");
  const go = (here: Json, step: number): Json => {
    if (step === depth) return change(here);
    const name = path[step]!;
    const below = child(here, name);
    if (below === undefined) throw new ApplyError(`nothing at ${show(path.slice(0, step + 1))}`);
    return put(here, name, go(below, step + 1), false);
  };
  return go(value, 0);
}

/** `container` with `name` holding `value`: a record's field, new or not, or a list's item. */
function put(container: Json, name: string, value: Json, fresh: boolean): Json {
  if (Array.isArray(container)) {
    const at = indexOf(container, name);
    if (at < 0) throw new ApplyError(`no item ${name}`);
    if (idOf(value) !== name) throw new ApplyError(`the item ${name} would lose its id`);
    const copy = container.slice();
    copy[at] = value;
    return copy;
  }
  if (container === null || typeof container !== "object") {
    throw new ApplyError(`no record to hold ${name}`);
  }
  if (!fresh && container[name] === value) return container;
  return { ...container, [name]: value } as Fields;
}

function without(container: Json, name: string, path: ReadonlyArray<string>): Json {
  if (Array.isArray(container)) {
    const at = indexOf(container, name);
    if (at < 0) throw new ApplyError(`no item ${name} in ${show(path)}`);
    return container.filter((_, index) => index !== at);
  }
  if (container === null || typeof container !== "object" || !Object.hasOwn(container, name)) {
    throw new ApplyError(`nothing at ${show(path)}`);
  }
  const copy: Fields = { ...container };
  delete copy[name];
  return copy;
}

function listAt(value: Json, path: ReadonlyArray<string>): Json[] {
  if (!Array.isArray(value)) throw new ApplyError(`no list at ${show(path)}`);
  return value;
}

function placed(
  items: Json[],
  item: Json,
  before: string | null,
  path: ReadonlyArray<string>,
): Json[] {
  if (before === null) return [...items, item];
  const at = indexOf(items, before);
  if (at < 0) throw new ApplyError(`no item ${before} to go before in ${show(path)}`);
  return [...items.slice(0, at), item, ...items.slice(at)];
}

function indexOf(items: ReadonlyArray<Json>, id: string): number {
  return items.findIndex((item) => idOf(item) === id);
}

function show(path: ReadonlyArray<string>): string {
  return `[${path.join(", ")}]`;
}
