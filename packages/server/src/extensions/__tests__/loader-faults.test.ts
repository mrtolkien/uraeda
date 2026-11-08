// What the loader does when the owner's code or folder misbehaves after a version loaded: a throw
// after activation, a load overtaken by a removal or a close, a reload asked during a load, and a
// folder replaced.
import { rmSync } from "node:fs";
import { join } from "node:path";
import { afterEach, expect, onTestFinished, test, vi } from "vite-plus/test";
import { temporaryFolder } from "uraeda-binding/test-utils";
import type { Loader } from "../loader.ts";
import {
  extensionFolder,
  gatedBinding,
  loaded,
  manifest,
  marking,
  openLoader,
  writeFiles,
} from "./helpers.ts";

afterEach(() => {
  delete (globalThis as { ticks?: number }).ticks;
});

/**
 * Leaves the loader's handlers alone on the process's `uncaughtException` and
 * `unhandledRejection` until the test ends, as in the server: the test runner's own would report
 * the error the loader handles.
 */
function aloneOnProcessFaults(): void {
  for (const event of ["uncaughtException", "unhandledRejection"]) {
    const listeners = process.listeners(event as "uncaughtException");
    process.removeAllListeners(event);
    onTestFinished(() => {
      for (const listener of listeners) {
        process.on(event, listener);
      }
    });
  }
}

/** An activation that registers 1, then runs `late`, code that throws after it returns. */
const throwingLater = (late: string) =>
  `export default function activate(api: { mark(value: unknown): void }) {\n  api.mark(1);\n  ${late}\n}\n`;

test.each([
  ["a scoped timer", `setTimeout(() => { throw new Error("late"); }, 0);`],
  ["a scoped microtask", `queueMicrotask(() => { throw new Error("late"); });`],
  ["an unhandled rejection", `Promise.reject(new Error("late"));`],
  ["an uncaught exception", `globalThis.setTimeout(() => { throw new Error("late"); }, 0);`],
])("a throw after activation, from %s, breaks only its extension", async (_, late) => {
  aloneOnProcessFaults();
  const config = temporaryFolder("config");
  extensionFolder(config, "other", { "server.ts": marking("other") });
  extensionFolder(config, "wiki", { "server.ts": throwingLater(late) });
  const { loader, marks } = await openLoader({ configDir: config });
  const wiki =
    loader.get("wiki")?.state === "broken"
      ? loader.get("wiki")
      : await loaded(loader, "wiki", (extension) => extension.state === "broken");
  expect(wiki?.problems).toEqual([{ file: "server.ts", message: "late" }]);
  expect(marks.of("wiki")).toEqual([]);
  expect(marks.of("other")).toEqual(["other"]);
  expect(loader.get("other")?.state).toBe("on");
});

test("an interval stops when its version unloads", async () => {
  const config = temporaryFolder("config");
  const folder = extensionFolder(config, "wiki", {
    "server.ts": `export default function activate() {\n  setInterval(() => {\n    const counted = globalThis as { ticks?: number };\n    counted.ticks = (counted.ticks ?? 0) + 1;\n  }, 5);\n}\n`,
  });
  const { loader } = await openLoader({ configDir: config });
  const counted = globalThis as { ticks?: number };
  await vi.waitUntil(() => (counted.ticks ?? 0) >= 2);

  const next = loaded(loader, "wiki");
  writeFiles(folder, { "server.ts": marking(2) });
  await next;
  const ticks = counted.ticks;
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(counted.ticks).toBe(ticks);
});

/** A promise that resolves once the loader no longer lists the extension `name`. */
function forgotten(loader: Loader, name: string): Promise<void> {
  return new Promise((resolve) => {
    const stop = loader.onChange(() => {
      if (loader.get(name) === undefined) {
        stop();
        resolve();
      }
    });
  });
}

