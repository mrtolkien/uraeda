// The client's connection to `ura serve`: one WebSocket at `/live`, as the protocol's contract
// says (`specs/2026-11-10-nsh-migration/contracts/protocol.md`). It says `hello`, subscribes to
// the records something reads, applies their changes, runs calls, and, when the line drops,
// connects again after a wait that grows from 0.5 s to 10 s and resumes each record it holds.
//
// - **One frame, one draw**: the server's messages wait in an inbox and are applied together, in
//   one `batch`, a frame after the first of them came: a burst of pieces of a reply draws once.
// - **Ids are never reused** on a connection, for a `sub`, a `resume`, or a `call`: an answer for
//   an id that is no longer open is one that crossed an `unsub`, and is dropped.
// - **A gap** in a record's numbers means `unsub`, then `resume` from the last change applied,
//   under a new id; **a change that does not fit** means `unsub`, then `sub`, for the whole value.
// - **Offline**, the records keep their last values, and say they are stale; a call fails at once.
// - **Moved**, to a server found at another address, as this machine's started again on another
//   port, the records keep their values, stale, until that server's come.
// - **Refused**, nothing tries again: `refused()` says which side to update, or to sign in.
// - **A binary frame** holds a message whose large part, a record's first value, came compressed:
//   `unpackFrame` of `uraeda/native` inflates it, in Rust on GTK and in the browser alike, before
//   it is parsed. One it cannot read fails the subscription or the call its head names, with its
//   words.
import { type Accessor, batch, type Signal, signal, untracked } from "nsh";
import { unpackFrame } from "uraeda/native";
import { measured } from "../ui/timing";
import { dropped, offline, type Refused, refusedBy, StoreError } from "./errors";
import { Held } from "./held";
import { type Line, liveUrl, type Opener, openSocket } from "./line";
import type { ClientMessage, JsonValue, Protocol, ServerMessage, SignIn } from "./protocol";

/** The version of the protocol this client speaks: it stops compiling when the server's rises. */
export const PROTOCOL: Protocol = 2;

/** The waits before each new try, after a drop: the last one repeats. */
export const WAITS = [500, 1000, 2000, 4000, 8000, 10_000] as const;

/** How long a record nobody reads stays subscribed: a pane hidden and shown again keeps it. */
export const GRACE = 5000;

/** How long the server's messages wait, so that those of one frame are applied together. */
const FRAME = 16;

export type Status = "connecting" | "live" | "offline" | "refused";

export type ConnectOptions = {
  /** The server, as `http://127.0.0.1:4420`. */
  address: string;
  /** How the client signs in: the browser's cookie, or a paired device's token. */
  signIn: SignIn;
  /** How long a record nobody reads stays subscribed, in milliseconds: `GRACE` unless given. */
  grace?: number;
  /** The seam to the line: the platform's WebSocket unless given. */
  open?: Opener;
};

/** A record held by a connection, by its name and arguments. */
export type Entry = {
  key: string;
  name: string;
  args: JsonValue;
  held: Held;
  error: Signal<StoreError | undefined>;
  /** How many readers hold it now. */
  refs: number;
  /** Its open subscription's id, or none. */
  sub: number | undefined;
  /** The epoch its `seq` was given under. */
  epoch: string | undefined;
  /** The timer that drops it, once nobody reads it, after the grace. */
  leaving: number | undefined;
  /** The callbacks told after each value or error: an extension page's reads. */
  listeners: Set<() => void>;
  /** Whether a frame of it could not be read since its last value: it was asked for again. */
  unread: boolean;
};

type Waiting = { resolve: (output: unknown) => void; reject: (error: StoreError) => void };

/** What waits to be applied: a server's message, or a frame of one that could not be read. */
type Inbound = ServerMessage | { type: "unreadable"; id: number; message: string };

