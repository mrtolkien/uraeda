// What the loader's tests share: extension folders written to a temporary config folder, a loader
// opened over the real binding with an API that records what each version registers, and the
// loader's own notices to wait on, never a sleep.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { onTestFinished } from "vite-plus/test";
import { temporaryFolder } from "uraeda-binding/test-utils";
import type { Binding } from "../../fate/context.ts";
import { type LoadedExtension, Loader, type LoaderOptions } from "../loader.ts";
import type { Scope } from "../scope.ts";

/** The manifest of an extension `name` with a server entry, `server.ts`, on the API `api`. */
export function manifest(name: string, { api = 1, page = false } = {}): string {
  const entries = page ? `server = "server.ts"\npage = "page.tsx"\n` : `server = "server.ts"\n`;
  return `name = "${name}"\ntitle = "${name}"\napi = ${api}\n${entries}`;
}

/** Writes `files`, by relative path, into `folder`, making the folders they need. */
export function writeFiles(folder: string, files: Record<string, string>): void {
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(folder, path)), { recursive: true });
    writeFileSync(join(folder, path), text);
  }
}

/**
 * The folder of the extension `name` in the config folder `config`, with `files` written in it,
 * and its manifest, `extension.toml`, unless `files` has one.
 */
export function extensionFolder(
  config: string,
  name: string,
  files: Record<string, string>,
): string {
  const folder = join(config, "extensions", name);
  writeFiles(folder, { "extension.toml": manifest(name), ...files });
  return folder;
}

/** A server entry whose activation registers `value` through `api.mark`. */
export function marking(value: unknown): string {
  return `export default function activate(api: { mark(value: unknown): void }) {\n  api.mark(${JSON.stringify(value)});\n}\n`;
}

/**
 * A promise of the loader's next notice for the extension `name`, with its state then; with
 * `until`, of its first notice whose state passes it.
 */
export function loaded(
  loader: Loader,
  name: string,
  until: (extension: LoadedExtension) => boolean = () => true,
): Promise<LoadedExtension> {
  return new Promise((resolve) => {
    const stop = loader.onChange((changed) => {
      const extension = loader.get(name);
      if (changed === name && extension && until(extension)) {
        stop();
        resolve(extension);
      }
    });
  });
}

/** What every version registered and has not undone, by extension name, in order. */
export class Marks {
  readonly #marks: Array<{ name: string; value: unknown }> = [];

  /** The API each version gets: `mark(value)` registers `value`, undone when it unloads. */
  readonly api = (scope: Scope) => ({
    mark: (value: unknown) => {
      scope.check();
      const mark = { name: scope.name, value };
      this.#marks.push(mark);
      scope.add(() => this.#marks.splice(this.#marks.indexOf(mark), 1));
    },
  });

  /** The values the extension `name` registered and has not undone. */
  of(name: string): Array<unknown> {
    return this.#marks.filter((mark) => mark.name === name).map((mark) => mark.value);
  }
}

/** A page compiler that changes nothing, and gives no CSS but a comment naming the file. */
export function identityPage(source: string, filename: string) {
  return { code: source, css: `/* ${filename} */` };
}

/**
 * The real binding, whose `readExtensions` can be held once at a gate: after it reads, so a save
 * made while it waits is read, or with `readFirst`, before, so it gives the files as they were.
 */
export async function gatedBinding() {
  const real: Binding = await import("uraeda-binding");
  let held: { gate: Promise<void>; reached: () => void; readFirst: boolean } | null = null;
  const binding: Binding = {
    ...real,
    readExtensions: async (dir: string) => {
      const hold = held;
      held = null;
      if (!hold) {
        return real.readExtensions(dir);
      }
      const read = hold.readFirst ? await real.readExtensions(dir) : undefined;
      hold.reached();
      await hold.gate;
      return read ?? real.readExtensions(dir);
    },
  };
  /** Holds the next read; resolves `reached` once a reload waits at it, until `release`. */
  const hold = ({ readFirst = false } = {}) => {
    const { promise: reached, resolve } = Promise.withResolvers<void>();
    const { promise: gate, resolve: release } = Promise.withResolvers<void>();
    held = { gate, reached: resolve, readFirst };
    return { reached, release };
  };
  return { binding, hold };
}

/** A temporary config folder, and a loader over it, closed when the test ends. */
export async function openLoader(
  options: Partial<LoaderOptions> & { configDir?: string; marks?: Marks } = {},
): Promise<{ config: string; loader: Loader; marks: Marks }> {
  const config = options.configDir ?? temporaryFolder("config");
  const marks = options.marks ?? new Marks();
  const binding: Binding = await import("uraeda-binding");
  const loader = await Loader.open({
    api: marks.api,
    binding,
    compilePage: identityPage,
    configDir: config,
    shared: {},
    ...options,
  });
  onTestFinished(() => loader.close());
  return { config, loader, marks };
}

/** A problem as one line: its file, its line when it has one, and its message. */
export function problemLines(extension: LoadedExtension | undefined): Array<string> {
  return (extension?.problems ?? []).map(
    ({ file, line, message }) => `${file}${line === undefined ? "" : `:${line}`}: ${message}`,
  );
}
