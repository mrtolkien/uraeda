// What an extension's code reaches beside the server API: its console, its timers, and the
// modules it imports by name, `uraeda:fs` and `uraeda:process`. Everything it starts here is
// its VM's own, and gone with it.

let host;
let ask;
let fail;
let guarded;
let bytesOf;

// The console: each line goes to the server's output, after the extension's name.

function shown(value) {
  if (typeof value === "string") {
    return value;
  }
  if (value instanceof Error) {
    return value.stack ? `${value.message}\n${value.stack}` : value.message;
  }
  try {
    const json = JSON.stringify(value);
    return json === undefined ? String(value) : json;
  } catch {
    return String(value);
  }
}

function print(...values) {
  ask("log", { message: values.map(shown).join(" ") });
}

// Timers. A callback that throws turns the extension off.

const timers = new Map();
let nextTimer = 1;

/** `setTimeout`, or `setInterval` when it fires `every` time. */
function timer(every) {
  return (callback, ms, ...args) => {
    if (typeof callback !== "function") {
      throw new TypeError("a timer's callback must be a function");
    }
    const id = nextTimer++;
    timers.set(id, { args, callback, every });
    ask("timer.set", { every, id, ms: Math.max(0, Number(ms) || 0) });
    return id;
  };
}

function clearTimer(id) {
  if (timers.delete(id)) {
    ask("timer.clear", { id });
  }
}

function queueMicrotask(callback) {
  if (typeof callback !== "function") {
    throw new TypeError("a microtask's callback must be a function");
  }
  Promise.resolve().then(() => guarded(callback, fail));
}

/** A timer is due. */
function fired({ id }) {
  const held = timers.get(id);
  if (!held) {
    return;
  }
  if (!held.every) {
    timers.delete(id);
  }
  guarded(() => held.callback(...held.args), fail);
}

// `uraeda:process`: commands the server runs for the extension, ended with it.

const processes = new Map();
let nextProcess = 1;

function spawn(command, args = [], options = {}) {
  const id = nextProcess++;
  const waiting = [];
  let onLine;
  let exit;
  const exited = new Promise((resolve) => {
    exit = resolve;
  });
  const { pid } = ask("process.spawn", {
    args: args.map(String),
    command: String(command),
    cwd: options.cwd ?? null,
    env: options.env ?? {},
    id,
  });
  processes.set(id, {
    exit,
    line: (line) => (onLine ? guarded(() => onLine(line), fail) : waiting.push(line)),
  });
  return {
    endInput: () => void ask("process.end", { id }),
    exited,
    kill: (signal = "SIGTERM") => void ask("process.kill", { id, signal }),
    onLine(handler) {
      onLine = handler;
      for (const line of waiting.splice(0)) {
        guarded(() => handler(line), fail);
      }
    },
    pid,
    write: (value) => void ask("process.write", { id, value: value === undefined ? null : value }),
  };
}

async function run(command, args = [], options = {}) {
  const child = spawn(command, args, options);
  const lines = [];
  child.onLine((line) => lines.push(line));
  child.endInput();
  return { ...(await child.exited), lines };
}

function processLine({ id, line }) {
  processes.get(id)?.line(line);
}

function processExit({ id, ...exit }) {
  processes.get(id)?.exit(exit);
  processes.delete(id);
}

// `uraeda:fs`: the owner's files, read and written whole, on the extension's own thread.

const fs = {
  appendText: (path, text) => void ask("fs.appendText", { path, text: String(text) }),
  exists: (path) => ask("fs.stat", { path }) !== null,
  join: (...parts) => ask("fs.join", { parts }),
  list: (path) => ask("fs.list", { path }),
  makeFolder: (path) => void ask("fs.makeFolder", { path }),
  name: (path) => ask("fs.name", { path }),
  parent: (path) => ask("fs.parent", { path }),
  readBytes: (path) => host.fromBase64(ask("fs.readBytes", { path })),
  readText: (path) => ask("fs.readText", { path }),
  relative: (from, to) => ask("fs.relative", { from, to }),
  remove: (path) => void ask("fs.remove", { path }),
  rename: (from, to) => void ask("fs.rename", { from, to }),
  stat: (path) => ask("fs.stat", { path }),
  writeBytes: (path, bytes) =>
    void ask("fs.writeBytes", { bytes: host.toBase64(bytesOf(bytes)), path }),
  writeText: (path, text) => void ask("fs.writeText", { path, text: String(text) }),
};

/** A module's namespace: its names, and itself as its default. */
function moduleOf(members) {
  return Object.freeze({ ...members, default: Object.freeze(members) });
}

export default function modules(given, parts) {
  host = given;
  ({ ask, fail, guarded } = parts.guard);
  ({ bytesOf } = parts.web);
  Object.assign(globalThis, {
    clearInterval: clearTimer,
    clearTimeout: clearTimer,
    console: { debug: print, error: print, info: print, log: print, warn: print },
    queueMicrotask,
    setInterval: timer(true),
    setTimeout: timer(false),
  });
  const shared = {
    "uraeda:fs": moduleOf(fs),
    "uraeda:process": moduleOf({ run, spawn }),
    "uraeda/server": Object.freeze({}),
  };
  return { fired, processExit, processLine, shared };
}