export class Connection {
  private readonly where: Signal<string>;
  readonly signIn: SignIn;
  private readonly statusSignal = signal<Status>("connecting");
  private readonly refusedSignal = signal<Refused | undefined>(undefined);
  private readonly wasLive = signal(false);
  private readonly grace: number;
  private readonly opener: Opener;
  private line: Line | undefined;
  private epoch: string | undefined;
  private nextId = 1;
  private tries = 0;
  private retry: number | undefined;
  private closed = false;
  private readonly entries = new Map<string, Entry>();
  private readonly subs = new Map<number, Entry>();
  private readonly calls = new Map<number, Waiting>();
  private inbox: Inbound[] = [];
  private flushing: number | undefined;

  /**
   * `heardZone` hears the server's time zone at each `welcome`: the store's `connect` hands it to
   * `setServerZone`, which every time the app shows reads.
   */
  constructor(
    options: ConnectOptions,
    private readonly heardZone: (zone: string) => void = () => {},
  ) {
    this.where = signal(options.address);
    this.signIn = options.signIn;
    this.grace = options.grace ?? GRACE;
    this.opener = options.open ?? openSocket;
    this.open();
  }

  /** The server's address, as `http://127.0.0.1:4420`: the last one `moveTo` gave. A signal. */
  get address(): string {
    return this.where();
  }

  /** Where the connection is: `live` once welcomed, `offline` between tries, `refused` for good. */
  readonly status: Accessor<Status> = () => this.statusSignal();

  /** Why the server refused the client, while `status` is `refused`. */
  readonly refused: Accessor<Refused | undefined> = () => this.refusedSignal();

  /** Whether what the records hold may be out of date: they were live, and the line is not. */
  readonly stale: Accessor<boolean> = () => this.wasLive() && this.statusSignal() !== "live";

  /** How many subscriptions are open on the line now: one per record held, at most. */
  subscriptions(): number {
    return this.subs.size;
  }

  /**
   * The records subscribed now, each as its name and its arguments, sorted: what a test compares
   * before and after a place was opened and closed, to name a record nothing lets go.
   */
  held(): ReadonlyArray<string> {
    return [...this.subs.values()].map((entry) => entry.key).toSorted();
  }

  /**
   * How many records something reads now that wait for the server's first value: none once the
   * page shown has its data. The development build's timing of an interaction reads it.
   */
  waiting(): number {
    let count = 0;
    for (const entry of this.entries.values()) {
      if (entry.refs > 0 && entry.held.seq === undefined && untracked(entry.error) === undefined) {
        count += 1;
      }
    }
    return count;
  }

  /** Tries again now, while offline, rather than at the end of the wait. */
  reconnect() {
    if (this.closed || this.statusSignal() !== "offline") return;
    clearTimeout(this.retry);
    this.retry = undefined;
    this.open();
  }

  /**
   * Connects to the server at `address` from now on, as this machine's server started again on
   * another port: the records keep their last values, stale, until that server gives its own.
   */
  moveTo(address: string) {
    if (this.closed || this.statusSignal() === "refused") return;
    if (address === untracked(this.where)) return this.reconnect();
    this.where.set(address);
    const line = this.line;
    if (line !== undefined) {
      this.lost();
      line.close();
    }
    clearTimeout(this.retry);
    this.retry = undefined;
    this.open();
  }

  /** Ends the connection: nothing tries again, and every call waiting fails. */
  close() {
    this.closed = true;
    clearTimeout(this.retry);
    this.line?.close();
    this.statusSignal.set("offline");
  }

  /** The entry of a record, made once, held by one more reader. */
  hold(name: string, args: JsonValue): Entry {
    const key = `${name} ${canonical(args)}`;
    let entry = this.entries.get(key);
    if (entry === undefined) {
      entry = {
        args,
        epoch: undefined,
        error: signal<StoreError | undefined>(undefined),
        held: new Held(),
        key,
        leaving: undefined,
        listeners: new Set(),
        name,
        refs: 0,
        sub: undefined,
        unread: false,
      };
      this.entries.set(key, entry);
    }
    entry.refs += 1;
    clearTimeout(entry.leaving);
    entry.leaving = undefined;
    // A record the server refused is asked for again on the next connection, not by each reader:
    // a view that reads its error would ask again at each answer.
    const refused = untracked(entry.error) !== undefined;
    if (entry.sub === undefined && !refused && this.statusSignal() === "live") {
      this.subscribe(entry);
    }
    return entry;
  }