test("a load overtaken by the folder's removal, or by close, leaves no registration", async () => {
  const config = temporaryFolder("config");
  const folder = extensionFolder(config, "wiki", { "server.ts": marking(1) });
  const { binding, hold } = await gatedBinding();
  const { loader, marks } = await openLoader({ binding, configDir: config });
  expect(marks.of("wiki")).toEqual([1]);

  // Read, then held: the folder removed meanwhile, the read still gives the extension.
  const removed = hold({ readFirst: true });
  const reloading = loader.reload("wiki");
  await removed.reached;
  const gone = forgotten(loader, "wiki");
  rmSync(folder, { force: true, recursive: true });
  await gone;
  removed.release();
  await reloading;
  expect(marks.of("wiki")).toEqual([]);

  // Closed while a load is held: nothing it evaluates stays.
  extensionFolder(config, "notes", { "server.ts": marking(2) });
  await loaded(loader, "notes", (extension) => extension.state === "on");
  expect(marks.of("notes")).toEqual([2]);
  const closing = hold({ readFirst: true });
  const again = loader.reload("notes");
  await closing.reached;
  loader.close();
  closing.release();
  await again;
  expect(marks.of("notes")).toEqual([]);
});

test("reload waits for the load it asked for, after the one running", async () => {
  const config = temporaryFolder("config");
  extensionFolder(config, "wiki", { "server.ts": marking(1) });
  const { binding, hold } = await gatedBinding();
  const { loader } = await openLoader({ binding, configDir: config });
  expect(loader.get("wiki")?.version).toBe(1);

  const { reached, release } = hold();
  const first = loader.reload("wiki");
  await reached;
  const second = loader.reload("wiki");
  release();
  await second;
  expect(loader.get("wiki")?.version).toBe(3);
  await first;
});

/** A server entry that registers `v` from `./lib/v`. */
const IMPORTING = `import { v } from "./lib/v";\nexport default function activate(api: { mark(value: unknown): void }) {\n  api.mark(v);\n}\n`;

test("a subfolder deleted and made again is still watched", async () => {
  const config = temporaryFolder("config");
  const folder = extensionFolder(config, "wiki", {
    "lib/v.ts": `export const v = "a";\n`,
    "server.ts": IMPORTING,
  });
  const { loader, marks } = await openLoader({ configDir: config });
  expect(marks.of("wiki")).toEqual(["a"]);

  const lost = loaded(loader, "wiki", (extension) => extension.problems.length > 0);
  rmSync(join(folder, "lib"), { force: true, recursive: true });
  expect(await lost).toMatchObject({ state: "on", version: 1 });

  const back = loaded(loader, "wiki", (extension) => extension.version === 2);
  writeFiles(folder, { "lib/v.ts": `export const v = "b";\n` });
  expect(await back).toMatchObject({ problems: [], state: "on" });
  expect(marks.of("wiki")).toEqual(["b"]);

  // A save in the folder made again reloads.
  const saved = loaded(loader, "wiki", (extension) => extension.version === 3);
  writeFiles(folder, { "lib/v.ts": `export const v = "c";\n` });
  await saved;
  expect(marks.of("wiki")).toEqual(["c"]);
});

test("a manifest broken and fixed loads the extension again", async () => {
  const config = temporaryFolder("config");
  const folder = extensionFolder(config, "wiki", { "server.ts": marking(1) });
  const { loader, marks } = await openLoader({ configDir: config });
  expect(marks.of("wiki")).toEqual([1]);

  const broken = loaded(loader, "wiki", (extension) => extension.state === "broken");
  writeFiles(folder, { "extension.toml": "name = \n" });
  await broken;
  expect(marks.of("wiki")).toEqual([]);

  // Its folder is still watched: the fix is seen, though the manifest named no file.
  const fixed = loaded(loader, "wiki", (extension) => extension.state === "on");
  writeFiles(folder, { "extension.toml": manifest("wiki"), "server.ts": marking(2) });
  expect(await fixed).toMatchObject({ problems: [], version: 2 });
  expect(marks.of("wiki")).toEqual([2]);
});
