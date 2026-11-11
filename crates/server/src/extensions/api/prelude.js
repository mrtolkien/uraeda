// The last part of an extension's VM: the server API its activation gets, what it registered
// through it, the loading of its compiled files, and `dispatch`, the one function the server
// calls into the VM through. `server.d.ts` declares what an extension sees of it.

let host;
let name;
let ask;
let guarded;
let messageOf;
let report;
let web;
let shared;

// The server API, and what the extension registered through it.

const records = new Map();
const actions = new Map();
const routes = [];
const listeners = new Map();
let registered;

const NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const EVENTS = ["commit-landed", "session-started", "step-reached", "turn-ended"];
const METHODS = [undefined, "GET", "POST"];

function checkName(what, value) {
  if (typeof value !== "string" || !NAME.test(value)) {
    const given = JSON.stringify(value);
    throw new Error(`${name}: ${what} name ${given} must be letters, digits, ., _, or -`);
  }
}

function checkFunction(what, value) {
  if (typeof value !== "function") {
    throw new TypeError(`${name}: ${what} must be a function`);
  }
}

/** Adds a named record or action, refusing a name taken. */
function add(map, what, key, value) {
  checkName(`${what === "action" ? "an" : "a"} ${what}'s`, key);
  checkFunction(`the ${what} ${key}`, value);
  if (map.has(key)) {
    throw new Error(`${name}: the ${what} ${key} is registered already`);
  }
  map.set(key, value);
}

const api = {
  action(key, run) {
    add(actions, "action", key, run);
  },
  log(message) {
    ask("log", { message: String(message) });
  },
  on(event, handler) {
    if (!EVENTS.includes(event)) {
      throw new Error(`${name}: no event is named ${JSON.stringify(event)}`);
    }
    checkFunction(`the handler of ${event}`, handler);
    ask("listen", { event });
    listeners.set(event, [...(listeners.get(event) ?? []), handler]);
  },
  record(key, read) {
    add(records, "record", key, read);
    return {
      changed: (repository) => void ask("changed", { record: key, repository: repository ?? null }),
    };
  },
  repositories() {
    return ask("repositories");
  },
  route(path, handler, method) {
    if (typeof path !== "string" || !path.startsWith(`/x/${name}/`)) {
      throw new Error(`${name}: routes must be under /x/${name}/`);
    }
    checkFunction(`the route ${path}`, handler);
    if (!METHODS.includes(method)) {
      throw new Error(`${name}: a route's method is "GET" or "POST"`);
    }
    routes.push({ handler, method, path });
  },
  runtime(value) {
    if (registered) {
      throw new Error(`${name}: a runtime is registered already`);
    }
    for (const method of ["allowRule", "hasSession", "open", "version"]) {
      checkFunction(`the runtime's ${method}`, value?.[method]);
    }
    ask("runtime", {
      capabilities: value.capabilities,
      icon: String(value.icon ?? ""),
      kind: String(value.kind ?? name),
      models: typeof value.models === "function",
      name: String(value.name ?? name),
      review: typeof value.reviewMessage === "function",
      accounts: typeof value.accounts === "object" && value.accounts !== null,
    });
    registered = value;
  },
  settings(repository) {
    return ask("settings", { repository: repository ?? null });
  },
};

// Loading: each compiled file is a function of `(__import, __exports)`, run once.

const ASYNC_ACTIVATION =
  "activation must be synchronous: start async work from a callback, not while loading";

/** Runs the entry's files, each once, and calls its default export with the server API. */
function activate({ entry, files }) {
  const functions = new Map();
  for (const [file, { code }] of Object.entries(files)) {
    functions.set(file, host.compile(code, `${name}/${file}`));
  }
  const loaded = new Map();
  const load = (file) => {
    if (loaded.has(file)) {
      return loaded.get(file);
    }
    const exports = {};
    loaded.set(file, exports);
    const { resolved } = files[file];
    functions.get(file)((specifier) => {
      const target = Object.hasOwn(resolved, specifier) ? resolved[specifier] : undefined;
      if (target === undefined) {
        return undefined;
      }
      return target.file === undefined ? shared[target.module] : load(target.file);
    }, exports);
    return exports;
  };
  const entered = load(entry).default;
  if (typeof entered !== "function") {
    throw new Error(`${entry} does not export a default function`);
  }
  const result = entered(api);
  if (result && typeof result.then === "function") {
    // Its rejection is this error's to report.
    Promise.resolve(result).catch(() => undefined);
    throw new Error(ASYNC_ACTIVATION);
  }
}

// Calls: what the server asks of the extension, each answered once through `reply`.

function reply(id, ok, value) {
  let json;
  try {
    const answered = ok
      ? { id, ok, value: value === undefined ? null : value }
      : { error: messageOf(value), id, ok };
    json = JSON.stringify(answered);
  } catch (error) {
    const unsent = `the answer is not JSON: ${messageOf(error)}`;
    json = JSON.stringify({ error: unsent, id, ok: false });
  }
  host.call("reply", json);
}