  /**
   * One reader of `entry` less: nobody left, it is dropped after the grace, and never at once: a
   * computation that runs again lets its records go, then reads them again, in one pass.
   */
  letGo(entry: Entry) {
    entry.refs -= 1;
    if (entry.refs > 0) return;
    entry.leaving = setTimeout(() => this.drop(entry), this.grace);
  }

  /** Runs an action: its output, or a `StoreError`. With no live line it fails at once. */
  call(action: string, input: JsonValue): Promise<unknown> {
    if (this.statusSignal() !== "live" || this.line === undefined) {
      return Promise.reject(offline());
    }
    const id = this.nextId++;
    const answer = new Promise<unknown>((resolve, reject) => {
      this.calls.set(id, { reject, resolve });
    });
    this.send({ action, id, input, type: "call" });
    return answer;
  }

  private open() {
    this.statusSignal.set("connecting");
    let line: Line | undefined;
    line = this.opener(liveUrl(untracked(this.where)), {
      closed: () => {
        if (this.line === line) this.lost();
      },
      message: (frame) => {
        if (this.line === line) this.heard(frame);
      },
      opened: () => {
        if (this.line !== line) return;
        this.send({ protocol: PROTOCOL, signIn: this.signIn, type: "hello" });
      },
    });
    this.line = line;
  }

  private send(message: ClientMessage) {
    this.line?.send(JSON.stringify(message));
  }

  private heard(frame: string | ArrayBuffer) {
    const message = typeof frame === "string" ? parsed(frame) : unpacked(frame);
    if (message === undefined) return;
    this.inbox.push(message);
    this.flushing ??= setTimeout(() => this.flush(), FRAME);
  }

  /** Applies what came, in order, in one batch. */
  private flush() {
    clearTimeout(this.flushing);
    this.flushing = undefined;
    const messages = this.inbox;
    this.inbox = [];
    const told = new Set<Entry>();
    batch(() => {
      for (const message of messages) this.receive(message, told);
    });
    for (const entry of told) for (const listener of entry.listeners) listener();
  }

  private receive(message: Inbound, told: Set<Entry>) {
    switch (message.type) {
      case "unreadable":
        this.unreadable(message.id, message.message, told);
        return;
      case "welcome":
        this.heardZone(message.timeZone);
        this.welcomed(message.epoch);
        return;
      case "refused":
        this.refusedSignal.set(refusedBy(message.reason, message.protocol));
        this.statusSignal.set("refused");
        this.line?.close();
        return;
      case "data": {
        const entry = this.subs.get(message.id);
        if (entry === undefined) return;
        entry.held.data(message.value, message.seq);
        entry.unread = false;
        entry.epoch = this.epoch;
        entry.error.set(undefined);
        told.add(entry);
        return;
      }
      case "change": {
        const entry = this.subs.get(message.id);
        if (entry === undefined) return;
        this.changed(entry, message.seq, message.ops);
        told.add(entry);
        return;
      }
      case "result":
        this.answered(message.id, (call) => call.resolve(message.output));
        return;
      case "error":
        if (message.id === null || message.id === undefined) {
          // A message of this client the server could not read: a bug of the client.
          console.warn(`[store] the server could not read a message: ${message.message}`);
          return;
        }
        this.failed(message.id, new StoreError(message.code, message.message), told);
    }
  }

  private welcomed(epoch: string) {
    this.epoch = epoch;
    this.tries = 0;
    this.wasLive.set(true);
    this.statusSignal.set("live");
    for (const entry of this.entries.values()) {
      if (entry.refs > 0) this.subscribe(entry);
    }
  }

  private changed(
    entry: Entry,
    seq: number,
    ops: Extract<ServerMessage, { type: "change" }>["ops"],
  ) {
    const held = entry.held.seq;
    if (held === undefined || seq <= held) return;
    if (seq > held + 1) {
      // A gap: the changes between are asked for again.
      this.subscribe(entry);
    } else if (!entry.held.change(ops, seq)) {
      // The two sides differ: the whole value again.
      entry.held.seq = undefined;
      this.subscribe(entry);
    }
  }

