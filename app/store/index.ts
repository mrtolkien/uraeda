// The client store, `app/store`: what every screen reads its data through. A screen imports from
// here only; `app/store/README.md` says how to read a record, a list, and a growing text, and how
// to call an action and show its refusal.
import type { ExtensionHost } from "../extensions/host";
import { settledWhen } from "../ui/timing";
import { run } from "./actions";
import { type ConnectOptions, Connection } from "./connection";
import { offline } from "./errors";
import type { ActionName, Args, Input, Live, Output, RecordName, Value } from "./records";
import { read, watch } from "./records";
import { setServerZone } from "./time";

export { GRACE, PROTOCOL, WAITS } from "./connection";
export type { ConnectOptions, Connection, Status } from "./connection";
export { StoreError } from "./errors";
export type { Refused, StoreErrorCode } from "./errors";
export type { ListView, RowOf } from "./held";
export type { Heard, Line, Opener } from "./line";
export { list, onUnheldRead, RecordsRoot, rootDrawn, text } from "./records";
export type {
  ActionName,
  Args,
  Input,
  ItemOf,
  ListKey,
  Live,
  Output,
  RecordName,
  Value,
} from "./records";
export * from "./device";
export * from "./history";
export * from "./images";
export * from "./routes";
export * from "./time";

let current: Connection | undefined;

/**
 * Connects the app to the server at `address`, signed in by `signIn`, and makes it the one every
 * `record` and `call` uses, closing the one before: views made under that one keep it, so the
 * shell draws its screens again under a new connection.
 */
export function connect(options: ConnectOptions): Connection {
  current?.close();
  const made = new Connection(options, setServerZone);
  current = made;
  settledWhen(() => made.status() === "live" && made.waiting() === 0);
  return made;
}

/** The app's connection, once `connect` made one. */
export function connection(): Connection | undefined {
  return current;
}

/**
 * The record `name` with `args`, subscribed while the component, effect, or computation that
 * called this is there, and a few seconds after.
 */
export function record<N extends RecordName>(name: N, args: Args<N>): Live<Value<N>> {
  if (current === undefined) throw new Error("`connect` the app before reading a record");
  return read(current, name, args);
}

/** Runs the action `name`: its output, or a `StoreError` to show under the control that made it. */
export function call<A extends ActionName>(name: A, input: Input<A>): Promise<Output<A>> {
  return run(current, name, input);
}

/** What an extension's page gets of the app's connection (`app/extensions/host.tsx`). */
export function extensionHost(): ExtensionHost {
  return {
    call: (name, input) => run(current, name, input),
    read: (name, args, seen) => {
      if (current === undefined) {
        seen({ error: offline().message, value: undefined });
        return () => {};
      }
      return watch(current, name, args, (value, error) => seen({ error: error?.message, value }));
    },
    server: () => ({
      address: current?.address ?? "",
      token: current?.signIn.by === "token" ? current.signIn.token : undefined,
    }),
  };
}
