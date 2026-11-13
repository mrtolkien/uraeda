// Actions, typed from the protocol's catalogue: a call gives the action's output, or rejects with a
// `StoreError` whose message a screen shows under the control that made it (`sent`).
import type { Connection } from "./connection";
import { offline } from "./errors";
import type { JsonValue } from "./protocol";
import type { ActionName, Input, Output } from "./records";

/** Runs `name` with `input` on `connection`: with none, or no live line, it fails at once. */
export function run<A extends ActionName>(
  connection: Connection | undefined,
  name: A,
  input: Input<A>,
): Promise<Output<A>> {
  if (connection === undefined) return Promise.reject(offline());
  return connection.call(name, input as JsonValue) as Promise<Output<A>>;
}