  private answered(id: number, answer: (call: Waiting) => void) {
    const call = this.calls.get(id);
    if (call === undefined) return;
    this.calls.delete(id);
    answer(call);
  }

  private failed(id: number, error: StoreError, told: Set<Entry>) {
    if (this.calls.has(id)) {
      this.answered(id, (call) => call.reject(error));
      return;
    }
    const entry = this.subs.get(id);
    if (entry === undefined) return;
    this.subs.delete(id);
    entry.sub = undefined;
    entry.error.set(error);
    told.add(entry);
  }

  /**
   * A frame that could not be read: a call's fails. A subscription's stops on the server too, and
   * is asked for again whole, once, which heals a frame corrupted on its way; unreadable again
   * before a value came, the record fails with the frame's words.
   */
  private unreadable(id: number, words: string, told: Set<Entry>) {
    const entry = this.subs.get(id);
    if (entry === undefined) {
      this.failed(id, new StoreError("unreadable", words), told);
      return;
    }
    this.unsubscribe(entry);
    if (!entry.unread) {
      entry.unread = true;
      entry.held.seq = undefined;
      this.subscribe(entry);
      return;
    }
    entry.error.set(new StoreError("unreadable", words));
    told.add(entry);
  }

  /** Opens `entry`'s subscription under a new id: `resume` from what it holds, or `sub`. */
  private subscribe(entry: Entry) {
    this.unsubscribe(entry);
    const id = this.nextId++;
    entry.sub = id;
    this.subs.set(id, entry);
    const { args, name: record } = entry;
    const seq = entry.held.seq;
    if (seq !== undefined && entry.epoch !== undefined) {
      this.send({ args, epoch: entry.epoch, id, record, seq, type: "resume" });
    } else {
      this.send({ args, id, record, type: "sub" });
    }
  }

  private unsubscribe(entry: Entry) {
    if (entry.sub === undefined) return;
    this.subs.delete(entry.sub);
    if (this.statusSignal() === "live") this.send({ id: entry.sub, type: "unsub" });
    entry.sub = undefined;
  }

  private drop(entry: Entry) {
    if (entry.refs > 0) return;
    clearTimeout(entry.leaving);
    this.unsubscribe(entry);
    this.entries.delete(entry.key);
  }

  /** The line dropped: what it brought is applied, its ids end, and a new try is set. */
  private lost() {
    this.flush();
    this.line = undefined;
    for (const call of this.calls.values()) call.reject(dropped());
    this.calls.clear();
    this.subs.clear();
    for (const entry of this.entries.values()) {
      entry.sub = undefined;
      if (entry.refs === 0) this.drop(entry);
    }
    if (this.closed || this.statusSignal() === "refused") return;
    this.statusSignal.set("offline");
    const wait = WAITS[Math.min(this.tries, WAITS.length - 1)]!;
    this.tries += 1;
    this.retry = setTimeout(() => {
      this.retry = undefined;
      this.open();
    }, wait);
  }
}

/** A text frame's message, or none when it is not JSON. */
function parsed(text: string): ServerMessage | undefined {
  try {
    return JSON.parse(text) as ServerMessage;
  } catch {
    return undefined;
  }
}

/**
 * A binary frame's message, its large part inflated, or what fails in its place: the
 * subscription or the call its head names, or nothing when it names none.
 */
function unpacked(frame: ArrayBuffer): Inbound | undefined {
  const read = measured("inflate", frame.byteLength, () => unpackFrame(new Uint8Array(frame)));
  const text = read.text;
  if (text !== undefined && text !== null) {
    return measured("parse", text.length, () => parsed(text));
  }
  const problem = read.problem ?? "The server sent a frame this app cannot read.";
  if (read.id === undefined || read.id === null) {
    console.warn(`[store] ${problem}`);
    return undefined;
  }
  return { id: read.id, message: problem, type: "unreadable" };
}

/** A value as a text with its records' fields in order, so equal arguments name one record. */
export function canonical(value: JsonValue): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const fields = Object.keys(value)
    .filter((key) => value[key] !== undefined)
    .toSorted()
    .map((key) => `${JSON.stringify(key)}:${canonical(value[key]!)}`);
  return `{${fields.join(",")}}`;
}
