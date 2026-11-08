// The files of one entry of an extension, compiled: the entry and every file it imports, by a
// relative path that must stay inside the extension's folder. A path out of it, by `..` or by a
// symbolic link in the folder, is a problem: the loader reads only the folder the config folder
// names, never a path an extension's own files name.
import { readFileSync, realpathSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";

/** A problem of an extension: the file it is in, relative to its folder, and its line. */
export type Problem = { file: string; line?: number; message: string };

/** Where an import leads: a file of the graph, by its relative path, or a module by its name. */
export type Target = { file: string } | { module: string };

/** One compiled file: the body of `(__import, __exports)`, its imports resolved, and its CSS. */
export type GraphFile = { code: string; css: string; resolved: Map<string, Target> };

/** An entry's files, the entry first, then each in the order first imported. */
export type Graph = { entry: string; files: Map<string, GraphFile>; folder: string };

/** Compiles one page file with StyleX and React Compiler: TSX still, and its CSS. */
export type PageCompiler = (
  source: string,
  filename: string,
) => { code: string; css: string } | { error: { column: number; line: number; message: string } };

/** The core's compiler: one file into the body of `(__import, __exports)`, or its error. */
type ModuleCompiler = (
  source: string,
  filename: string,
) => {
  code: string;
  error: { column: number; line: number; message: string } | null;
  imports: Array<string>;
};

/** A version's compiled files: its server graph, and its page files by path with their CSS. */
export type Version = {
  page?: { css: string; entry: string; modules: Record<string, string> };
  server?: Graph;
};

/** What compiling one file gives: its code, imports, and CSS, or why it does not compile. */
export type Compiled =
  | { code: string; css: string; imports: ReadonlyArray<string> }
  | { error: { column: number; line: number; message: string } };

/** What `compileGraph` takes. */
export type GraphOptions = {
  /** Compiles one file's source, `filename` its absolute path. */
  compile: (source: string, filename: string) => Compiled;
  /** The entry, absolute, inside `folder`. */
  entry: string;
  /** The extension's folder, absolute, its symbolic links resolved. */
  folder: string;
  /** Why the bare specifier cannot be imported, or null when it can. */
  refuse: (specifier: string) => string | null;
};

/** The endings a relative import without one is tried with, in order. */
const ENDINGS = [".ts", ".tsx", "/index.ts", "/index.tsx"];

/** Whether `path` is a file. */
function isFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

/** The path of `path` inside `folder`, with `/` between its parts, or null when outside it. */
function inside(folder: string, path: string): string | null {
  const rest = relative(folder, path);
  if (rest === "" || rest.startsWith("..") || resolve(folder, rest) !== path) {
    return null;
  }
  return rest.split(sep).join("/");
}

/**
 * The file of the folder the relative import `specifier` of the file `from` names: tried as
 * written when it ends in `.ts` or `.tsx`, else with each of `ENDINGS`. A file out of the folder,
 * once its links are resolved, is refused.
 */
function resolveFile(folder: string, from: string, specifier: string): Target | string {
  const base = resolve(dirname(from), specifier);
  const leaves = `"${specifier}" leaves the extension's folder`;
  if (inside(folder, base) === null && base !== folder) {
    return leaves;
  }
  const candidates = /\.tsx?$/.test(specifier) ? [base] : ENDINGS.map((ending) => base + ending);
  const found = candidates.find(isFile);
  if (found !== undefined) {
    const file = inside(folder, realpathSync(found));
    return file === null ? leaves : { file };
  }
  const tried = /\.tsx?$/.test(specifier) ? "" : `, with .ts, .tsx, or /index.ts`;
  return `"${specifier}" is not a file of the extension${tried}`;
}

/** Where the import `specifier` of the file `from` leads, or why it cannot be imported. */
function target(options: GraphOptions, from: string, specifier: string): Target | string {
  if (specifier.startsWith("./") || specifier.startsWith("../")) {
    return resolveFile(options.folder, from, specifier);
  }
  if (specifier.startsWith("/") || specifier === "." || specifier === "..") {
    return `"${specifier}" is not a relative path, like "./lib/view"`;
  }
  return options.refuse(specifier) ?? { module: specifier };
}

/** Reads and compiles the file `file` of the folder, its imports resolved, or its problems. */
function compileFile(options: GraphOptions, file: string): GraphFile | Array<Problem> {
  const path = join(options.folder, file);
  let source: string;
  try {
    source = readFileSync(path, "utf8");
  } catch (error) {
    return [{ file, message: `cannot be read: ${(error as NodeJS.ErrnoException).code ?? error}` }];
  }
  const compiled = options.compile(source, path);
  if ("error" in compiled) {
    return [{ file, line: compiled.error.line, message: compiled.error.message }];
  }
  const problems: Array<Problem> = [];
  const resolved = new Map<string, Target>();
  for (const specifier of compiled.imports) {
    const found = target(options, path, specifier);
    if (typeof found === "string") {
      problems.push({ file, message: found });
    } else {
      resolved.set(specifier, found);
    }
  }
  return problems.length > 0 ? problems : { code: compiled.code, css: compiled.css, resolved };
}

/**
 * Compiles the entry and every file it imports, each once: the graph, or every problem found in
 * any of its files.
 */
export function compileGraph(
  options: GraphOptions,
): { graph: Graph } | { problems: Array<Problem> } {
  const entry = inside(options.folder, options.entry);
  if (entry === null) {
    return { problems: [{ file: "", message: `${options.entry} leaves the extension's folder` }] };
  }
  const files = new Map<string, GraphFile>();
  const problems: Array<Problem> = [];
  const queue = [entry];
  const seen = new Set(queue);
  for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
    const compiled = compileFile(options, next);
    if (Array.isArray(compiled)) {
      problems.push(...compiled);
      continue;
    }
    files.set(next, compiled);
    for (const found of compiled.resolved.values()) {
      if ("file" in found && !seen.has(found.file)) {
        seen.add(found.file);
        queue.push(found.file);
      }
    }
  }
  return problems.length > 0 ? { problems } : { graph: { entry, files, folder: options.folder } };
}

