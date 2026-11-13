// Records as signals, typed from the protocol's catalogue (`protocol.d.ts`). A record is subscribed
// while a view that read it is there: `read` holds it for the component, effect, or computation
// it is called in, and lets it go when that goes, with a grace (`GRACE`) before the `unsub`.
import { type Accessor, cleanup, context, untracked } from "nsh";
import type { Connection, Entry } from "./connection";
import type { StoreError } from "./errors";
import type { ListView } from "./held";
import type { Actions, JsonValue, Records } from "./protocol";

export type RecordName = keyof Records;
export type Args<N extends RecordName> = Records[N]["args"];
export type Value<N extends RecordName> = Records[N]["value"];
export type ActionName = keyof Actions;
export type Input<A extends ActionName> = Actions[A]["input"];
export type Output<A extends ActionName> = Actions[A]["output"];

/**
 * A record read: its value, `undefined` until it first came, and kept, stale, while offline; and
 * `error`, why the server would not give it.
 */
export type Live<V> = Accessor<V | undefined> & {
  readonly error: Accessor<StoreError | undefined>;
};

const lives = new WeakMap<Entry, Live<unknown>>();
const entries = new WeakMap<Live<unknown>, Entry>();

/**
 * Whether the caller is drawn under the app's root (`RecordsRoot`): a component, or an effect or a
 * computation of one. A listener, a key's `run` or `when` as the keyboard reads it, a timer, and a
 * module's top level are not, and nothing there lets a record go.
 */
const Rooted = context(false);

/** Around the app's views: a record read outside it is told to `onUnheldRead`. */
export const RecordsRoot = Rooted.Provider;

let unheld: (record: string) => void = (record) =>
  console.warn(
    `[store] ${record} was read where nothing lets it go, a listener or a key's run or guard: it stays subscribed. Read the record its component holds.`,
  );
let rooted = false;

/** Hears each record read where nothing lets it go, once the app's root is drawn: a test's. */
export function onUnheldRead(told: (record: string) => void) {
  unheld = told;
}

/** Says the app's root is drawn: from then on a read outside it is told. */
export function rootDrawn() {
  rooted = true;
}

/** `name` with `args` on `connection`, held for the component or effect this is called in. */
export function read<N extends RecordName>(
  connection: Connection,
  name: N,
  args: Args<N>,
): Live<Value<N>> {
  if (rooted && !Rooted()) unheld(`${name} ${JSON.stringify(args)}`);
  const entry = connection.hold(name, args as JsonValue);
  cleanup(() => connection.letGo(entry));
  return liveOf(entry) as Live<Value<N>>;
}

/** `name` with `args`, told to `seen` as it changes until the function it gives is called. */
export function watch<N extends RecordName>(
  connection: Connection,
  name: N,
  args: Args<N>,
  seen: (value: Value<N> | undefined, error: StoreError | undefined) => void,
): () => void {
  const entry = connection.hold(name, args as JsonValue);
  const tell = () =>
    seen(untracked(entry.held.value) as Value<N> | undefined, untracked(entry.error));
  entry.listeners.add(tell);
  if (untracked(entry.held.value) !== undefined || untracked(entry.error) !== undefined) tell();
  let stopped = false;
  return () => {
    if (stopped) return;
    stopped = true;
    entry.listeners.delete(tell);
    connection.letGo(entry);
  };
}

/** The keys of a record's value that hold a list of items with an `id`. */
export type ListKey<V> = {
  [K in keyof V]-?: NonNullable<V[K]> extends ReadonlyArray<{ id: string }> ? K : never;
}[keyof V] &
  string;

/** The item of the list at `K`. */
export type ItemOf<V, K extends keyof V> =
  NonNullable<V[K]> extends ReadonlyArray<infer T> ? T : never;

/**
 * A list of a record, by its field (`list(log, "items")`) or a path to it: its rows, new only
 * when an item comes, goes, or moves, and each item from its own signal. Read it from a record
 * the component holds.
 */
export function list<V, K extends ListKey<NonNullable<V>>>(
  source: Live<V>,
  key: K,
): ListView<ItemOf<NonNullable<V>, K>>;
export function list<T extends { id: string }>(
  source: Live<unknown>,
  path: ReadonlyArray<string>,
): ListView<T>;
export function list(source: Live<unknown>, path: string | ReadonlyArray<string>) {
  return entryOf(source).held.list(typeof path === "string" ? [path] : path);
}

/**
 * The text at `path` of a record, a reply's `["items", id, "text"]`: it only grows while the
 * text streams, by each `append`, and is set whole when the record is read again. Empty while
 * there is none.
 */
export function text(source: Live<unknown>, path: ReadonlyArray<string>): Accessor<string> {
  return entryOf(source).held.text(path);
}

function liveOf(entry: Entry): Live<unknown> {
  let live = lives.get(entry);
  if (live === undefined) {
    const made = Object.assign(() => entry.held.value(), {
      error: () => entry.error(),
    }) as Live<unknown>;
    lives.set(entry, made);
    entries.set(made, entry);
    live = made;
  }
  return live;
}

function entryOf(source: Live<unknown>): Entry {
  const entry = entries.get(source);
  if (entry === undefined) throw new Error("`list` and `text` read a record that `record` gave");
  return entry;
}
