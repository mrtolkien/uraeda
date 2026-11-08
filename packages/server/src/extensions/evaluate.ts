// The module runner of the server: each compiled file of a graph becomes a fresh function, from
// `vm.compileFunction`, and the modules and the entry's activation run synchronously inside one
// `vm.Script` with a timeout. Nothing is cached between versions, so an unloaded version's
// functions are freed with its scope, which Node's `import()` never does.
import { join } from "node:path";
import { compileFunction, Script } from "node:vm";
import type { Graph, Problem, Target } from "./graph.ts";

/** How long an extension's modules and its activation may run before they are stopped. */
export const EVALUATION_MS = 2000;

/** The global key the script calls through: a symbol, so no extension's name can clash. */
const RUN = Symbol.for("uraeda.extensions.run");

/** The one script every evaluation runs: it calls the function the evaluation set at `RUN`. */
const SCRIPT = new Script(`globalThis[Symbol.for("uraeda.extensions.run")]();`, {
  filename: "uraeda:extensions/evaluate",
});

type ModuleFunction = (load: (specifier: string) => unknown, exports: object) => void;

type Running = typeof globalThis & { [RUN]?: () => void };

/** What `evaluate` takes besides the graph. */
export type EvaluateOptions = {
  /** The server API this version's activation gets. */
  api: object;
  /** The names module code sees in place of the globals', like its scoped `setTimeout`. */
  globals?: Record<string, unknown>;
  /** The modules extensions import by name, like `react`. */
  shared: Record<string, unknown>;
};

/** The value the import `target` leads to, a file of the graph loaded through `load`. */
function imported(
  target: Target,
  load: (file: string) => object,
  shared: EvaluateOptions["shared"],
) {
  if ("file" in target) {
    return load(target.file);
  }
  if (Object.hasOwn(shared, target.module)) {
    return shared[target.module];
  }
  return process.getBuiltinModule(target.module);
}

/**
 * Why an activation that returns a promise is refused: the timeout stops synchronous code only,
 * never the promise jobs after it, so a loop after an `await` would hang the server.
 */
const ASYNC_ACTIVATION =
  "activation must be synchronous: start async work from a callback, not while loading";

/**
 * Runs the graph's modules, each once, from its entry, and calls the entry's default export with
 * `api`, all inside one script stopped after `EVALUATION_MS`. Throws what a module or the
 * activation threw, the timeout's error, or, when the activation returned a promise, that it must
 * be synchronous.
 */
export function evaluate(graph: Graph, { api, globals = {}, shared }: EvaluateOptions): void {
  const functions = new Map<string, ModuleFunction>();
  for (const [file, { code }] of graph.files) {
    const filename = join(graph.folder, file);
    // A context extension, with no prototype so it resolves only `globals`' names: V8 keeps
    // every function it compiles without one in its compilation cache, freed only near the
    // heap's limit, which grew the heap by 0.6 MB for each reload of a 200 KB file.
    const contextExtensions = [Object.assign(Object.create(null) as object, globals)];
    const compiled = compileFunction(code, ["__import", "__exports"], {
      contextExtensions,
      filename,
    });
    functions.set(file, compiled as ModuleFunction);
  }
  const loaded = new Map<string, object>();
  const load = (file: string): object => {
    const done = loaded.get(file);
    if (done) {
      return done;
    }
    const exports = {};
    loaded.set(file, exports);
    const resolved = graph.files.get(file)?.resolved ?? new Map<string, Target>();
    functions.get(file)?.((specifier) => {
      const target = resolved.get(specifier);
      return target && imported(target, load, shared);
    }, exports);
    return exports;
  };
  let result: unknown;
  const running = globalThis as Running;
  running[RUN] = () => {
    const activate = (load(graph.entry) as { default?: unknown }).default;
    if (typeof activate !== "function") {
      throw new Error(`${graph.entry} does not export a default function`);
    }
    result = activate(api);
  };
  try {
    SCRIPT.runInThisContext({ timeout: EVALUATION_MS });
  } finally {
    delete running[RUN];
  }
  if (typeof (result as { then?: unknown } | null)?.then === "function") {
    // Its rejection is this error's to report, not the process's.
    Promise.resolve(result).catch(() => undefined);
    throw new Error(ASYNC_ACTIVATION);
  }
}

/**
 * The problem `error` is, thrown by an extension's code: in the file of the extension's folder
 * its stack names first, else in the entry. No line: the compiled code's lines are not the
 * source's.
 */
export function failure(error: unknown, graph: Pick<Graph, "entry" | "folder">): Problem {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? (error.stack ?? "") : "";
  const at = stack.indexOf(`${graph.folder}/`);
  const file =
    at === -1
      ? graph.entry
      : (stack.slice(at + graph.folder.length + 1).match(/^[^:\s)]+/)?.[0] ?? graph.entry);
  return { file, message };
}
