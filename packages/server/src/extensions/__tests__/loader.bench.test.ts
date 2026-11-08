// The spec's two measures of the loader, SC-001 and SC-002: the only loader tests that time.
import { setFlagsFromString } from "node:v8";
import { runInNewContext } from "node:vm";
import { expect, test } from "vite-plus/test";
import { temporaryFolder } from "uraeda-binding/test-utils";
import { extensionFolder, loaded, openLoader, writeFiles } from "./helpers.ts";

/** How many files the SC-001 extension has: its entry, and the files it imports. */
const FILES = 50;

/** A file of the extension, `index` its place: a few functions, as a real one has. */
function libraryFile(index: number, value: number): string {
  return `export function f${index}(n: number): number {\n  return n + ${value};\n}\nexport const label${index} = "file ${index}";\n`;
}

/** The entry of an extension that imports `count` files and registers the sum of their values. */
function entry(count: number): string {
  const indexes = Array.from({ length: count }, (_, index) => index);
  const imports = indexes.map((index) => `import { f${index} } from "./lib/f${index}";`);
  const sum = indexes.map((index) => `f${index}(0)`).join(" + ");
  return `${imports.join("\n")}\nexport default function activate(api: { mark(value: unknown): void }) {\n  api.mark(${sum});\n}\n`;
}

test("SC-001: a saved change reloads an extension of 50 files within 1 second", async () => {
  const config = temporaryFolder("config");
  const files: Record<string, string> = { "server.ts": entry(FILES - 1) };
  for (let index = 0; index < FILES - 1; index++) {
    files[`lib/f${index}.ts`] = libraryFile(index, 0);
  }
  const folder = extensionFolder(config, "big", files);
  const { loader, marks } = await openLoader({ configDir: config });
  expect(marks.of("big")).toEqual([0]);

  const next = loaded(loader, "big");
  const start = performance.now();
  writeFiles(folder, { "lib/f10.ts": libraryFile(10, 7) });
  await next;
  const elapsed = performance.now() - start;
  expect(marks.of("big")).toEqual([7]);
  expect(elapsed).toBeLessThan(1000);
});

/** Node's `gc`, exposed at run time, or undefined when this Node refuses the flag. */
function exposedGc(): (() => void) | undefined {
  setFlagsFromString("--expose-gc");
  return runInNewContext("typeof gc === 'function' ? gc : undefined") as (() => void) | undefined;
}

/** A server entry of about 200 KB, so a version kept after its reload shows in the heap. */
function heavyEntry(version: number): string {
  const data = Array.from({ length: 10_000 }, (_, index) => `"${version}-${index}-padding"`);
  return `const data = [${data.join(", ")}];\nexport default function activate(api: { mark(value: unknown): void }) {\n  api.mark(data.length + ${version});\n}\n`;
}

const gc = exposedGc();

test.skipIf(gc === undefined)(
  "SC-002: 100 reloads grow the heap by less than 10 MB",
  async () => {
    const config = temporaryFolder("config");
    const folder = extensionFolder(config, "heavy", { "server.ts": heavyEntry(0) });
    const { loader, marks } = await openLoader({ configDir: config });
    const reload = async (version: number) => {
      const next = loaded(loader, "heavy", (extension) => extension.version === version + 1);
      writeFiles(folder, { "server.ts": heavyEntry(version) });
      await next;
    };
    // A few reloads first, so the compiler's and the watch's one-time allocations are counted out.
    for (let version = 1; version <= 5; version++) {
      await reload(version);
    }
    gc?.();
    const before = process.memoryUsage().heapUsed;
    for (let version = 6; version <= 105; version++) {
      await reload(version);
    }
    gc?.();
    const grown = process.memoryUsage().heapUsed - before;
    expect(marks.of("heavy")).toEqual([10_105]);
    expect(grown).toBeLessThan(10 * 1024 * 1024);
    // 105 reloads, each after the loader's quiet moment: about 10 seconds alone, more beside others.
  },
  90_000,
);

if (gc === undefined) {
  process.stderr.write("SC-002 skipped: this Node does not expose gc, so the heap cannot settle\n");
}
