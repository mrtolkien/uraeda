// The first part of an extension's VM: how its code asks the server for an operation, and how
// what it throws is told. Each part of `api/` is a module whose default export gets the host,
// the natives the server gives the VM, and the parts made before it: see `../vm/machine.rs`.

let host;

/** Asks the server for one operation: its answer, or what it throws. */
function ask(op, payload) {
  return JSON.parse(host.call(op, JSON.stringify(payload === undefined ? null : payload)));
}

function messageOf(error) {
  if (error instanceof Error) {
    return error.message;
  }
  return typeof error === "string" ? error : String(error);
}

function stackOf(error) {
  return error instanceof Error && error.stack ? String(error.stack) : "";
}

/** Turns the extension off: what it threw where nothing of Uraeda's waits for an answer. */
function fail(error) {
  ask("fail", { message: messageOf(error), stack: stackOf(error) });
}

/** Prints a failure that turns nothing off, under the extension's name. */
function report(where, error) {
  ask("log", { message: `${where}: ${messageOf(error)}` });
}

/** Calls `run`: what it throws, or rejects with, goes to `failed`. */
function guarded(run, failed) {
  try {
    const result = run();
    if (result && typeof result.then === "function") {
      Promise.resolve(result).catch(failed);
    }
  } catch (error) {
    failed(error);
  }
}

export default function guard(given) {
  host = given;
  return { ask, fail, guarded, messageOf, report };
}
