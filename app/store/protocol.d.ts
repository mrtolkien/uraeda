// The protocol between Uraeda's server and its clients, as a client reads it.
// Written by `vp run protocol:types` from `crates/protocol/`: never by hand.

/** The protocol's version, which a client's `hello` gives. */
export type Protocol = 1;

/**
 * What a client sends.
 *
 * A `sub`, a `call`, and a `resume` carry an `id` the client picks, unique among the
 * subscriptions and the calls it has open on the connection: every answer names it.
 */
export type ClientMessage = { "type": "hello", protocol: number, signIn: SignIn, } | { "type": "sub", id: number, record: string, args: JsonValue, } | { "type": "unsub", id: number, } | { "type": "call", id: number, action: string, input: JsonValue, } | { "type": "resume", id: number, record: string, args: JsonValue, epoch: string, seq: number, };

/**
 * A paired device.
 */
export type Device = { 
/**
 * What names the device: the part of its token before the dot, which is no secret.
 */
id: string, 
/**
 * The name it gave as it paired, or the owner gave it since.
 */
name: string, 
/**
 * When it paired, in RFC 3339, as `2026-11-10T09:00:00Z`.
 */
created: string, 
/**
 * The day it last signed in, in RFC 3339: a use is recorded once a day at most.
 */
used: string, };

/**
 * The devices paired with the server, each signing in with a token of its own.
 */
export type Devices = { 
/**
 * The oldest pairing first.
 */
devices: Array<Device>, };

/**
 * Renames a device.
 */
export type DevicesRename = { 
/**
 * The device's `id`.
 */
id: string, 
/**
 * Its new name: the blanks around it go, and it holds a letter at least.
 */
name: string, };

/**
 * Revokes a device: its token signs in nowhere any more, and its open connections close.
 */
export type DevicesRevoke = { 
/**
 * The device's `id`.
 */
id: string, };

/**
 * What an `error` is about.
 */
export type ErrorCode = "not-signed-in" | "bad-message" | "unknown-record" | "unknown-action" | "bad-args" | "bad-input" | "refused" | "conflict" | "hook" | "internal";

export type JsonValue = number | string | boolean | Array<JsonValue> | { [key in string]: JsonValue } | null;

/**
 * One operation of a change.
 *
 * A list takes `insert`, `remove`, and `move` only when each of its items is a record with an
 * `id`, a text no other item of the list has: any other list changes whole, by `set`.
 */
export type Op = { "op": "set", path: Array<string>, value: JsonValue, } | { "op": "append", path: Array<string>, text: string, } | { "op": "insert", path: Array<string>, value: JsonValue, before?: string | null, } | { "op": "remove", path: Array<string>, } | { "op": "move", path: Array<string>, before?: string | null, };

/**
 * Why a server turns a `hello` down.
 */
export type Refusal = "client-too-old" | "server-too-old" | "not-signed-in";

/**
 * What a server sends.
 */
export type ServerMessage = { "type": "welcome", protocol: number, epoch: string, } | { "type": "refused", reason: Refusal, protocol: number, } | { "type": "data", id: number, seq: number, value: JsonValue, } | { "type": "change", id: number, seq: number, ops: Array<Op>, } | { "type": "result", id: number, output: JsonValue, } | { "type": "error", id?: number | null, code: ErrorCode, message: string, };

/**
 * How a client signs in.
 */
export type SignIn = { "by": "cookie" } | { "by": "token", "token": string };

/** Every record, by the name a `sub` gives: its arguments, and its whole value. */
export type Records = {
  Devices: { args: null; value: Devices };
};

/** Every action, by the name a `call` gives: its input, and its output. */
export type Actions = {
  "devices.rename": { input: DevicesRename; output: null };
  "devices.revoke": { input: DevicesRevoke; output: null };
};