/** Answers the call `id` with what `run` gives, or resolves to, or throws. */
function answer(id, run) {
  let result;
  try {
    result = run();
  } catch (error) {
    reply(id, false, error);
    return;
  }
  if (result && typeof result.then === "function") {
    Promise.resolve(result).then(
      (value) => reply(id, true, value),
      (error) => reply(id, false, error),
    );
  } else {
    reply(id, true, result);
  }
}

/** Whether `route` answers `path` with `method`, as the server's own routes would. */
function matches(route, path, method) {
  const wanted = method === "HEAD" ? "GET" : method;
  if (route.method === undefined ? !["GET", "POST"].includes(wanted) : route.method !== wanted) {
    return false;
  }
  const trimmed = path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
  if (route.path.endsWith("/*")) {
    const prefix = route.path.slice(0, -2);
    return trimmed === prefix || trimmed.startsWith(`${prefix}/`);
  }
  return trimmed === route.path;
}

function named(map, what, key) {
  const found = map.get(key);
  if (!found) {
    throw new Error(`${name} has no ${what} ${key}`);
  }
  return found;
}

// A runtime's processes, by the id the server opened each with.

const opened = new Map();

/** Opens a process of the runtime, and hands each of its events to the server. */
function open(id, options) {
  const process = registered.open(options);
  opened.set(id, process);
  const emit = (event) => ask("emit", { event, process: id });
  const pump = async () => {
    for await (const event of process.events) {
      emit(event);
    }
  };
  pump()
    .catch((error) => emit({ code: null, stderr: messageOf(error), type: "exit" }))
    .finally(() => {
      opened.delete(id);
      ask("emit.end", { process: id });
    });
  return { setEffort: typeof process.setEffort === "function" };
}

const told = {
  close: (process) => process.close(),
  interrupt: (process) => process.interrupt(),
  kill: (process, { signal }) => process.kill(signal),
  send: (process, { message }) => process.send(message),
  setEffort: (process, { effort }) => process.setEffort?.(effort ?? undefined),
  takeBack: (process, { message }) => process.takeBack(message),
};

/** Answers a request with the route that matches it: null when none does. */
function routed({ repository, request }) {
  const route = routes.find((one) => matches(one, request.path, request.method));
  if (!route) {
    return null;
  }
  const result = route.handler(new web.Request(request), repository);
  return result && typeof result.then === "function" ? result.then(web.sent) : web.sent(result);
}

const asked = {
  action: ({ input, name: key, repository }) => named(actions, "action", key)(input, repository),
  "process.tell": ({ process, tell, ...rest }) => {
    const found = opened.get(process);
    if (found) {
      told[tell](found, rest);
    }
  },
  record: ({ name: key, repository }) => named(records, "record", key)(repository),
  route: routed,
  "runtime.allowRule": ({ denial }) => registered.allowRule(denial) ?? null,
  "runtime.accounts.list": () => registered.accounts.list(),
  "runtime.accounts.nameOf": ({ account }) => String(registered.accounts.nameOf(account)),
  "runtime.accounts.problems": () => registered.accounts.problems(),
  "runtime.accounts.refresh": ({ maxAgeMs }) =>
    Promise.resolve(registered.accounts.refresh(maxAgeMs)).then(() => null),
  "runtime.hasSession": ({ account, nativeId }) =>
    Boolean(registered.hasSession(nativeId, account ?? undefined)),
  "runtime.models": () => registered.models(),
  "runtime.open": ({ options, process }) => open(process, options),
  "runtime.reviewMessage": ({ ask: review }) => registered.reviewMessage(review) ?? null,
  "runtime.version": () => Promise.resolve(registered.version()).then((version) => version ?? null),
};

/** An event of a repository: each handler's throw is printed, and stops no other. */
function happened({ event, payload }) {
  for (const handler of listeners.get(event) ?? []) {
    guarded(
      () => handler(payload),
      (error) => report(event, error),
    );
  }
}

/** A call of the server's: answered through `reply`, or not at all without an `id`. */
function called({ id, what, ...rest }) {
  if (id === null) {
    guarded(
      () => asked[what](rest),
      (error) => report(what, error),
    );
  } else {
    answer(id, () => asked[what](rest));
  }
}

export default function prelude(given, parts) {
  host = given;
  ({ name } = given);
  ({ ask, guarded, messageOf, report } = parts.guard);
  ({ web } = parts);
  ({ shared } = parts.modules);
  const dispatched = {
    activate,
    call: called,
    event: happened,
    "fetch.done": web.fetched,
    "process.exit": parts.modules.processExit,
    "process.line": parts.modules.processLine,
    timer: parts.modules.fired,
  };
  return { dispatch: (kind, json) => void dispatched[kind](JSON.parse(json)) };
}
