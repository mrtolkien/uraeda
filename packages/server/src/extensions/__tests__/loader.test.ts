// The loader runs the owner's code in the server: each test writes extension folders to a temporary
// config folder, opens the loader over the real binding and compiler, and waits for its notices.
import { relative, join } from "node:path";
import { rmSync, symlinkSync } from "node:fs";
import { afterEach, expect, test } from "vite-plus/test";
import { temporaryFolder } from "uraeda-binding/test-utils";
import {
  extensionFolder,
  gatedBinding,
  loaded,
  manifest,
  marking,
  openLoader,
  problemLines,
  writeFiles,
} from "./helpers.ts";

const PAGE = `import { title } from "./lib/title";
export default function Page() {
  return <p>{title}</p>;
}
`;

/** A server entry that registers `v` imported from `from`. */
const importing = (from: string) =>
  `import { v } from "${from}";\nexport default function activate(api: { mark(value: unknown): void }) {\n  api.mark(v);\n}\n`;

afterEach(() => {
  delete (globalThis as { keptApi?: unknown }).keptApi;
});

test("a saved change reloads the extension once, latest files", async () => {
  const config = temporaryFolder("config");
  const folder = extensionFolder(config, "wiki", {
    "extension.toml": manifest("wiki", { page: true }),
    "lib/title.ts": `export const title = "Wiki";\n`,
    "page.tsx": PAGE,
    "server.ts": marking(0),
  });
  const { binding, hold } = await gatedBinding();
  const { loader, marks } = await openLoader({ binding, configDir: config });
  expect(loader.get("wiki")).toMatchObject({ problems: [], state: "on", version: 1 });
  expect(marks.of("wiki")).toEqual([0]);
  expect(loader.pageBundle("wiki")).toMatchObject({
    css: `/* ${folder}/page.tsx */\n/* ${folder}/lib/title.ts */`,
    entry: "page.tsx",
    version: 1,
  });
  expect(Object.keys(loader.pageBundle("wiki")?.modules ?? {})).toEqual([
    "page.tsx",
    "lib/title.ts",
  ]);

  // Three saves within the debounce: one reload, of the last, the first version undone.
  const next = loaded(loader, "wiki");
  for (const value of [1, 2, 3]) {
    writeFiles(folder, { "server.ts": marking(value) });
  }
  expect(await next).toMatchObject({ state: "on", version: 2 });
  expect(marks.of("wiki")).toEqual([3]);
  expect(loader.pageBundle("wiki")?.version).toBe(2);

  // A save while a version compiles: exactly one more compile, of the latest files.
  const { reached, release } = hold();
  const third = loaded(loader, "wiki", (extension) => extension.version === 3);
  const fourth = loaded(loader, "wiki", (extension) => extension.version === 4);
  writeFiles(folder, { "server.ts": marking(4) });
  await reached;
  writeFiles(folder, { "lib/title.ts": `export const title = "W";\n`, "server.ts": marking(5) });
  release();
  await third;
  expect(await fourth).toMatchObject({ state: "on", version: 4 });
  expect(marks.of("wiki")).toEqual([5]);
  expect(loader.pageBundle("wiki")?.modules["lib/title.ts"]).toContain(`"W"`);

  // Deferred, as a runtime's turn defers it: the reload waits, the running version kept.
  const turn = Promise.withResolvers<void>();
  loader.defer("wiki", turn.promise, "Fix the login");
  const waiting = loaded(loader, "wiki", (extension) => extension.state === "waiting");
  writeFiles(folder, { "server.ts": marking(6) });
  expect(await waiting).toMatchObject({ version: 4, waitingFor: "Fix the login" });
  expect(marks.of("wiki")).toEqual([5]);
  const after = loaded(loader, "wiki", (extension) => extension.version === 5);
  turn.resolve();
  expect(await after).toMatchObject({ state: "on" });
  expect(marks.of("wiki")).toEqual([6]);
});

test("a file that fails to compile keeps the last working version", async () => {
  const config = temporaryFolder("config");
  const folder = extensionFolder(config, "wiki", { "server.ts": marking(1) });
  const { loader, marks } = await openLoader({ configDir: config });

  const broken = loaded(loader, "wiki");
  writeFiles(folder, { "server.ts": "export default function activate() {\n  const = ;\n}\n" });
  const extension = await broken;
  expect(extension).toMatchObject({ state: "on", version: 1 });
  expect(problemLines(extension)).toEqual([expect.stringMatching(/^server\.ts:2: Unexpected/)]);
  expect(marks.of("wiki")).toEqual([1]);

  // Fixed: the next version replaces it, and the problem goes.
  const fixed = loaded(loader, "wiki");
  writeFiles(folder, { "server.ts": marking(2) });
  expect(await fixed).toMatchObject({ problems: [], state: "on", version: 2 });
  expect(marks.of("wiki")).toEqual([2]);
});

