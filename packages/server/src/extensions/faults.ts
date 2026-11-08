// What an extension's code throws after it loaded, kept to that extension: the timers its module
// code sees catch their callbacks' throws and are cleared when its version unloads, and a backstop
// on the process takes an uncaught exception or unhandled rejection whose stack names an
// extension's folder, so the server keeps running.
import { inspect } from "node:util";
import type { Scope } from "./scope.ts";

type Callback = (...args: Array<unknown>) => void;

/** A timer's handle, and how it is cleared. */
type Handle = { clear: (handle: never) => void; handle: unknown };

/** The callback `fn` with `args`, run only while the scope is live, its throw given to `fail`. */
function guarded(scope: Scope, fail: (error: unknown) => void, fn: unknown, args: Array<unknown>) {
  if (typeof fn !== "function") {
    throw new TypeError(`The "callback" argument must be of type function. Received ${typeof fn}`);
  }
  return () => {
    if (!scope.isLive()) {
      return;
    }
    try {
      (fn as Callback)(...args);
    } catch (error) {
      fail(error);
    }
  };
}

/**
 * The timer functions one version's module code sees in place of the globals: `setTimeout`,
 * `setInterval`, `setImmediate`, `queueMicrotask`, and their `clear*`. A callback that throws gives
 * its error to `fail`; every timer still pending is cleared when the scope unloads.
 */
export function scopedTimers(
  scope: Scope,
  fail: (error: unknown) => void,
): Record<string, unknown> {
  const pending = new Map<unknown, Handle>();
  scope.add(() => {
    for (const { clear, handle } of pending.values()) {
      clear(handle as never);
    }
    pending.clear();
  });
  const keep = <T>(handle: T, clear: (handle: T) => void): T => {
    pending.set(handle, { clear: clear as Handle["clear"], handle });
    return handle;
  };
  const forget = (clear: (handle: never) => void) => (handle: unknown) => {
    pending.delete(handle);
    clear(handle as never);
  };
  return {
    clearImmediate: forget(clearImmediate),
    clearInterval: forget(clearInterval),
    clearTimeout: forget(clearTimeout),
    queueMicrotask: (fn: unknown) => {
      scope.check();
      queueMicrotask(guarded(scope, fail, fn, []));
    },
    setImmediate: (fn: unknown, ...args: Array<unknown>) => {
      scope.check();
      const run = guarded(scope, fail, fn, args);
      const handle: NodeJS.Immediate = setImmediate(() => {
        pending.delete(handle);
        run();
      });
      return keep(handle, clearImmediate);
    },
    setInterval: (fn: unknown, ms?: number, ...args: Array<unknown>) => {
      scope.check();
      return keep(setInterval(guarded(scope, fail, fn, args), ms), clearInterval);
    },
    setTimeout: (fn: unknown, ms?: number, ...args: Array<unknown>) => {
      scope.check();
      const run = guarded(scope, fail, fn, args);
      const handle: NodeJS.Timeout = setTimeout(() => {
        pending.delete(handle);
        run();
      }, ms);
      return keep(handle, clearTimeout);
    },
  };
}

/** Takes an error the process did not handle when it is an extension's: true when it took it. */
export type FaultOwner = (error: unknown) => boolean;

type Fault = "uncaughtException" | "unhandledRejection";

const owners = new Set<FaultOwner>();

/**
 * The process's handler of `event`: the error goes to the first owner that takes it; else, with no
 * other listener to handle it, it is printed and the process exits with code 1, as Node does.
 */
function handler(event: Fault) {
  return (error: unknown) => {
    for (const owner of owners) {
      if (owner(error)) {
        return;
      }
    }
    if (process.listenerCount(event) > 1) {
      return;
    }
    process.stderr.write(`${inspect(error)}\n`);
    process.exit(1);
  };
}

const handlers: Record<Fault, (error: unknown) => void> = {
  uncaughtException: handler("uncaughtException"),
  unhandledRejection: handler("unhandledRejection"),
};

/**
 * Gives `owner` the uncaught exceptions and unhandled rejections of the process, the handlers
 * installed once for every owner; the function returned removes it, and the handlers with the last.
 */
export function backstop(owner: FaultOwner): () => void {
  if (owners.size === 0) {
    for (const [event, listener] of Object.entries(handlers)) {
      process.on(event, listener);
    }
  }
  owners.add(owner);
  return () => {
    if (owners.delete(owner) && owners.size === 0) {
      for (const [event, listener] of Object.entries(handlers)) {
        process.off(event, listener);
      }
    }
  };
}
