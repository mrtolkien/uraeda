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
 * Runs the graph's modules, each once, from its entry, and calls the entry's default export with
 * `api`, all inside one script stopped after `EVALUATION_MS`; returns what the activation
 * returned. Throws what a module or the activation threw, or the timeout's error.
 */
export function evaluate(graph: Graph, { api, shared }: EvaluateOptions): unknown {
  const functions = new Map<string, ModuleFunction>();
  for (const [file, { code }] of graph.files) {
    const filename = join(graph.folder, file);
    // An empty context extension, with no prototype so it resolves no name: V8 keeps every
    // function it compiles without one in its compilation cache, freed only near the heap's
    // limit, which grew the heap by 0.6 MB for each reload of a 200 KB file.
    const contextExtensions = [Object.create(null) as object];
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
  return result;
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

/** Waits for what the activation returned, when it is a promise, at most `EVALUATION_MS`. */
export async function settled(result: unknown): Promise<void> {
  if (typeof (result as { then?: unknown } | null)?.then !== "function") {
    return;
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`activation did not finish within ${EVALUATION_MS} ms`)),
      EVALUATION_MS,
    );
  });
  try {
    await Promise.race([result, late]);
  } finally {
    clearTimeout(timer);
  }
}