/** The broken extension `wiki`'s files, by how it is broken. */
const BREAKAGES: Record<string, (config: string) => void> = {
  "a dangling link": (config) =>
    symlinkSync(join(config, "gone"), join(config, "extensions", "wiki")),
  "api = 2 in extension.toml": (config) =>
    extensionFolder(config, "wiki", {
      "extension.toml": manifest("wiki", { api: 2 }),
      "server.ts": marking("broken"),
    }),
  "async function activate": (config) =>
    extensionFolder(config, "wiki", {
      "server.ts": `export default async function activate(api: { mark(value: unknown): void }) {\n  api.mark("broken");\n}\n`,
    }),
  "const = ;": (config) => extensionFolder(config, "wiki", { "server.ts": "const = ;\n" }),
  "throw new Error('boom')": (config) =>
    extensionFolder(config, "wiki", {
      "server.ts": `export default function activate(api: { mark(value: unknown): void }) {\n  api.mark("broken");\n  throw new Error("boom");\n}\n`,
    }),
  "while (true) {}": (config) =>
    extensionFolder(config, "wiki", {
      "server.ts": `export default function activate(api: { mark(value: unknown): void }) {\n  api.mark("broken");\n  while (true) {}\n}\n`,
    }),
};

test.each([
  ["throws", "throw new Error('boom')", "broken", "server.ts: boom"],
  ["loops", "while (true) {}", "broken", "Script execution timed out"],
  [
    "activates asynchronously",
    "async function activate",
    "broken",
    "server.ts: activation must be synchronous: start async work from a callback, not while loading",
  ],
  ["does not compile", "const = ;", "broken", "server.ts:1"],
  [
    "is built for another API",
    "api = 2 in extension.toml",
    "off",
    "built for extension API 2, and Uraeda runs API 1",
  ],
  ["lost its folder", "a dangling link", "broken", "folder not found"],
])("a broken extension leaves the others running (%s)", async (_, breakage, state, message) => {
  const config = temporaryFolder("config");
  extensionFolder(config, "other", { "server.ts": marking("other") });
  BREAKAGES[breakage]?.(config);
  const { loader, marks } = await openLoader({ configDir: config });

  expect(loader.get("other")).toMatchObject({ problems: [], state: "on" });
  expect(marks.of("other")).toEqual(["other"]);
  const wiki = loader.get("wiki");
  expect(wiki?.state).toBe(state);
  expect(problemLines(wiki).join("\n")).toContain(message);
  // What it registered before it failed is undone.
  expect(marks.of("wiki")).toEqual([]);
  expect(loader.pageBundle("wiki")).toBeUndefined();
});

test("an unloaded version's calls are refused", async () => {
  const config = temporaryFolder("config");
  const folder = extensionFolder(config, "wiki", {
    "server.ts": `export default function activate(api: { mark(value: unknown): void }) {\n  (globalThis as { keptApi?: unknown }).keptApi = api;\n  api.mark(1);\n}\n`,
  });
  const { loader, marks } = await openLoader({ configDir: config });
  const kept = (globalThis as { keptApi?: { mark(value: unknown): void } }).keptApi;
  expect(marks.of("wiki")).toEqual([1]);

  const next = loaded(loader, "wiki");
  writeFiles(folder, { "server.ts": marking(2) });
  await next;
  expect(() => kept?.mark(3)).toThrow("wiki: this version of the extension was unloaded");
  expect(marks.of("wiki")).toEqual([2]);
});

test("loads only the config folder's extensions", async () => {
  const config = temporaryFolder("config");
  const repository = temporaryFolder("repository");
  for (const path of [".uraeda/extensions/x", "extensions/x"]) {
    writeFiles(join(repository, path), {
      "extension.toml": manifest("x"),
      "server.ts": marking("x"),
    });
  }
  writeFiles(repository, { "outside.ts": `export const v = "outside";\n` });
  // A link in the config folder is the owner's act: it loads, wherever it points.
  const linked = join(repository, "linked");
  writeFiles(linked, {
    "extension.toml": manifest("linked"),
    "lib/v.ts": `export const v = "linked";\n`,
    "server.ts": `import { v } from "./lib/v";\nexport default function activate(api: { mark(value: unknown): void }) {\n  api.mark(v);\n}\n`,
  });
  // A path out of the folder, and a file of the folder that links out of it: neither is its own.
  const climb = join(config, "extensions", "climb");
  extensionFolder(config, "climb", {
    "server.ts": importing(relative(climb, join(repository, "outside"))),
  });
  const escape = extensionFolder(config, "escape", { "server.ts": importing("./out") });
  symlinkSync(join(repository, "outside.ts"), join(escape, "out.ts"));
  symlinkSync(linked, join(config, "extensions", "linked"));
  const { loader, marks } = await openLoader({ configDir: config });

  const yours = loader.list().filter((loaded) => !loaded.extension.isBuiltIn);
  expect(yours.map((loaded) => loaded.extension.name)).toEqual(["climb", "escape", "linked"]);
  expect(marks.of("linked")).toEqual(["linked"]);
  expect(marks.of("x")).toEqual([]);
  for (const name of ["climb", "escape"]) {
    expect(loader.get(name)?.state).toBe("broken");
    expect(problemLines(loader.get(name)).join("\n")).toContain("leaves the extension's folder");
  }

  // The linked folder deleted: the extension unloads, and says why.
  const gone = loaded(loader, "linked");
  rmSync(linked, { force: true, recursive: true });
  const extension = await gone;
  expect(extension.state).toBe("broken");
  expect(problemLines(extension)).toEqual([": folder not found"]);
  expect(marks.of("linked")).toEqual([]);
});