/** The compiler's result as `compileGraph` takes it, with the CSS `css`. */
function withCss(compiled: ReturnType<ModuleCompiler>, css: string): Compiled {
  return compiled.error
    ? { error: compiled.error }
    : { code: compiled.code, css, imports: compiled.imports };
}

/** What `compileVersion` takes: the two compilers, and the modules server code may import. */
export type VersionOptions = {
  compileModule: ModuleCompiler;
  compilePage: PageCompiler;
  shared: Record<string, unknown>;
};

/** Why the server code cannot import the bare specifier, or null when it can. */
function refuseOnServer(shared: Record<string, unknown>, specifier: string): string | null {
  const builtIn =
    specifier.startsWith("node:") && process.getBuiltinModule(specifier) !== undefined;
  return Object.hasOwn(shared, specifier) || builtIn
    ? null
    : `"${specifier}" cannot be imported: only Uraeda's shared modules, node: modules, and the extension's own files`;
}

/** Why a page cannot import the bare specifier: only a server module; the page runtime checks the rest. */
function refuseOnPage(specifier: string): string | null {
  return specifier.startsWith("node:")
    ? `"${specifier}" is a server module: a page cannot import it`
    : null;
}

/**
 * Compiles the extension's server entry and its page entry, each with the files it imports: page
 * files through StyleX and React Compiler first. Gives the version, or every problem of both.
 */
export function compileVersion(
  extension: { folder: string; page?: string; server?: string },
  { compileModule, compilePage, shared }: VersionOptions,
): Version | { problems: Array<Problem> } {
  const problems: Array<Problem> = [];
  const version: Version = {};
  const { folder } = extension;
  if (extension.server) {
    const result = compileGraph({
      compile: (source, filename) => withCss(compileModule(source, filename), ""),
      entry: extension.server,
      folder,
      refuse: (specifier) => refuseOnServer(shared, specifier),
    });
    if ("problems" in result) {
      problems.push(...result.problems);
    } else {
      version.server = result.graph;
    }
  }
  if (extension.page) {
    const compile = (source: string, filename: string): Compiled => {
      const page = compilePage(source, filename);
      return "error" in page ? page : withCss(compileModule(page.code, filename), page.css);
    };
    const result = compileGraph({ compile, entry: extension.page, folder, refuse: refuseOnPage });
    if ("problems" in result) {
      problems.push(...result.problems);
    } else {
      const { entry, files } = result.graph;
      const modules = Object.fromEntries([...files].map(([file, { code }]) => [file, code]));
      const css = [...files.values()].map((file) => file.css).filter((text) => text !== "");
      version.page = { css: css.join("\n"), entry, modules };
    }
  }
  return problems.length > 0 ? { problems } : version;
}
